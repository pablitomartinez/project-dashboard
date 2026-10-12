import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as input from "../src/lib/project-input.ts";

const id = "123e4567-e89b-12d3-a456-426614174000";
const code = ts.transpileModule(
  readFileSync(new URL("../src/app/actions.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

// Exercise the real action with isolated Next/Supabase boundaries, without a database.
function actionHarness(remove: (id: string) => Promise<{ name: string } | null>) {
  const revalidated: string[] = [];
  const calls: string[] = [];
  const exports: { deleteProjectAction?: (id: unknown) => Promise<input.DeleteProjectState> } = {};
  runInNewContext(code, {
    exports,
    require(name: string) {
      if (name === "next/cache") return { revalidatePath: (path: string) => revalidated.push(path) };
      if (name === "@/lib/project-input") return input;
      if (name === "@/lib/projects") {
        return {
          deleteProject: (projectId: string) => {
            calls.push(projectId);
            return remove(projectId);
          },
        };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  assert.ok(exports.deleteProjectAction);
  return { run: exports.deleteProjectAction, revalidated, calls };
}

test("delete: removes the project and refreshes the dashboard", async () => {
  const harness = actionHarness(async () => ({ name: "Dashboard" }));
  const state = await harness.run(id);
  assert.deepEqual({ ...state }, { status: "success", message: 'Proyecto "Dashboard" eliminado.' });
  assert.deepEqual(harness.calls, [id]);
  assert.deepEqual(harness.revalidated, ["/"]);
});

test("delete: invalid ids never reach the database", async () => {
  const harness = actionHarness(async () => assert.fail("Unexpected database call"));
  for (const value of [undefined, null, "", "not-a-uuid", `${id} `, `${id}' or '1'='1`, 123, { id }]) {
    const state = await harness.run(value);
    assert.deepEqual({ ...state }, { status: "error", message: "Proyecto inválido." });
  }
  assert.deepEqual(harness.calls, []);
  assert.deepEqual(harness.revalidated, []);
});

test("delete: missing project is reported and the stale card is refreshed away", async () => {
  const harness = actionHarness(async () => null);
  const state = await harness.run(id);
  assert.equal(state.status, "error");
  if (state.status === "error") {
    assert.match(state.message, /ya no existe/);
    assert.equal(state.projectMissing, true);
  }
  assert.deepEqual(harness.revalidated, ["/"]);
});

test("delete: database failure returns a generic error without refreshing", async () => {
  const harness = actionHarness(async () => {
    throw new Error("private database detail");
  });
  const state = await harness.run(id);
  assert.equal(state.status, "error");
  if (state.status === "error") {
    assert.doesNotMatch(state.message, /private/);
    assert.equal(state.projectMissing, undefined);
  }
  assert.deepEqual(harness.revalidated, []);
});
