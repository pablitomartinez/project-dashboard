// Pure validation for project resource forms. No server-only imports, so it can
// be shared with Client Components and tested with `node --test`.

export const RESOURCE_LABEL_MAX_LENGTH = 120;
export const RESOURCE_URL_MAX_LENGTH = 2000;

export const RESOURCE_FIELDS = ["label", "url"] as const;
export type ResourceField = (typeof RESOURCE_FIELDS)[number];
export type ResourceInput = { label: string; url: string };
export type ResourceValues = Record<ResourceField, string>;
export type ResourceFieldErrors = Partial<Record<ResourceField, string>>;

export type ResourceFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      values: ResourceValues;
      fieldErrors: ResourceFieldErrors;
      projectMissing?: boolean;
      resourceMissing?: boolean;
    };

export type DeleteResourceState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; resourceMissing?: boolean };

export type ParseResourceResult =
  | { success: true; data: ResourceInput; values: ResourceValues }
  | { success: false; fieldErrors: ResourceFieldErrors; values: ResourceValues };

// Absolute http(s) URLs only. The explicit `//` matches the database check and
// rejects forms like `https:example.com`; javascript:, data: and others fail.
export function isAllowedResourceUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value) || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}

export function parseResourceInput(formData: FormData): ParseResourceResult {
  const values = {} as ResourceValues;
  for (const field of RESOURCE_FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === "string" ? raw : "";
  }
  const label = values.label.trim();
  const url = values.url.trim();
  const fieldErrors: ResourceFieldErrors = {};

  if (!label) fieldErrors.label = "El nombre es obligatorio.";
  else if (label.length > RESOURCE_LABEL_MAX_LENGTH) {
    fieldErrors.label = `Máximo ${RESOURCE_LABEL_MAX_LENGTH} caracteres.`;
  }

  if (!url) fieldErrors.url = "La URL es obligatoria.";
  else if (url.length > RESOURCE_URL_MAX_LENGTH) {
    fieldErrors.url = `Máximo ${RESOURCE_URL_MAX_LENGTH} caracteres.`;
  } else if (!isAllowedResourceUrl(url)) {
    fieldErrors.url = "Ingresá una URL completa que empiece con http:// o https://.";
  }

  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors, values };
  return { success: true, data: { label, url }, values };
}
