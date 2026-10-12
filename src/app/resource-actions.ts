"use server";

import { revalidatePath } from "next/cache";

import { isProjectId as isUuid } from "@/lib/project-input";
import {
  parseResourceInput,
  type DeleteResourceState,
  type ResourceFormState,
} from "@/lib/resource-input";
import { createResource, deleteResource, updateResource } from "@/lib/resources";

const RESOURCE_MISSING = "El recurso ya no existe. Se actualizó la lista.";
const INVALID_FIELDS = "Revisá los campos marcados.";

// Reachable by direct POST from anyone who can reach the app. There is no access
// control yet, so the app must only run locally (see docs/ARCHITECTURE.md).
export async function createResourceAction(
  projectId: unknown,
  _previousState: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const parsed = parseResourceInput(formData);
  if (!isUuid(projectId)) {
    return { status: "error", message: "Proyecto inválido.", values: parsed.values, fieldErrors: {} };
  }
  if (!parsed.success) {
    return { status: "error", message: INVALID_FIELDS, values: parsed.values, fieldErrors: parsed.fieldErrors };
  }

  let created;
  try {
    created = await createResource(projectId, parsed.data);
  } catch {
    return {
      status: "error",
      message: "No se pudo agregar el recurso. Intentá de nuevo más tarde.",
      values: parsed.values,
      fieldErrors: {},
    };
  }

  revalidatePath(`/projects/${projectId}`);
  if (!created) {
    return {
      status: "error",
      message: "El proyecto ya no existe.",
      values: parsed.values,
      fieldErrors: {},
      projectMissing: true,
    };
  }
  return { status: "success", message: "Recurso agregado." };
}

export async function updateResourceAction(
  projectId: unknown,
  resourceId: unknown,
  _previousState: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const parsed = parseResourceInput(formData);
  if (!isUuid(projectId) || !isUuid(resourceId)) {
    return { status: "error", message: "Recurso inválido.", values: parsed.values, fieldErrors: {} };
  }
  if (!parsed.success) {
    return { status: "error", message: INVALID_FIELDS, values: parsed.values, fieldErrors: parsed.fieldErrors };
  }

  let updated;
  try {
    updated = await updateResource(projectId, resourceId, parsed.data);
  } catch {
    return {
      status: "error",
      message: "No se pudo guardar el recurso. Intentá de nuevo más tarde.",
      values: parsed.values,
      fieldErrors: {},
    };
  }

  revalidatePath(`/projects/${projectId}`);
  if (!updated) {
    return {
      status: "error",
      message: RESOURCE_MISSING,
      values: parsed.values,
      fieldErrors: {},
      resourceMissing: true,
    };
  }
  return { status: "success", message: "Recurso guardado." };
}

export async function deleteResourceAction(
  projectId: unknown,
  resourceId: unknown,
): Promise<DeleteResourceState> {
  if (!isUuid(projectId) || !isUuid(resourceId)) {
    return { status: "error", message: "Recurso inválido." };
  }

  let deleted;
  try {
    deleted = await deleteResource(projectId, resourceId);
  } catch {
    return {
      status: "error",
      message: "No se pudo eliminar el recurso. Intentá de nuevo más tarde.",
    };
  }

  revalidatePath(`/projects/${projectId}`);
  if (!deleted) {
    return { status: "error", message: RESOURCE_MISSING, resourceMissing: true };
  }
  return { status: "success", message: `Recurso "${deleted.label}" eliminado.` };
}
