import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as input from "../src/lib/project-input.ts";

const id = "123e4567-e89b-12d3-a456-426614174000";
const version = "2026-10-12T12:00:00Z";
const code = ts.transpileModule(
  readFileSync(new URL("../src/app/actions.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

// Exercise the real action with isolated Next/Supabase boundaries, without a database.
function actionHarness(update: (id: string, data: input.CreateProjectInput) => Promise<unknown>) {
  const revalidated: string[] = [];
  const exports: { updateProjectAction?: (
    id: string, version: string, state: input.CreateProjectState, form: FormData,
  ) => Promise<input.CreateProjectState> } = {};
  runInNewContext(code, {
    exports,
    require(name: string) {
      if (name === "next/cache") return { revalidatePath: (path: string) => revalidated.push(path) };
      if (name === "@/lib/project-input") return input;
      if (name === "@/lib/projects") return { updateProject: update };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  assert.ok(exports.updateProjectAction);
  return { run: exports.updateProjectAction, revalidated };
}

function form(name = "  Dashboard  ") {
  const data = new FormData();
  data.set("name", name);
  data.set("manual_progress", "005");
  return data;
}

test("missing project returns an error and invalidates the dashboard", async () => {
  const harness = actionHarness(async () => null);
  const state = await harness.run(id, version, { status: "idle" }, form());
  assert.equal(state.status, "error");
  if (state.status === "error") {
    assert.match(state.message, /ya no existe/);
    assert.equal(state.projectMissing, true);
  }
  assert.deepEqual(harness.revalidated, [`/projects/${id}`, "/"]);
});

test("success returns the normalized saved row and its version", async () => {
  const savedVersion = "2026-10-12T13:00:00Z";
  const harness = actionHarness(async (projectId, data) => {
    assert.equal(projectId, id);
    assert.equal(data.name, "Dashboard");
    assert.equal(data.manual_progress, 5);
    return { ...data, name: "Server result", updated_at: savedVersion };
  });
  const state = await harness.run(id, version, { status: "idle" }, form());
  assert.equal(state.status, "success");
  if (state.status === "success") {
    assert.equal(state.values?.name, "Server result");
    assert.equal(state.values?.manual_progress, "5");
    assert.equal(state.values?.status, "active");
    assert.equal(state.projectVersion, savedVersion);
  }
  assert.deepEqual(harness.revalidated, [`/projects/${id}`, "/"]);
});

test("validation errors preserve exact input and never call the database", async () => {
  const harness = actionHarness(async () => { assert.fail("Unexpected database call"); });
  const data = form("   ");
  data.set("notes", "  keep whitespace\n");
  const state = await harness.run(id, version, { status: "idle" }, data);
  assert.equal(state.status, "error");
  if (state.status === "error") {
    assert.equal(state.values.name, "   ");
    assert.equal(state.values.notes, "  keep whitespace\n");
    assert.equal(state.projectVersion, version);
  }
  assert.deepEqual(harness.revalidated, []);
});

test("database failure returns a generic error without invalidating", async () => {
  const harness = actionHarness(async () => { throw new Error("private database detail"); });
  const state = await harness.run(id, version, { status: "idle" }, form());
  assert.equal(state.status, "error");
  if (state.status === "error") assert.doesNotMatch(state.message, /private/);
  assert.deepEqual(harness.revalidated, []);
});
