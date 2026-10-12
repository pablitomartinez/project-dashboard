import assert from "node:assert/strict";
import { test } from "node:test";
import { isProjectId, projectInputValues, parseCreateProjectInput } from "../src/lib/project-input.ts";

test("edit: validates project identifiers before updating", () => {
  assert.equal(isProjectId("123e4567-e89b-12d3-a456-426614174000"), true);
  for (const id of [undefined, null, "", "not-a-uuid", "123e4567-e89b-12d3-a456-426614174000 extra", new Blob()]) {
    assert.equal(isProjectId(id), false);
  }
});

test("edit: prefilled values round-trip, including null fields and zero progress", () => {
  const input = {
    name: "Dashboard", description: null, status: "paused" as const,
    manual_progress: 0, local_path: "C:\\projects", repository_url: "https://github.com/example/repo",
    production_url: null, branch: "develop", stack: "Next.js", notes: "Pending work",
  };
  const values = projectInputValues(input);
  assert.equal(values.description, "");
  assert.equal(values.manual_progress, "0");
  const form = new FormData();
  for (const [field, value] of Object.entries(values)) form.set(field, value);
  form.set("id", "ignored");
  form.set("progress_mode", "tasks");
  const result = parseCreateProjectInput(form);
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data, input);
});

test("edit: invalid updates preserve entered values", () => {
  const form = new FormData();
  form.set("name", "");
  form.set("description", "Keep this text");
  form.set("manual_progress", "101");
  const result = parseCreateProjectInput(form);
  assert.equal(result.success, false);
  assert.equal(result.values.description, "Keep this text");
  assert.equal(result.values.manual_progress, "101");
});
