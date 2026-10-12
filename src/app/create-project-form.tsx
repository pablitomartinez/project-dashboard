"use client";

import {
  createContext, useContext, useId, useActionState, useEffect, useRef,
  type ReactNode,
} from "react";

import { createProjectAction, updateProjectAction } from "@/app/actions";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  projectInputValues,
  type CreateProjectInput,
  type CreateProjectValues,
  type CreateProjectField,
  type CreateProjectState,
} from "@/lib/project-input";

const initialState: CreateProjectState = { status: "idle" };
const FieldDefaults = createContext<{
  prefix: string;
  values?: CreateProjectValues;
}>({ prefix: "project" });

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm aria-invalid:border-red-500 dark:border-zinc-700 dark:bg-zinc-950";

type FieldProps = {
  name: CreateProjectField;
  label: string;
  state: CreateProjectState;
  className?: string;
  children: (props: {
    id: string;
    name: CreateProjectField;
    defaultValue: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
    className: string;
  }) => ReactNode;
};

function Field({ name, label, state, className, children }: FieldProps) {
  const defaults = useContext(FieldDefaults);
  const id = `${defaults.prefix}-${name}`;
  const error = state.status === "error" ? state.fieldErrors[name] : undefined;
  const defaultValue = state.status === "error"
    ? state.values[name]
    : defaults.values?.[name] ?? "";

  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        name,
        defaultValue,
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? `${id}-error` : undefined,
        className: inputClass,
      })}
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function CreateProjectForm() {
  return <ProjectForm />;
}

export function EditProjectForm({ project }: { project: CreateProjectInput & { id: string } }) {
  return <ProjectForm project={project} />;
}

function ProjectForm({ project }: { project?: CreateProjectInput & { id: string } }) {
  const prefix = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    project ? updateProjectAction.bind(null, project.id) : createProjectAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  const defaultValues = project
    ? (state.status === "success" ? state.values : undefined) ?? projectInputValues(project)
    : undefined;

  return (
    <FieldDefaults.Provider value={{ prefix, values: defaultValues }}>
    <details className={project
      ? "mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800"
      : "rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"}>
      <summary className="cursor-pointer font-medium">
        {project ? "Editar proyecto" : "Nuevo proyecto"}
      </summary>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={(event) => {
          if (pending) event.preventDefault();
        }}
        className="mt-4"
        noValidate
      >
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Nombre *" state={state} className="sm:col-span-2">
            {(props) => <input {...props} type="text" required maxLength={120} />}
          </Field>
          <Field name="description" label="Descripción" state={state} className="sm:col-span-2">
            {(props) => <textarea {...props} rows={2} maxLength={500} />}
          </Field>
          <Field name="status" label="Estado" state={state}>
            {({ defaultValue, ...props }) => (
              <select
                {...props}
                key={defaultValue || "active"}
                defaultValue={defaultValue || "active"}
              >
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PROJECT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field name="manual_progress" label="Progreso manual (%)" state={state}>
            {({ defaultValue, ...props }) => (
              <input
                {...props}
                type="number"
                min={0}
                max={100}
                step={1}
                defaultValue={defaultValue || "0"}
              />
            )}
          </Field>
          <Field name="local_path" label="Ruta local" state={state} className="sm:col-span-2">
            {(props) => <input {...props} type="text" maxLength={500} />}
          </Field>
          <Field name="repository_url" label="Repositorio GitHub" state={state}>
            {(props) => (
              <input {...props} type="url" placeholder="https://github.com/..." />
            )}
          </Field>
          <Field name="production_url" label="URL de producción" state={state}>
            {(props) => <input {...props} type="url" placeholder="https://..." />}
          </Field>
          <Field name="branch" label="Rama" state={state}>
            {(props) => <input {...props} type="text" maxLength={200} />}
          </Field>
          <Field name="stack" label="Stack" state={state}>
            {(props) => <input {...props} type="text" maxLength={300} />}
          </Field>
          <Field name="notes" label="Notas" state={state} className="sm:col-span-2">
            {(props) => <textarea {...props} rows={3} maxLength={5000} />}
          </Field>

          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {pending ? (project ? "Guardando..." : "Creando...") : (project ? "Guardar cambios" : "Crear proyecto")}
            </button>
            {state.status === "error" && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                {state.message}
              </p>
            )}
            {state.status === "success" && (
              <p role="status" className="text-sm text-green-700 dark:text-green-400">
                {state.message}
              </p>
            )}
          </div>
        </fieldset>
      </form>
    </details>
    </FieldDefaults.Provider>
  );
}
