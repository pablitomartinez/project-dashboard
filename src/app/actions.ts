"use server";

import { revalidatePath } from "next/cache";

import {
  parseCreateProjectInput,
  type CreateProjectState,
} from "@/lib/project-input";
import { createProject } from "@/lib/projects";

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
