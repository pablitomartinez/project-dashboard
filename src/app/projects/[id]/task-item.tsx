"use client";

import { useActionState, useId, useRef, useState, useTransition } from "react";

import { useProjectNotice } from "@/app/create-project-form";
import { useSubmitGuard } from "@/app/projects/[id]/use-submit-guard";
import { deleteTaskAction, toggleTaskAction, updateTaskTitleAction } from "@/app/task-actions";
import {
  TASK_TITLE_MAX_LENGTH,
  type DeleteTaskState,
  type EditTaskState,
} from "@/lib/task-input";

type TaskProps = {
  projectId: string;
  task: { id: string; title: string; completed: boolean };
};

const secondaryButton =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950";

// The checkbox always reflects the persisted value: it changes only after the
// server confirms the update and the page is revalidated.
export function TaskItem({ projectId, task }: TaskProps) {
  const id = useId();
  const notify = useProjectNotice();
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  if (mode === "edit") {
    return (
      <li className="py-2">
        <EditTaskForm projectId={projectId} task={task} onDone={() => setMode("view")} />
      </li>
    );
  }

  return (
    <li className="py-2">
      <div className="flex items-start gap-3">
        <input
          id={`${id}-task`}
          type="checkbox"
          checked={task.completed}
          disabled={pending || mode !== "view"}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            if (saving.current) return;
            saving.current = true;
            const completed = event.currentTarget.checked;
            setError(null);
            startTransition(async () => {
              const result = await toggleTaskAction(projectId, task.id, completed);
              saving.current = false;
              if (result.status === "error") {
                if (result.taskMissing) notify({ message: result.message, tone: "error" });
                else setError(result.message);
              }
            });
          }}
          className="mt-0.5 size-4 shrink-0 disabled:opacity-60"
        />
        <label
          htmlFor={`${id}-task`}
          className={`min-w-0 flex-1 break-words text-sm ${
            task.completed ? "text-zinc-500 line-through dark:text-zinc-400" : ""
          }`}
        >
          {task.title}
        </label>
        {pending ? (
          <span role="status" className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
            Guardando...
          </span>
        ) : mode === "view" && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              aria-label={`Editar "${task.title}"`}
              onClick={() => {
                setError(null);
                setMode("edit");
              }}
              className={secondaryButton}
            >
              Editar
            </button>
            <button
              type="button"
              aria-label={`Eliminar "${task.title}"`}
              onClick={() => {
                setError(null);
                setMode("delete");
              }}
              className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 pl-7 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {mode === "delete" && (
        <DeleteTaskConfirmation projectId={projectId} task={task} onCancel={() => setMode("view")} />
      )}
    </li>
  );
}

const idleEdit: EditTaskState = { status: "idle" };

function EditTaskForm({ projectId, task, onDone }: TaskProps & { onDone: () => void }) {
  const id = useId();
  const notify = useProjectNotice();
  const [state, formAction, pending] = useActionState(
    async (previousState: EditTaskState, formData: FormData) => {
      const result = await updateTaskTitleAction(projectId, task.id, previousState, formData);
      if (result.status === "success") onDone();
      else if (result.status === "error" && result.taskMissing) {
        notify({ message: result.message, tone: "error" });
      }
      return result;
    },
    idleEdit,
  );
  const onSubmit = useSubmitGuard(pending);
  const title = state.status === "error" ? state.title : task.title;
  const titleError = state.status === "error" && state.invalidTitle ? state.message : undefined;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate>
      <fieldset disabled={pending} className="flex flex-col gap-2">
        <label htmlFor={`${id}-title`} className="sr-only">
          Título de la tarea
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            key={title}
            id={`${id}-title`}
            name="title"
            type="text"
            required
            autoFocus
            maxLength={TASK_TITLE_MAX_LENGTH}
            defaultValue={title}
            aria-invalid={Boolean(titleError)}
            aria-describedby={titleError ? `${id}-error` : undefined}
            className="w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm aria-invalid:border-red-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {pending ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={onDone} className={secondaryButton}>
              Cancelar
            </button>
          </div>
        </div>
        {titleError && (
          <p id={`${id}-error`} className="text-xs text-red-700 dark:text-red-400">
            {titleError}
          </p>
        )}
        {state.status === "error" && !state.invalidTitle && !state.taskMissing && (
          <p role="alert" className="text-xs text-red-700 dark:text-red-400">
            {state.message}
          </p>
        )}
      </fieldset>
    </form>
  );
}

const idleDelete: DeleteTaskState = { status: "idle" };

function DeleteTaskConfirmation({ projectId, task, onCancel }: TaskProps & { onCancel: () => void }) {
  const warningId = useId();
  const notify = useProjectNotice();
  const [state, formAction, pending] = useActionState(async () => {
    const result = await deleteTaskAction(projectId, task.id);
    if (result.status === "success") notify({ message: result.message, tone: "success" });
    else if (result.status === "error" && result.taskMissing) {
      notify({ message: result.message, tone: "error" });
    }
    return result;
  }, idleDelete);
  const onSubmit = useSubmitGuard(pending);

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      aria-describedby={warningId}
      className="mt-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950"
    >
      <p id={warningId} className="break-words text-red-800 dark:text-red-200">
        ¿Eliminar la tarea &quot;{task.title}&quot;? Esta acción no se puede deshacer.
      </p>
      <fieldset disabled={pending} className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className={secondaryButton}>
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {pending ? "Eliminando..." : "Sí, eliminar"}
        </button>
      </fieldset>
      {state.status === "error" && !state.taskMissing && (
        <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
