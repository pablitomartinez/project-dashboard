"use server";

import { revalidatePath } from "next/cache";

import { isProjectId as isUuid } from "@/lib/project-input";
import {
  parseTaskTitle,
  type CreateTaskState,
  type ToggleTaskState,
} from "@/lib/task-input";
import { createTask, setTaskCompleted } from "@/lib/tasks";

// Reachable by direct POST from anyone who can reach the app. There is no access
// control yet, so the app must only run locally (see docs/ARCHITECTURE.md).
export async function createTaskAction(
  projectId: unknown,
  _previousState: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const parsed = parseTaskTitle(formData);
  if (!isUuid(projectId)) {
    return { status: "error", message: "Proyecto inválido.", title: parsed.title };
  }
  if (!parsed.success) {
    return { status: "error", message: parsed.error, title: parsed.title, invalidTitle: true };
  }

  let created;
  try {
    created = await createTask(projectId, parsed.title);
  } catch {
    return {
      status: "error",
      message: "No se pudo agregar la tarea. Intentá de nuevo más tarde.",
      title: parsed.title,
    };
  }

  revalidatePath(`/projects/${projectId}`);
  if (!created) {
    return {
      status: "error",
      message: "El proyecto ya no existe.",
      title: parsed.title,
      projectMissing: true,
    };
  }
  return { status: "success", message: "Tarea agregada." };
}

export async function toggleTaskAction(
  projectId: unknown,
  taskId: unknown,
  completed: unknown,
): Promise<ToggleTaskState> {
  if (!isUuid(projectId) || !isUuid(taskId) || typeof completed !== "boolean") {
    return { status: "error", message: "Tarea inválida." };
  }

  let updated;
  try {
    updated = await setTaskCompleted(projectId, taskId, completed);
  } catch {
    return {
      status: "error",
      message: "No se pudo actualizar la tarea. Intentá de nuevo más tarde.",
    };
  }

  revalidatePath(`/projects/${projectId}`);
  if (!updated) {
    return {
      status: "error",
      message: "La tarea ya no existe. Se actualizó la lista.",
      taskMissing: true,
    };
  }
  return { status: "success" };
}
