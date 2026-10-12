"use server";

import { revalidatePath } from "next/cache";

import {
  parseCreateProjectInput,
  isProjectId,
  projectInputValues,
  type CreateProjectState,
  type DeleteProjectState,
} from "@/lib/project-input";
import { createProject, deleteProject, updateProject } from "@/lib/projects";

// Reachable by direct POST from anyone who can reach the app. There is no access
// control yet, so the app must only run locally (see docs/ARCHITECTURE.md).
export async function createProjectAction(
  _previousState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const parsed = parseCreateProjectInput(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisá los campos marcados.",
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  try {
    await createProject(parsed.data);
  } catch {
    return {
      status: "error",
      message: "No se pudo crear el proyecto. Intentá de nuevo más tarde.",
      fieldErrors: {},
      values: parsed.values,
    };
  }

  revalidatePath("/");
  return { status: "success", message: `Proyecto "${parsed.data.name}" creado.` };
}

export async function updateProjectAction(
  id: string,
  projectVersion: string,
  _previousState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const parsed = parseCreateProjectInput(formData);
  if (!parsed.success || !isProjectId(id)) {
    return {
      status: "error",
      message: isProjectId(id) ? "Revisá los campos marcados." : "Proyecto inválido.",
      fieldErrors: parsed.success ? {} : parsed.fieldErrors,
      values: parsed.values,
      projectVersion,
    };
  }

  try {
    const updated = await updateProject(id, parsed.data);
    revalidatePath(`/projects/${id}`);
    if (!updated) {
      revalidatePath("/");
      return {
        status: "error",
        message: "El proyecto ya no existe. Actualizá la página.",
        fieldErrors: {},
        values: parsed.values,
        projectVersion,
        projectMissing: true,
      };
    }
    revalidatePath("/");
    return {
      status: "success",
      message: "Cambios guardados.",
      values: projectInputValues(updated),
      projectVersion: updated.updated_at,
    };
  } catch {
    return {
      status: "error",
      message: "No se pudo guardar el proyecto. Intentá de nuevo más tarde.",
      fieldErrors: {},
      values: parsed.values,
      projectVersion,
    };
  }
}

// Tasks and resources are removed by the `on delete cascade` foreign keys.
export async function deleteProjectAction(id: unknown): Promise<DeleteProjectState> {
  if (!isProjectId(id)) {
    return { status: "error", message: "Proyecto inválido." };
  }

  let deleted;
  try {
    deleted = await deleteProject(id);
  } catch {
    return {
      status: "error",
      message: "No se pudo eliminar el proyecto. Intentá de nuevo más tarde.",
    };
  }

  revalidatePath("/");
  if (!deleted) {
    return {
      status: "error",
      message: "El proyecto ya no existe. Se actualizó el listado.",
      projectMissing: true,
    };
  }
  return { status: "success", message: `Proyecto "${deleted.name}" eliminado.` };
}
