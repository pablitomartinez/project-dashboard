import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as projectInput from "../src/lib/project-input.ts";
import * as resourceInput from "../src/lib/resource-input.ts";

const projectId = "123e4567-e89b-12d3-a456-426614174000";
const resourceId = "323e4567-e89b-12d3-a456-426614174000";
const invalidIds = [undefined, null, "", "not-a-uuid", `${projectId} `, "' or 1=1 --", 42, {}];
const valid = { label: "Supabase", url: "https://supabase.com/dashboard/project/abc" };

function load(path: string, modules: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(code, {
    exports,
    URL,
    console: { error() {} },
    require(name: string) {
      if (name in modules) return modules[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

type Resources = {
  listResources: (projectId: string) => Promise<unknown[]>;
  createResource: (projectId: string, input: resourceInput.ResourceInput) => Promise<boolean>;
  updateResource: (projectId: string, resourceId: string, input: resourceInput.ResourceInput) => Promise<unknown>;
  deleteResource: (projectId: string, resourceId: string) => Promise<unknown>;
};

// Runs the real Server Actions with Next and the data layer replaced.
function actions(resources: Partial<Resources>) {
  const revalidated: string[] = [];
  const calls: unknown[][] = [];
  const record = (name: keyof Resources) => (...args: unknown[]) => {
    calls.push([name, ...args]);
    const fn = resources[name] as ((...a: unknown[]) => Promise<unknown>) | undefined;
    if (!fn) assert.fail(`Unexpected call to ${name}`);
    return fn(...args);
  };
  const exports = load("../src/app/resource-actions.ts", {
    "next/cache": { revalidatePath: (path: string) => revalidated.push(path) },
    "@/lib/project-input": projectInput,
    "@/lib/resource-input": resourceInput,
    "@/lib/resources": Object.fromEntries(
      (["createResource", "updateResource", "deleteResource"] as const).map((name) => [name, record(name)]),
    ),
  }) as {
    createResourceAction: (id: unknown, state: resourceInput.ResourceFormState, form: FormData) => Promise<resourceInput.ResourceFormState>;
    updateResourceAction: (projectId: unknown, resourceId: unknown, state: resourceInput.ResourceFormState, form: FormData) => Promise<resourceInput.ResourceFormState>;
    deleteResourceAction: (projectId: unknown, resourceId: unknown) => Promise<resourceInput.DeleteResourceState>;
  };
  return { ...exports, revalidated, calls };
}

// Records the Supabase query chain and resolves it with `result`.
function dataLayer(result: { data?: unknown; error?: { code: string; message?: string } | null }) {
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
  const exports = load("../src/lib/resources.ts", {
    "server-only": {},
    "@/lib/supabase/server": { getSupabaseServerClient: () => builder },
  }) as Resources;
  return { ...exports, chain };
}

const idle: resourceInput.ResourceFormState = { status: "idle" };

test("validation: accepts http and https absolute URLs and trims values", () => {
  for (const url of ["http://localhost:3000", "https://example.com", "HTTPS://Example.com/a?b=1#c"]) {
    const result = resourceInput.parseResourceInput(form({ label: "  Docs  ", url: `  ${url} ` }));
    assert.equal(result.success, true, url);
    if (result.success) assert.deepEqual({ ...result.data }, { label: "Docs", url });
  }
});

test("validation: label is required and cannot be only spaces", () => {
  for (const label of ["", "   ", "\n\t"]) {
    const result = resourceInput.parseResourceInput(form({ label, url: valid.url }));
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.fieldErrors.label, "El nombre es obligatorio.");
  }
  const missing = resourceInput.parseResourceInput(form({ url: valid.url }));
  assert.equal(missing.success, false);
  const long = resourceInput.parseResourceInput(
    form({ label: "a".repeat(resourceInput.RESOURCE_LABEL_MAX_LENGTH + 1), url: valid.url }),
  );
  assert.equal(long.success, false);
});

test("validation: URL is required, absolute and limited to http/https", () => {
  const rejected = [
    "",
    "   ",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://example.com",
    "file:///etc/passwd",
    "mailto:me@example.com",
    "vbscript:msgbox(1)",
    "//example.com",
    "/projects/1",
    "example.com",
    "https:example.com",
    "https://",
    "https://exa mple.com",
    "https://example.com/\nfoo",
    `https://example.com/${"a".repeat(resourceInput.RESOURCE_URL_MAX_LENGTH)}`,
  ];
  for (const url of rejected) {
    const result = resourceInput.parseResourceInput(form({ label: "Docs", url }));
    assert.equal(result.success, false, JSON.stringify(url));
    if (!result.success) assert.ok(result.fieldErrors.url, JSON.stringify(url));
    if (url.length <= resourceInput.RESOURCE_URL_MAX_LENGTH) {
      assert.equal(resourceInput.isAllowedResourceUrl(url.trim()), false, JSON.stringify(url));
    }
  }
});

test("validation: errors keep the entered values", () => {
  const result = resourceInput.parseResourceInput(form({ label: "  ", url: "javascript:x" }));
  assert.equal(result.success, false);
  assert.deepEqual({ ...result.values }, { label: "  ", url: "javascript:x" });
});

test("data layer: lists resources filtered by project", async () => {
  const empty = dataLayer({ data: [] });
  assert.equal(JSON.stringify(await empty.listResources(projectId)), "[]");
  assert.equal(JSON.stringify(empty.chain), JSON.stringify([
    ["from", "project_resources"],
    ["select", "id, project_id, label, url, created_at, updated_at"],
    ["eq", "project_id", projectId],
    ["order", "created_at", { ascending: true }],
    ["order", "id", { ascending: true }],
  ]));
  const rows = [{ id: resourceId, project_id: projectId, ...valid }];
  assert.deepEqual(await dataLayer({ data: rows }).listResources(projectId), rows);
  assert.equal(JSON.stringify(await dataLayer({ data: null }).listResources(projectId)), "[]");
});

test("data layer: creates with project_id, label and url only", async () => {
  const db = dataLayer({});
  assert.equal(await db.createResource(projectId, valid), true);
  assert.equal(JSON.stringify(db.chain), JSON.stringify([
    ["from", "project_resources"],
    ["insert", { project_id: projectId, label: valid.label, url: valid.url }],
  ]));
  assert.equal(await dataLayer({ error: { code: "23503" } }).createResource(projectId, valid), false);
});

test("data layer: updates only label and url, filtered by resource and project", async () => {
  const db = dataLayer({ data: { id: resourceId } });
  assert.deepEqual(await db.updateResource(projectId, resourceId, valid), { id: resourceId });
  assert.equal(JSON.stringify(db.chain), JSON.stringify([
    ["from", "project_resources"],
    ["update", { label: valid.label, url: valid.url }],
    ["eq", "id", resourceId],
    ["eq", "project_id", projectId],
    ["select", "id"],
    ["maybeSingle"],
  ]));
  assert.equal(await dataLayer({ data: null }).updateResource(projectId, resourceId, valid), null);
});

test("data layer: deletes only the selected resource of the project", async () => {
  const db = dataLayer({ data: { id: resourceId, label: "Docs" } });
  assert.deepEqual(await db.deleteResource(projectId, resourceId), { id: resourceId, label: "Docs" });
  assert.equal(JSON.stringify(db.chain), JSON.stringify([
    ["from", "project_resources"],
    ["delete"],
    ["eq", "id", resourceId],
    ["eq", "project_id", projectId],
    ["select", "id, label"],
    ["maybeSingle"],
  ]));
  assert.equal(await dataLayer({ data: null }).deleteResource(projectId, resourceId), null);
});

test("data layer: Supabase errors become generic errors", async () => {
  const error = { code: "42501", message: "permission denied for table project_resources" };
  // Errors come from another vm realm, so check the message instead of `instanceof`.
  const generic = (pattern: RegExp) => (err: unknown) => {
    const message = String((err as { message?: unknown }).message);
    assert.match(message, pattern);
    assert.doesNotMatch(message, /permission|42501/);
    return true;
  };
  await assert.rejects(dataLayer({ error }).listResources(projectId), generic(/Could not load resources/));
  await assert.rejects(dataLayer({ error }).createResource(projectId, valid), generic(/Could not create resource/));
  await assert.rejects(dataLayer({ error }).updateResource(projectId, resourceId, valid), generic(/Could not update resource/));
  await assert.rejects(dataLayer({ error }).deleteResource(projectId, resourceId), generic(/Could not delete resource/));
});

test("create action: valid input inserts and revalidates the project page", async () => {
  const run = actions({ createResource: async () => true });
  const result = await run.createResourceAction(projectId, idle, form({ label: " Docs ", url: valid.url }));
  assert.deepEqual({ ...result }, { status: "success", message: "Recurso agregado." });
  assert.deepEqual(JSON.parse(JSON.stringify(run.calls)), [["createResource", projectId, { label: "Docs", url: valid.url }]]);
  assert.deepEqual(run.revalidated, [`/projects/${projectId}`]);
});

test("create action: invalid input or project id never reaches Supabase", async () => {
  const run = actions({});
  const invalid = await run.createResourceAction(projectId, idle, form({ label: " ", url: "data:text/html,x" }));
  assert.equal(invalid.status, "error");
  if (invalid.status === "error") {
    assert.ok(invalid.fieldErrors.label);
    assert.ok(invalid.fieldErrors.url);
    assert.deepEqual({ ...invalid.values }, { label: " ", url: "data:text/html,x" });
  }
  for (const id of invalidIds) {
    const result = await run.createResourceAction(id, idle, form(valid));
    assert.equal(result.status, "error");
    if (result.status === "error") assert.equal(result.message, "Proyecto inválido.");
  }
  assert.deepEqual(run.calls, []);
  assert.deepEqual(run.revalidated, []);
});

test("create action: missing project and database errors", async () => {
  const missing = await actions({ createResource: async () => false })
    .createResourceAction(projectId, idle, form(valid));
  assert.equal(missing.status, "error");
  if (missing.status === "error") assert.equal(missing.projectMissing, true);

  const run = actions({ createResource: async () => { throw new Error("Could not create resource."); } });
  const failed = await run.createResourceAction(projectId, idle, form(valid));
  assert.equal(failed.status, "error");
  if (failed.status === "error") {
    assert.match(failed.message, /No se pudo agregar el recurso/);
    assert.deepEqual({ ...failed.values }, valid);
  }
  assert.deepEqual(run.revalidated, []);
});

test("update action: saves label and url filtered by both ids", async () => {
  const run = actions({ updateResource: async () => ({ id: resourceId }) });
  const result = await run.updateResourceAction(
    projectId,
    resourceId,
    idle,
    form({ ...valid, type: "github", account: "me@example.com", project_id: "other" }),
  );
  assert.equal(result.status, "success");
  assert.deepEqual(JSON.parse(JSON.stringify(run.calls)), [["updateResource", projectId, resourceId, valid]]);
  assert.deepEqual(run.revalidated, [`/projects/${projectId}`]);
});

test("update action: invalid ids or fields never reach Supabase", async () => {
  const run = actions({});
  for (const id of invalidIds) {
    assert.equal((await run.updateResourceAction(id, resourceId, idle, form(valid))).status, "error");
    assert.equal((await run.updateResourceAction(projectId, id, idle, form(valid))).status, "error");
  }
  const invalid = await run.updateResourceAction(projectId, resourceId, idle, form({ label: "Docs", url: "javascript:alert(1)" }));
  assert.equal(invalid.status, "error");
  if (invalid.status === "error") assert.ok(invalid.fieldErrors.url);
  assert.deepEqual(run.calls, []);
  assert.deepEqual(run.revalidated, []);
});

test("update action: resource of another project or missing, and database errors", async () => {
  const missing = actions({ updateResource: async () => null });
  const result = await missing.updateResourceAction(projectId, resourceId, idle, form(valid));
  assert.equal(result.status, "error");
  if (result.status === "error") assert.equal(result.resourceMissing, true);
  assert.deepEqual(missing.revalidated, [`/projects/${projectId}`]);

  const failing = actions({ updateResource: async () => { throw new Error("Could not update resource."); } });
  const failed = await failing.updateResourceAction(projectId, resourceId, idle, form(valid));
  assert.equal(failed.status, "error");
  if (failed.status === "error") {
    assert.match(failed.message, /No se pudo guardar el recurso/);
    assert.deepEqual({ ...failed.values }, valid);
  }
  assert.deepEqual(failing.revalidated, []);
});

test("delete action: deletes the selected resource and revalidates", async () => {
  const run = actions({ deleteResource: async () => ({ id: resourceId, label: "Docs" }) });
  const result = await run.deleteResourceAction(projectId, resourceId);
  assert.deepEqual({ ...result }, { status: "success", message: 'Recurso "Docs" eliminado.' });
  assert.deepEqual(run.calls, [["deleteResource", projectId, resourceId]]);
  assert.deepEqual(run.revalidated, [`/projects/${projectId}`]);
});

test("delete action: invalid ids, missing resource and database errors", async () => {
  const run = actions({});
  for (const id of invalidIds) {
    assert.equal((await run.deleteResourceAction(id, resourceId)).status, "error");
    assert.equal((await run.deleteResourceAction(projectId, id)).status, "error");
  }
  assert.deepEqual(run.calls, []);

  const missing = await actions({ deleteResource: async () => null }).deleteResourceAction(projectId, resourceId);
  assert.equal(missing.status, "error");
  if (missing.status === "error") assert.equal(missing.resourceMissing, true);

  const failing = actions({ deleteResource: async () => { throw new Error("Could not delete resource."); } });
  const failed = await failing.deleteResourceAction(projectId, resourceId);
  assert.equal(failed.status, "error");
  if (failed.status === "error") assert.match(failed.message, /No se pudo eliminar el recurso/);
  assert.deepEqual(failing.revalidated, []);
});

test("submit guard: blocks a second submit until the action settles", () => {
  const refs: { current: unknown }[] = [];
  let refIndex = 0;
  const react = {
    useRef(initial: unknown) {
      refs[refIndex] ??= { current: initial };
      return refs[refIndex++];
    },
    useEffect(effect: () => void) {
      effect();
    },
  };
  // Renamed so the hook can be driven outside a component with mocked React.
  const { useSubmitGuard: submitGuard } = load("../src/app/projects/[id]/use-submit-guard.ts", { react }) as {
    useSubmitGuard: (pending: boolean) => (event: { preventDefault: () => void }) => void;
  };
  const render = (pending: boolean) => {
    refIndex = 0;
    return submitGuard(pending);
  };
  const submit = (handler: ReturnType<typeof render>) => {
    let prevented = false;
    handler({ preventDefault: () => { prevented = true; } });
    return prevented;
  };

  const idleHandler = render(false);
  assert.equal(submit(idleHandler), false);
  assert.equal(submit(idleHandler), true, "double click before re-render");
  assert.equal(submit(render(true)), true, "while pending");
  assert.equal(submit(render(false)), false, "after the action settles");
});

test("resource UI: external links open safely and use the shared guard", () => {
  const item = readFileSync(new URL("../src/app/projects/[id]/resource-item.tsx", import.meta.url), "utf8");
  assert.match(item, /target="_blank"\s+rel="noopener noreferrer"/);
  for (const file of ["resource-item.tsx", "create-resource-form.tsx"]) {
    const source = readFileSync(new URL(`../src/app/projects/[id]/${file}`, import.meta.url), "utf8");
    assert.match(source, /useSubmitGuard\(pending\)/);
    assert.match(source, /<fieldset disabled=\{pending\}/);
    assert.doesNotMatch(source, /@\/lib\/resources"|server-only|SUPABASE/);
  }
});
