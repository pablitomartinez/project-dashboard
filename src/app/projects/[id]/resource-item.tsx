"use client";

import { useActionState, useId, useState } from "react";

import { useProjectNotice } from "@/app/create-project-form";
import { ResourceFields } from "@/app/projects/[id]/resource-fields";
import { useSubmitGuard } from "@/app/projects/[id]/use-submit-guard";
import { deleteResourceAction, updateResourceAction } from "@/app/resource-actions";
import type { DeleteResourceState, ResourceFormState } from "@/lib/resource-input";

type ResourceProps = {
  projectId: string;
  resource: { id: string; label: string; url: string | null };
};

const secondaryButton =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950";

export function ResourceItem({ projectId, resource }: ResourceProps) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");

  if (mode === "edit") {
    return (
      <li className="py-3">
        <EditResourceForm projectId={projectId} resource={resource} onDone={() => setMode("view")} />
      </li>
    );
  }

  return (
    <li className="py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium">{resource.label}</p>
          {resource.url ? (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm text-blue-700 underline-offset-4 hover:underline dark:text-blue-400"
            >
              {resource.url}
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Sin URL</p>
          )}
        </div>
        {mode === "view" && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              aria-label={`Editar recurso "${resource.label}"`}
              onClick={() => setMode("edit")}
              className={secondaryButton}
            >
              Editar
            </button>
            <button
              type="button"
              aria-label={`Eliminar recurso "${resource.label}"`}
              onClick={() => setMode("delete")}
              className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
      {mode === "delete" && (
        <DeleteResourceConfirmation
          projectId={projectId}
          resource={resource}
          onCancel={() => setMode("view")}
        />
      )}
    </li>
  );
}

const idleEdit: ResourceFormState = { status: "idle" };

function EditResourceForm({ projectId, resource, onDone }: ResourceProps & { onDone: () => void }) {
  const id = useId();
  const notify = useProjectNotice();
  const [state, formAction, pending] = useActionState(
    async (previousState: ResourceFormState, formData: FormData) => {
      const result = await updateResourceAction(projectId, resource.id, previousState, formData);
      if (result.status === "success") onDone();
      else if (result.status === "error" && result.resourceMissing) {
        notify({ message: result.message, tone: "error" });
      }
      return result;
    },
    idleEdit,
  );
  const onSubmit = useSubmitGuard(pending);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate aria-label={`Editar recurso "${resource.label}"`}>
      <fieldset disabled={pending} className="flex flex-col gap-3">
        <ResourceFields
          idPrefix={id}
          state={state}
          initial={{ label: resource.label, url: resource.url ?? "" }}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex gap-2">
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
          {state.status === "error" && !state.resourceMissing && (
            <p role="alert" className="text-xs text-red-700 dark:text-red-400">
              {state.message}
            </p>
          )}
        </div>
      </fieldset>
    </form>
  );
}

const idleDelete: DeleteResourceState = { status: "idle" };

function DeleteResourceConfirmation({
  projectId,
  resource,
  onCancel,
}: ResourceProps & { onCancel: () => void }) {
  const warningId = useId();
  const notify = useProjectNotice();
  const [state, formAction, pending] = useActionState(async () => {
    const result = await deleteResourceAction(projectId, resource.id);
    if (result.status === "success") notify({ message: result.message, tone: "success" });
    else if (result.status === "error" && result.resourceMissing) {
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
        ¿Eliminar el recurso &quot;{resource.label}&quot;? Esta acción no se puede deshacer.
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
      {state.status === "error" && !state.resourceMissing && (
        <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
