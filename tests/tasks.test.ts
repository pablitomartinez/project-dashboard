import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as projectInput from "../src/lib/project-input.ts";
import * as taskInput from "../src/lib/task-input.ts";

const projectId = "123e4567-e89b-12d3-a456-426614174000";
const taskId = "223e4567-e89b-12d3-a456-426614174000";
const invalidIds = [undefined, null, "", "not-a-uuid", `${projectId} `, "' or 1=1 --", 42, {}];

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

type Tasks = {
  createTask: (projectId: string, title: string) => Promise<boolean>;
  setTaskCompleted: (projectId: string, taskId: string, completed: boolean) => Promise<unknown>;
  updateTaskTitle: (projectId: string, taskId: string, title: string) => Promise<unknown>;
  deleteTask: (projectId: string, taskId: string) => Promise<unknown>;
};

// Runs the real Server Actions with Next and the data layer replaced.
function actions(tasks: Partial<Tasks>) {
  const revalidated: string[] = [];
  const calls: unknown[][] = [];
  const record = (name: keyof Tasks) => (...args: unknown[]) => {
    calls.push([name, ...args]);
    const fn = tasks[name] as ((...a: unknown[]) => Promise<unknown>) | undefined;
    if (!fn) assert.fail(`Unexpected call to ${name}`);
    return fn(...args);
  };
  const exports = load("../src/app/task-actions.ts", {
    "next/cache": { revalidatePath: (path: string) => revalidated.push(path) },
    "@/lib/project-input": projectInput,
    "@/lib/task-input": taskInput,
    "@/lib/tasks": Object.fromEntries(
      (["createTask", "setTaskCompleted", "updateTaskTitle", "deleteTask"] as const).map((name) => [name, record(name)]),
    ),
  }) as {
    createTaskAction: (id: unknown, state: taskInput.CreateTaskState, form: FormData) => Promise<taskInput.CreateTaskState>;
    toggleTaskAction: (projectId: unknown, taskId: unknown, completed: unknown) => Promise<taskInput.ToggleTaskState>;
    updateTaskTitleAction: (projectId: unknown, taskId: unknown, state: taskInput.EditTaskState, form: FormData) => Promise<taskInput.EditTaskState>;
    deleteTaskAction: (projectId: unknown, taskId: unknown) => Promise<taskInput.DeleteTaskState>;
  };
  return { ...exports, revalidated, calls };
}

// Records the Supabase query chain and resolves it with `result`.
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
  const exports = load("../src/lib/tasks.ts", {
    "server-only": {},
    "@/lib/supabase/server": { getSupabaseServerClient: () => builder },
  }) as Tasks & { listTasks: (projectId: string) => Promise<unknown[]> };
  return { ...exports, chain };
}

function titleForm(title: unknown) {
  const form = new FormData();
  if (typeof title === "string") form.set("title", title);
  return form;
}

test("task input: trims the title and rejects blank, missing or too long titles", () => {
  assert.deepEqual({ ...taskInput.parseTaskTitle(titleForm("  Write docs  ")) }, { success: true, title: "Write docs" });
  for (const title of ["", "   \n", undefined]) {
    const result = taskInput.parseTaskTitle(titleForm(title));
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.error, /obligatorio/);
  }
  const long = taskInput.parseTaskTitle(titleForm("x".repeat(taskInput.TASK_TITLE_MAX_LENGTH + 1)));
  assert.equal(long.success, false);
  const max = taskInput.parseTaskTitle(titleForm("x".repeat(taskInput.TASK_TITLE_MAX_LENGTH)));
  assert.equal(max.success, true);
  const file = new FormData();
  file.set("title", new Blob(["x"]));
  assert.equal(taskInput.parseTaskTitle(file).success, false);
});

test("create: associates the trimmed title with the project and refreshes its page", async () => {
  const harness = actions({ createTask: async () => true });
  const state = await harness.createTaskAction(projectId, { status: "idle" }, titleForm("  Deploy  "));
  assert.equal(state.status, "success");
  assert.deepEqual([...harness.calls.map((call) => [...call])], [["createTask", projectId, "Deploy"]]);
  assert.deepEqual([...harness.revalidated], [`/projects/${projectId}`]);
});

test("create: invalid title or project id never reaches the database", async () => {
  const harness = actions({});
  const blank = await harness.createTaskAction(projectId, { status: "idle" }, titleForm("   "));
  assert.equal(blank.status, "error");
  if (blank.status === "error") {
    assert.equal(blank.invalidTitle, true);
    assert.equal(blank.title, "   ");
  }
  for (const id of invalidIds) {
    const state = await harness.createTaskAction(id, { status: "idle" }, titleForm("Task"));
    assert.equal(state.status, "error");
    if (state.status === "error") {
      assert.equal(state.message, "Proyecto inválido.");
      assert.equal(state.title, "Task");
    }
  }
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.revalidated.length, 0);
});

test("create: missing project and database errors keep the entered title", async () => {
  const missing = actions({ createTask: async () => false });
  const state = await missing.createTaskAction(projectId, { status: "idle" }, titleForm("Task"));
  assert.equal(state.status, "error");
  if (state.status === "error") {
    assert.equal(state.projectMissing, true);
    assert.equal(state.title, "Task");
  }
  assert.deepEqual([...missing.revalidated], [`/projects/${projectId}`]);

  const failing = actions({ createTask: async () => { throw new Error("private detail"); } });
  const failed = await failing.createTaskAction(projectId, { status: "idle" }, titleForm("Task"));
  assert.equal(failed.status, "error");
  if (failed.status === "error") {
    assert.doesNotMatch(failed.message, /private/);
    assert.equal(failed.title, "Task");
  }
  assert.equal(failing.revalidated.length, 0);
});

test("toggle: persists the new value for the task of that project", async () => {
  const harness = actions({ setTaskCompleted: async () => ({ id: taskId }) });
  assert.deepEqual({ ...(await harness.toggleTaskAction(projectId, taskId, true)) }, { status: "success" });
  assert.deepEqual({ ...(await harness.toggleTaskAction(projectId, taskId, false)) }, { status: "success" });
  assert.deepEqual(harness.calls.map((call) => [...call]), [
    ["setTaskCompleted", projectId, taskId, true],
    ["setTaskCompleted", projectId, taskId, false],
  ]);
  assert.deepEqual([...harness.revalidated], [`/projects/${projectId}`, `/projects/${projectId}`]);
});

test("toggle: invalid ids or non-boolean values never reach the database", async () => {
  const harness = actions({});
  for (const id of invalidIds) {
    assert.equal((await harness.toggleTaskAction(id, taskId, true)).status, "error");
    assert.equal((await harness.toggleTaskAction(projectId, id, true)).status, "error");
  }
  for (const completed of ["true", 1, null, undefined]) {
    assert.equal((await harness.toggleTaskAction(projectId, taskId, completed)).status, "error");
  }
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.revalidated.length, 0);
});

test("toggle: a task outside the project is reported as missing; database errors stay generic", async () => {
  const missing = actions({ setTaskCompleted: async () => null });
  const state = await missing.toggleTaskAction(projectId, taskId, true);
  assert.equal(state.status, "error");
  if (state.status === "error") assert.equal(state.taskMissing, true);
  assert.deepEqual([...missing.revalidated], [`/projects/${projectId}`]);

  const failing = actions({ setTaskCompleted: async () => { throw new Error("private detail"); } });
  const failed = await failing.toggleTaskAction(projectId, taskId, true);
  assert.equal(failed.status, "error");
  if (failed.status === "error") {
    assert.doesNotMatch(failed.message, /private/);
    assert.equal(failed.taskMissing, undefined);
  }
  assert.equal(failing.revalidated.length, 0);
});

test("data: lists only the project's tasks ordered by position and creation", async () => {
  const rows = [{ id: taskId }];
  const db = dataLayer({ data: rows });
  assert.equal(await db.listTasks(projectId), rows);
  const steps = db.chain.map(([method, ...args]) => [method, ...args.map((arg) => JSON.stringify(arg))]);
  assert.deepEqual(steps.slice(0, 1), [["from", '"tasks"']]);
  assert.deepEqual(steps.slice(2), [
    ["eq", '"project_id"', JSON.stringify(projectId)],
    ["order", '"position"', '{"ascending":true}'],
    ["order", '"created_at"', '{"ascending":true}'],
  ]);
  assert.equal((await dataLayer({ data: null }).listTasks(projectId)).length, 0);
  await assert.rejects(dataLayer({ error: { code: "42501" } }).listTasks(projectId), /Could not load tasks/);
});

test("data: create inserts the project id and maps a missing project to false", async () => {
  const db = dataLayer({});
  assert.equal(await db.createTask(projectId, "Task"), true);
  assert.equal(JSON.stringify(db.chain), JSON.stringify([["from", "tasks"], ["insert", { project_id: projectId, title: "Task" }]]));
  assert.equal(await dataLayer({ error: { code: "23503" } }).createTask(projectId, "Task"), false);
  await assert.rejects(dataLayer({ error: { code: "42501" } }).createTask(projectId, "Task"), /Could not create task/);
});

test("data: update filters by task id and project id", async () => {
  const db = dataLayer({ data: { id: taskId } });
  assert.deepEqual({ ...(await db.setTaskCompleted(projectId, taskId, true) as object) }, { id: taskId });
  assert.equal(JSON.stringify(db.chain), JSON.stringify([
    ["from", "tasks"],
    ["update", { completed: true }],
    ["eq", "id", taskId],
    ["eq", "project_id", projectId],
    ["select", "id"],
    ["maybeSingle"],
  ]));
  assert.equal(await dataLayer({ data: null }).setTaskCompleted(projectId, taskId, true), null);
  await assert.rejects(dataLayer({ error: { code: "42501" } }).setTaskCompleted(projectId, taskId, true), /Could not update task/);
});

test("edit: saves the trimmed title for the task of that project", async () => {
  const harness = actions({ updateTaskTitle: async () => ({ id: taskId }) });
  const state = await harness.updateTaskTitleAction(projectId, taskId, { status: "idle" }, titleForm("  Renamed  "));
  assert.deepEqual({ ...state }, { status: "success" });
  assert.deepEqual(harness.calls.map((call) => [...call]), [["updateTaskTitle", projectId, taskId, "Renamed"]]);
  assert.deepEqual([...harness.revalidated], [`/projects/${projectId}`]);
});

test("edit: blank, too long or missing titles keep the entered text and never reach the database", async () => {
  const harness = actions({});
  const long = "x".repeat(taskInput.TASK_TITLE_MAX_LENGTH + 1);
  for (const [title, expected] of [["   ", "   "], [long, long], [undefined, ""]] as const) {
    const state = await harness.updateTaskTitleAction(projectId, taskId, { status: "idle" }, titleForm(title));
    assert.equal(state.status, "error");
    if (state.status === "error") {
      assert.equal(state.invalidTitle, true);
      assert.equal(state.title, expected);
    }
  }
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.revalidated.length, 0);
});

test("edit and delete: invalid project or task ids never reach the database", async () => {
  const harness = actions({});
  for (const id of invalidIds) {
    for (const [p, t] of [[id, taskId], [projectId, id]]) {
      const edited = await harness.updateTaskTitleAction(p, t, { status: "idle" }, titleForm("Task"));
      assert.equal(edited.status, "error");
      if (edited.status === "error") {
        assert.equal(edited.message, "Tarea inválida.");
        assert.equal(edited.title, "Task");
      }
      const deleted = await harness.deleteTaskAction(p, t);
      assert.equal(deleted.status, "error");
      if (deleted.status === "error") assert.equal(deleted.message, "Tarea inválida.");
    }
  }
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.revalidated.length, 0);
});

test("edit: a missing task or one from another project is reported and refreshes the list", async () => {
  const harness = actions({ updateTaskTitle: async () => null });
  const state = await harness.updateTaskTitleAction(projectId, taskId, { status: "idle" }, titleForm("Task"));
  assert.equal(state.status, "error");
  if (state.status === "error") {
    assert.equal(state.taskMissing, true);
    assert.equal(state.title, "Task");
  }
  assert.deepEqual([...harness.revalidated], [`/projects/${projectId}`]);
});

test("edit: database errors are generic and keep the entered text", async () => {
  const harness = actions({ updateTaskTitle: async () => { throw new Error("private detail"); } });
  const state = await harness.updateTaskTitleAction(projectId, taskId, { status: "idle" }, titleForm(" Kept "));
  assert.equal(state.status, "error");
  if (state.status === "error") {
    assert.doesNotMatch(state.message, /private/);
    assert.equal(state.title, "Kept");
    assert.equal(state.taskMissing, undefined);
  }
  assert.equal(harness.revalidated.length, 0);
});

test("delete: removes the task of that project and refreshes its page", async () => {
  const harness = actions({ deleteTask: async () => ({ id: taskId }) });
  const state = await harness.deleteTaskAction(projectId, taskId);
  assert.deepEqual({ ...state }, { status: "success", message: "Tarea eliminada." });
  assert.deepEqual(harness.calls.map((call) => [...call]), [["deleteTask", projectId, taskId]]);
  assert.deepEqual([...harness.revalidated], [`/projects/${projectId}`]);
});

test("delete: a missing task or one from another project is reported; database errors stay generic", async () => {
  const missing = actions({ deleteTask: async () => null });
  const state = await missing.deleteTaskAction(projectId, taskId);
  assert.equal(state.status, "error");
  if (state.status === "error") assert.equal(state.taskMissing, true);
  assert.deepEqual([...missing.revalidated], [`/projects/${projectId}`]);

  const failing = actions({ deleteTask: async () => { throw new Error("private detail"); } });
  const failed = await failing.deleteTaskAction(projectId, taskId);
  assert.equal(failed.status, "error");
  if (failed.status === "error") {
    assert.doesNotMatch(failed.message, /private/);
    assert.equal(failed.taskMissing, undefined);
  }
  assert.equal(failing.revalidated.length, 0);
});

test("data: editing writes only the title, so completed is preserved", async () => {
  const db = dataLayer({ data: { id: taskId } });
  assert.deepEqual({ ...(await db.updateTaskTitle(projectId, taskId, "Renamed") as object) }, { id: taskId });
  assert.equal(JSON.stringify(db.chain), JSON.stringify([
    ["from", "tasks"],
    ["update", { title: "Renamed" }],
    ["eq", "id", taskId],
    ["eq", "project_id", projectId],
    ["select", "id"],
    ["maybeSingle"],
  ]));
  assert.equal(await dataLayer({ data: null }).updateTaskTitle(projectId, taskId, "x"), null);
  await assert.rejects(dataLayer({ error: { code: "42501" } }).updateTaskTitle(projectId, taskId, "x"), /Could not update task/);
});

test("data: deleting filters by task id and project id", async () => {
  const db = dataLayer({ data: { id: taskId } });
  assert.deepEqual({ ...(await db.deleteTask(projectId, taskId) as object) }, { id: taskId });
  assert.equal(JSON.stringify(db.chain), JSON.stringify([
    ["from", "tasks"],
    ["delete"],
    ["eq", "id", taskId],
    ["eq", "project_id", projectId],
    ["select", "id"],
    ["maybeSingle"],
  ]));
  assert.equal(await dataLayer({ data: null }).deleteTask(projectId, taskId), null);
  await assert.rejects(dataLayer({ error: { code: "42501" } }).deleteTask(projectId, taskId), /Could not delete task/);
});

test("counters: pending and completed tasks", () => {
  assert.deepEqual({ ...taskInput.countTasks([]) }, { pending: 0, completed: 0 });
  const tasks = [{ completed: true }, { completed: false }, { completed: false }];
  assert.deepEqual({ ...taskInput.countTasks(tasks) }, { pending: 2, completed: 1 });
  assert.deepEqual({ ...taskInput.countTasks(tasks.slice(1)) }, { pending: 2, completed: 0 });
  assert.deepEqual({ ...taskInput.countTasks(tasks.map(() => ({ completed: true }))) }, { pending: 0, completed: 3 });
});
