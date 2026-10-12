"use client";

import { useActionState, useId, useState } from "react";

import { deleteProjectAction } from "@/app/actions";
import { useProjectNotice } from "@/app/create-project-form";
import type { DeleteProjectState } from "@/lib/project-input";

const initialState: DeleteProjectState = { status: "idle" };

export function DeleteProjectForm({ project }: { project: { id: string; name: string } }) {
  const notify = useProjectNotice();
  const warningId = useId();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(async () => {
    const result = await deleteProjectAction(project.id);
    if (result.status === "success") {
      notify({ message: result.message, tone: "success" });
    } else if (result.status === "error" && result.projectMissing) {
      notify({ message: result.message, tone: "error" });
    }
    return result;
  }, initialState);

  if (!confirming) {
    return (
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          Eliminar
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (pending) event.preventDefault();
      }}
      aria-describedby={warningId}
      className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950"
    >
      <p id={warningId} className="break-words text-red-800 dark:text-red-200">
        ¿Eliminar &quot;{project.name}&quot;? También se eliminarán todas sus tareas y
        recursos asociados. Esta acción no se puede deshacer.
      </p>
      <fieldset
        disabled={pending}
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end"
      >
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 font-medium disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-md bg-red-700 px-3 py-1.5 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Eliminando..." : "Sí, eliminar"}
        </button>
      </fieldset>
      {state.status === "error" && !state.projectMissing && (
        <p role="alert" className="mt-2 text-red-700 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
