import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCreateProjectInput } from "../src/lib/project-input.ts";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

test("only name: applies defaults and nulls optional fields", () => {
  const result = parseCreateProjectInput(form({ name: "  Dashboard  " }));
  assert.equal(result.success, true);
  assert.deepEqual(result.success && result.data, {
      name: "Dashboard",
      description: null,
      status: "active",
      progress_mode: "manual",
      manual_progress: 0,
      local_path: null,
      repository_url: null,
      production_url: null,
      branch: null,
      stack: null,
      notes: null,
  });
});

test("all fields valid", () => {
  const result = parseCreateProjectInput(
    form({
      name: "Portfolio",
      description: "Sitio personal",
      status: "paused",
      manual_progress: "45",
      local_path: "C:\\proyectos\\cv-26",
      repository_url: "https://github.com/pablitomartinez/cv-26",
      production_url: "http://example.com",
      branch: "develop",
      stack: "React, Vite",
      notes: "Retomar el hero",
    }),
  );
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.status, "paused");
    assert.equal(result.data.manual_progress, 45);
    assert.equal(result.data.local_path, "C:\\proyectos\\cv-26");
  }
});

test("missing or blank name is rejected and values are kept", () => {
  const result = parseCreateProjectInput(form({ name: "   ", stack: "Next" }));
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.fieldErrors.name);
    assert.equal(result.values.stack, "Next");
  }
  assert.equal(parseCreateProjectInput(new FormData()).success, false);
});

test("invalid status is rejected", () => {
  const result = parseCreateProjectInput(form({ name: "x", status: "archived" }));
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.fieldErrors.status);
});

for (const progress of ["-1", "101", "4.5", "abc", "1e2"]) {
  test(`manual_progress "${progress}" is rejected`, () => {
    const result = parseCreateProjectInput(form({ name: "x", manual_progress: progress }));
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.fieldErrors.manual_progress);
  });
}

test("manual_progress bounds 0 and 100 are accepted", () => {
  for (const progress of ["0", "100"]) {
    const result = parseCreateProjectInput(form({ name: "x", manual_progress: progress }));
    assert.equal(result.success, true);
  }
});

for (const url of ["github.com/x/y", "javascript:alert(1)", "ftp://host/file"]) {
  test(`URL "${url}" is rejected`, () => {
    const result = parseCreateProjectInput(
      form({ name: "x", repository_url: url, production_url: url }),
    );
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.fieldErrors.repository_url);
      assert.ok(result.fieldErrors.production_url);
    }
  });
}

test("too long values are rejected", () => {
  const result = parseCreateProjectInput(
    form({ name: "a".repeat(121), notes: "n".repeat(5001) }),
  );
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.fieldErrors.name);
    assert.ok(result.fieldErrors.notes);
  }
});

test("non-string entries are ignored", () => {
  const data = form({ name: "x" });
  data.set("notes", new Blob(["file"]), "notes.txt");
  const result = parseCreateProjectInput(data);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.notes, null);
});
