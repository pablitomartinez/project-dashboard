"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import { ResourceFields } from "@/app/projects/[id]/resource-fields";
import { useSubmitGuard } from "@/app/projects/[id]/use-submit-guard";
import { createResourceAction } from "@/app/resource-actions";
import type { ResourceFormState } from "@/lib/resource-input";

const initialState: ResourceFormState = { status: "idle" };
const emptyValues = { label: "", url: "" };

export function CreateResourceForm({ projectId }: { projectId: string }) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    createResourceAction.bind(null, projectId),
    initialState,
  );
  const onSubmit = useSubmitGuard(pending);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate>
      <fieldset disabled={pending} className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Nuevo recurso</legend>
        <ResourceFields idPrefix={id} state={state} initial={emptyValues} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="submit"
            className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "Agregando..." : "Agregar recurso"}
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
  );
}
