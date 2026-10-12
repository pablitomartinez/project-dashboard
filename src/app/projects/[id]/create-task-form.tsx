"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import { createTaskAction } from "@/app/task-actions";
import { TASK_TITLE_MAX_LENGTH, type CreateTaskState } from "@/lib/task-input";

const initialState: CreateTaskState = { status: "idle" };

export function CreateTaskForm({ projectId }: { projectId: string }) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    createTaskAction.bind(null, projectId),
    initialState,
  );

  // `pending` updates after a render, so a synchronous second submit needs a ref.
  const submitting = useRef(false);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  useEffect(() => {
    if (!pending) submitting.current = false;
  }, [pending]);

  const titleError = state.status === "error" && state.invalidTitle ? state.message : undefined;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(event) => {
        if (pending || submitting.current) event.preventDefault();
        else submitting.current = true;
      }}
      noValidate
    >
      <fieldset disabled={pending} className="flex flex-col gap-2">
        <label htmlFor={`${id}-title`} className="text-sm font-medium">
          Nueva tarea
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            key={state.status === "error" ? state.title : ""}
            id={`${id}-title`}
            name="title"
            type="text"
            required
            maxLength={TASK_TITLE_MAX_LENGTH}
            defaultValue={state.status === "error" ? state.title : ""}
            aria-invalid={Boolean(titleError)}
            aria-describedby={titleError ? `${id}-error` : undefined}
            className="w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm aria-invalid:border-red-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "Agregando..." : "Agregar tarea"}
          </button>
        </div>
        {titleError && (
          <p id={`${id}-error`} className="text-xs text-red-700 dark:text-red-400">
            {titleError}
          </p>
        )}
        {state.status === "error" && !state.invalidTitle && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.message}
          </p>
        )}
        {state.status === "success" && (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            {state.message}
          </p>
        )}
      </fieldset>
    </form>
  );
}
