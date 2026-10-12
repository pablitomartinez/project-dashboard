import {
  RESOURCE_LABEL_MAX_LENGTH,
  RESOURCE_URL_MAX_LENGTH,
  type ResourceField,
  type ResourceFormState,
  type ResourceValues,
} from "@/lib/resource-input";

const inputClass =
  "w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm aria-invalid:border-red-500 dark:border-zinc-700 dark:bg-zinc-950";

const FIELDS: { name: ResourceField; label: string; type: string; maxLength: number; placeholder?: string }[] = [
  { name: "label", label: "Nombre", type: "text", maxLength: RESOURCE_LABEL_MAX_LENGTH },
  { name: "url", label: "URL", type: "url", maxLength: RESOURCE_URL_MAX_LENGTH, placeholder: "https://..." },
];

// Shared by the create and edit forms. After a failed submit the entered values
// are restored; otherwise `initial` is used.
export function ResourceFields({
  idPrefix,
  state,
  initial,
}: {
  idPrefix: string;
  state: ResourceFormState;
  initial: ResourceValues;
}) {
  const values = state.status === "error" ? state.values : initial;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FIELDS.map(({ name, label, type, maxLength, placeholder }) => {
        const id = `${idPrefix}-${name}`;
        const error = state.status === "error" ? state.fieldErrors[name] : undefined;
        return (
          <div key={name} className="flex min-w-0 flex-col gap-1">
            <label htmlFor={id} className="text-sm font-medium">
              {label} *
            </label>
            <input
              key={values[name]}
              id={id}
              name={name}
              type={type}
              required
              maxLength={maxLength}
              placeholder={placeholder}
              defaultValue={values[name]}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : undefined}
              className={inputClass}
            />
            {error && (
              <p id={`${id}-error`} className="text-xs text-red-700 dark:text-red-400">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
