// Pure validation for project forms. No server-only imports, so it can be shared
// with Client Components and tested with `node --test`.

export const PROJECT_STATUSES = ["active", "paused", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Activo",
  paused: "Pausado",
  completed: "Terminado",
};

export const CREATE_PROJECT_FIELDS = [
  "name",
  "description",
  "status",
  "manual_progress",
  "local_path",
  "repository_url",
  "production_url",
  "branch",
  "stack",
  "notes",
] as const;
export type CreateProjectField = (typeof CREATE_PROJECT_FIELDS)[number];

export type CreateProjectInput = {
  name: string;
  description: string | null;
  status: ProjectStatus;
  manual_progress: number;
  local_path: string | null;
  repository_url: string | null;
  production_url: string | null;
  branch: string | null;
  stack: string | null;
  notes: string | null;
};

export type CreateProjectValues = Record<CreateProjectField, string>;
export type CreateProjectFieldErrors = Partial<Record<CreateProjectField, string>>;

export type CreateProjectState =
  | { status: "idle" }
  | { status: "success"; message: string; values?: CreateProjectValues; projectVersion?: string }
  | {
      status: "error";
      message: string;
      fieldErrors: CreateProjectFieldErrors;
      values: CreateProjectValues;
      projectVersion?: string;
      projectMissing?: boolean;
    };

export type ParseCreateProjectResult =
  | { success: true; data: CreateProjectInput; values: CreateProjectValues }
  | {
      success: false;
      fieldErrors: CreateProjectFieldErrors;
      values: CreateProjectValues;
    };

const MAX_LENGTH: Record<CreateProjectField, number> = {
  name: 120,
  description: 500,
  status: 20,
  manual_progress: 3,
  local_path: 500,
  repository_url: 2000,
  production_url: 2000,
  branch: 200,
  stack: 300,
  notes: 5000,
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isProjectStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value);
}

export function isProjectId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function projectInputValues(input: CreateProjectInput): CreateProjectValues {
  return Object.fromEntries(
    CREATE_PROJECT_FIELDS.map((field) => [field, String(input[field] ?? "")]),
  ) as CreateProjectValues;
}

// A response from an older snapshot must not mask newly received project data.
export function projectFormState(
  state: CreateProjectState,
  projectVersion: string,
): CreateProjectState {
  return state.status === "idle" || state.projectVersion === projectVersion
    ? state
    : { status: "idle" };
}

export function parseCreateProjectInput(
  formData: FormData,
): ParseCreateProjectResult {
  const values = {} as CreateProjectValues;
  const enteredValues = {} as CreateProjectValues;
  for (const field of CREATE_PROJECT_FIELDS) {
    const raw = formData.get(field);
    enteredValues[field] = typeof raw === "string" ? raw : "";
    values[field] = typeof raw === "string" ? raw.trim() : "";
  }

  const fieldErrors: CreateProjectFieldErrors = {};

  for (const field of CREATE_PROJECT_FIELDS) {
    if (values[field].length > MAX_LENGTH[field]) {
      fieldErrors[field] = `Máximo ${MAX_LENGTH[field]} caracteres.`;
    }
  }

  if (!values.name) {
    fieldErrors.name = "El nombre es obligatorio.";
  }

  const status = values.status || "active";
  if (!isProjectStatus(status)) {
    fieldErrors.status = "Estado inválido.";
  }

  let manualProgress = 0;
  if (values.manual_progress) {
    manualProgress = Number(values.manual_progress);
    if (
      !/^\d+$/.test(values.manual_progress) ||
      manualProgress < 0 ||
      manualProgress > 100
    ) {
      fieldErrors.manual_progress = "Ingresá un número entero entre 0 y 100.";
    }
  }

  for (const field of ["repository_url", "production_url"] as const) {
    if (values[field] && !fieldErrors[field] && !isHttpUrl(values[field])) {
      fieldErrors[field] = "Ingresá una URL que empiece con http:// o https://.";
    }
  }

  if (Object.keys(fieldErrors).length > 0 || !isProjectStatus(status)) {
    return { success: false, fieldErrors, values: enteredValues };
  }

  const optional = (field: CreateProjectField) => values[field] || null;

  return {
    success: true,
    values,
    data: {
      name: values.name,
      description: optional("description"),
      status,
      manual_progress: manualProgress,
      local_path: optional("local_path"),
      repository_url: optional("repository_url"),
      production_url: optional("production_url"),
      branch: optional("branch"),
      stack: optional("stack"),
      notes: optional("notes"),
    },
  };
}
