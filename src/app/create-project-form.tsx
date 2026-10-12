"use client";

import {
  createContext, useContext, useId, useActionState, useEffect, useRef, useState,
  type ReactNode,
} from "react";

import { createProjectAction, updateProjectAction } from "@/app/actions";
import {
  PROGRESS_MODE_LABELS,
  PROGRESS_MODES,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  projectInputValues,
  projectFormState,
  type CreateProjectInput,
  type CreateProjectValues,
  type CreateProjectField,
  type CreateProjectState,
} from "@/lib/project-input";

const initialState: CreateProjectState = { status: "idle" };
type ProjectNotice = { message: string; tone: "error" | "success" };
const ProjectNoticeContext = createContext<(notice: ProjectNotice) => void>(() => {});

export function useProjectNotice() {
  return useContext(ProjectNoticeContext);
}

// This notice survives removal of the project's card during revalidation.
export function ProjectFeedback({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<ProjectNotice | null>(null);
  return (
    <ProjectNoticeContext.Provider value={setNotice}>
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={notice.tone === "error"
            ? "text-sm text-red-700 dark:text-red-400"
            : "text-sm text-green-700 dark:text-green-400"}
        >
          {notice.message}
        </p>
      )}
      {children}
    </ProjectNoticeContext.Provider>
  );
}
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

// New projects always start in manual mode; the mode is chosen when editing.
// In tasks mode manual_progress stays read-only and the server keeps its stored value.
function ProgressFields({ state, showMode }: { state: CreateProjectState; showMode: boolean }) {
  const defaults = useContext(FieldDefaults);
  const initialMode = (state.status === "error"
    ? state.values.progress_mode
    : defaults.values?.progress_mode) || "manual";
  const [mode, setMode] = useState(initialMode);
  const fromTasks = showMode && mode === "tasks";
  const hintId = `${defaults.prefix}-manual_progress-hint`;

  return (
    <>
      {showMode && (
        <Field name="progress_mode" label="Modo de progreso" state={state}>
          {({ defaultValue, ...props }) => (
            <select
              {...props}
              key={defaultValue || "manual"}
              defaultValue={defaultValue || "manual"}
              onChange={(event) => setMode(event.currentTarget.value)}
            >
              {PROGRESS_MODES.map((progressMode) => (
                <option key={progressMode} value={progressMode}>
                  {PROGRESS_MODE_LABELS[progressMode]}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      <Field name="manual_progress" label="Progreso manual (%)" state={state}>
        {({ defaultValue, className, ...props }) => (
          <>
            <input
              {...props}
              aria-describedby={[props["aria-describedby"], fromTasks ? hintId : undefined]
                .filter(Boolean).join(" ") || undefined}
              className={`${className} read-only:bg-zinc-100 read-only:text-zinc-500 dark:read-only:bg-zinc-900`}
              type="number"
              min={0}
              max={100}
              step={1}
              readOnly={fromTasks}
              defaultValue={defaultValue || "0"}
            />
            {fromTasks && (
              <p id={hintId} className="text-xs text-zinc-600 dark:text-zinc-400">
                Se calcula con las tareas. El valor manual se conserva.
              </p>
            )}
          </>
        )}
      </Field>
    </>
  );
}

export function CreateProjectForm() {
  return <ProjectForm />;
}

type EditableProject = CreateProjectInput & { id: string; updated_at: string };

export function EditProjectForm({ project }: { project: EditableProject }) {
  return <ProjectForm project={project} />;
}

function ProjectForm({ project }: { project?: EditableProject }) {
  const reportMissingProject = useProjectNotice();
  const prefix = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [actionState, formAction, pending] = useActionState(
    project ? async (previousState: CreateProjectState, formData: FormData) => {
      const result = await updateProjectAction(project.id, project.updated_at, previousState, formData);
      if (result.status === "error" && result.projectMissing) {
        reportMissingProject({ message: result.message, tone: "error" });
      }
      return result;
    } : createProjectAction,
    initialState,
  );
  const state = project ? projectFormState(actionState, project.updated_at) : actionState;

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
        <fieldset
          key={JSON.stringify(state.status === "error" ? state.values : defaultValues)}
          disabled={pending}
          className="grid gap-4 sm:grid-cols-2"
        >
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
          <ProgressFields state={state} showMode={Boolean(project)} />
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
