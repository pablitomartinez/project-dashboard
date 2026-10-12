import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as input from "../src/lib/project-input.ts";
import { projectProgress, taskProgressPercent } from "../src/lib/project-progress.ts";
import { countTasks } from "../src/lib/task-input.ts";

const id = "123e4567-e89b-12d3-a456-426614174000";

function load(path: string, modules: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(code, {
    exports,
    console: { error() {} },
    require(name: string) {
      if (name in modules) return modules[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

type ProjectsModule = {
  listProjects: () => Promise<Record<string, unknown>[]>;
  updateProject: (id: string, data: input.CreateProjectInput) => Promise<unknown>;
};

// Runs the real data layer with a Supabase client that records the query chain.
function dataLayer(result: { data?: unknown; error?: { code: string } | null }) {
  const chain: unknown[][] = [];
  const builder: object = new Proxy({}, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve({ data: null, error: null, ...result });
      }
      return (...args: unknown[]) => {
        chain.push([prop, ...args]);
        return builder;
      };
    },
  });
  const exports = load("../src/lib/projects.ts", {
    "server-only": {},
    "@/lib/supabase/server": { getSupabaseServerClient: () => builder },
  }) as ProjectsModule;
  return { ...exports, chain };
}

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id, name: "Dashboard", description: null, status: "active", progress_mode: "tasks",
    manual_progress: 40, local_path: null, repository_url: null, production_url: null,
    branch: null, stack: null, notes: null, created_at: "c", updated_at: "u",
    ...overrides,
  };
}

function projectForm(fields: Record<string, string>) {
  const form = new FormData();
  form.set("name", "Dashboard");
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

test("progress: manual mode shows manual_progress and ignores tasks", () => {
  const project = { progress_mode: "manual" as const, manual_progress: 35 };
  assert.deepEqual(projectProgress(project, { total: 4, completed: 4 }), { mode: "manual", percent: 35 });
  assert.deepEqual(projectProgress(project, { total: 0, completed: 0 }), { mode: "manual", percent: 35 });
});

test("progress: tasks mode uses completed over total and ignores manual_progress", () => {
  const project = { progress_mode: "tasks" as const, manual_progress: 90 };
  assert.deepEqual(projectProgress(project, { total: 4, completed: 1 }), { mode: "tasks", percent: 25 });
});

test("progress: no tasks, none completed and all completed", () => {
  assert.equal(taskProgressPercent({ total: 0, completed: 0 }), 0);
  assert.equal(taskProgressPercent({ total: 5, completed: 0 }), 0);
  assert.equal(taskProgressPercent({ total: 5, completed: 5 }), 100);
  assert.equal(taskProgressPercent({ total: 3, completed: 5 }), 100);
});

test("progress: rounds to the nearest integer", () => {
  assert.equal(taskProgressPercent({ total: 3, completed: 1 }), 33);
  assert.equal(taskProgressPercent({ total: 3, completed: 2 }), 67);
  assert.equal(taskProgressPercent({ total: 8, completed: 1 }), 13);
  assert.equal(taskProgressPercent({ total: 200, completed: 29 }), 15);
  assert.equal(taskProgressPercent({ total: 7, completed: 6 }), 86);
});

test("progress: switching modes changes only the source of the percentage", () => {
  const counts = { total: 3, completed: 1 };
  const stored = { manual_progress: 80 };
  assert.equal(projectProgress({ ...stored, progress_mode: "manual" }, counts).percent, 80);
  assert.equal(projectProgress({ ...stored, progress_mode: "tasks" }, counts).percent, 33);
  assert.equal(projectProgress({ ...stored, progress_mode: "manual" }, counts).percent, 80);
});

test("input: progress_mode defaults to manual and rejects unknown modes", () => {
  const defaulted = input.parseCreateProjectInput(projectForm({}));
  assert.equal(defaulted.success && defaulted.data.progress_mode, "manual");
  const tasks = input.parseCreateProjectInput(projectForm({ progress_mode: "tasks", manual_progress: "40" }));
  assert.equal(tasks.success && tasks.data.progress_mode, "tasks");
  for (const mode of ["auto", "TASKS", "tasks; drop"]) {
    const result = input.parseCreateProjectInput(projectForm({ progress_mode: mode, notes: "keep" }));
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.fieldErrors.progress_mode ?? "", /inválido/);
      assert.equal(result.values.notes, "keep");
    }
  }
  const invalidManual = input.parseCreateProjectInput(projectForm({ progress_mode: "tasks", manual_progress: "500" }));
  assert.equal(invalidManual.success, false);
});

test("data: updating in tasks mode keeps manual_progress; manual mode writes it", async () => {
  const toTasks = input.parseCreateProjectInput(projectForm({ progress_mode: "tasks", manual_progress: "0" }));
  assert.ok(toTasks.success);
  const tasksDb = dataLayer({ data: projectRow() });
  await tasksDb.updateProject(id, toTasks.data);
  const tasksUpdate = tasksDb.chain.find(([method]) => method === "update")?.[1] as Record<string, unknown>;
  assert.equal(tasksUpdate.progress_mode, "tasks");
  assert.equal("manual_progress" in tasksUpdate, false);
  assert.equal("status" in tasksUpdate, true);

  const toManual = input.parseCreateProjectInput(projectForm({ progress_mode: "manual", manual_progress: "40" }));
  assert.ok(toManual.success);
  const manualDb = dataLayer({ data: projectRow({ progress_mode: "manual" }) });
  await manualDb.updateProject(id, toManual.data);
  const manualUpdate = manualDb.chain.find(([method]) => method === "update")?.[1] as Record<string, unknown>;
  assert.equal(manualUpdate.progress_mode, "manual");
  assert.equal(manualUpdate.manual_progress, 40);
});

test("action: switching to tasks returns the conserved manual_progress from the saved row", async () => {
  const revalidated: string[] = [];
  const actions = load("../src/app/actions.ts", {
    "next/cache": { revalidatePath: (path: string) => revalidated.push(path) },
    "@/lib/project-input": input,
    "@/lib/projects": {
      updateProject: async (_id: string, data: input.CreateProjectInput) =>
        ({ ...data, manual_progress: 40, updated_at: "v2" }),
    },
  }) as { updateProjectAction: (...args: unknown[]) => Promise<input.CreateProjectState> };
  const state = await actions.updateProjectAction(
    id, "v1", { status: "idle" }, projectForm({ progress_mode: "tasks", manual_progress: "40", status: "paused" }),
  );
  assert.equal(state.status, "success");
  if (state.status === "success") {
    assert.equal(state.values?.progress_mode, "tasks");
    assert.equal(state.values?.manual_progress, "40");
    assert.equal(state.values?.status, "paused");
  }
  assert.deepEqual(revalidated, [`/projects/${id}`, "/"]);
});

test("data: the dashboard loads every project with its task counts in one query", async () => {
  const db = dataLayer({
    data: [
      { ...projectRow(), task_total: [{ count: 3 }], task_completed: [{ count: 1 }] },
      { ...projectRow({ id: "other", progress_mode: "manual" }), task_total: [{ count: 0 }], task_completed: [{ count: 0 }] },
      { ...projectRow({ id: "legacy" }), task_total: null, task_completed: undefined },
    ],
  });
  const projects = await db.listProjects();
  assert.equal(db.chain.filter(([method]) => method === "from").length, 1);
  const select = String(db.chain.find(([method]) => method === "select")?.[1]);
  assert.match(select, /task_total:tasks\(count\)/);
  assert.match(select, /task_completed:tasks\(count\)/);
  assert.deepEqual(db.chain.find(([method]) => method === "eq"), ["eq", "task_completed.completed", true]);
  assert.deepEqual(projects.map((project) => ({ ...(project.task_counts as object) })), [
    { total: 3, completed: 1 },
    { total: 0, completed: 0 },
    { total: 0, completed: 0 },
  ]);
  assert.equal("task_total" in projects[0], false);
  assert.equal(projects[0].manual_progress, 40);
});

test("consistency: dashboard counts and detail tasks yield the same progress", async () => {
  const tasks = [{ completed: true }, { completed: false }, { completed: true }, { completed: false }, { completed: false }, { completed: true }];
  const row = projectRow();
  const db = dataLayer({
    data: [{ ...row, task_total: [{ count: tasks.length }], task_completed: [{ count: 3 }] }],
  });
  const [dashboardProject] = await db.listProjects();
  const dashboard = projectProgress(row as never, dashboardProject.task_counts as never);

  const { pending, completed } = countTasks(tasks);
  const detail = projectProgress(row as never, { total: tasks.length, completed });

  assert.deepEqual(dashboard, detail);
  assert.deepEqual(dashboard, { mode: "tasks", percent: 50 });
  assert.equal(pending + completed, (dashboardProject.task_counts as { total: number }).total);
});

test("data: Supabase errors are generic and never expose details", async () => {
  const error = { code: "42501", message: "private detail" } as { code: string };
  await assert.rejects(dataLayer({ error }).listProjects(), (thrown: Error) => {
    assert.equal(thrown.message, "Could not load projects.");
    return true;
  });
  const parsed = input.parseCreateProjectInput(projectForm({ progress_mode: "tasks" }));
  assert.ok(parsed.success);
  await assert.rejects(dataLayer({ error }).updateProject(id, parsed.data), /Could not update project/);
});
