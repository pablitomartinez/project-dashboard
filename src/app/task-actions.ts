"use server";

import { revalidatePath } from "next/cache";

import { isProjectId as isUuid } from "@/lib/project-input";
import {
  parseTaskTitle,
  type CreateTaskState,
  type DeleteTaskState,
  type EditTaskState,
  type ToggleTaskState,
} from "@/lib/task-input";
import { createTask, deleteTask, setTaskCompleted, updateTaskTitle } from "@/lib/tasks";

const TASK_MISSING = "La tarea ya no existe. Se actualizó la lista.";

// Task changes alter the progress shown on the dashboard and on the detail page.
function revalidateProgress(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

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

  revalidateProgress(projectId);
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

  revalidateProgress(projectId);
  if (!updated) {
    return { status: "error", message: TASK_MISSING, taskMissing: true };
  }
  return { status: "success" };
}

export async function updateTaskTitleAction(
  projectId: unknown,
  taskId: unknown,
  _previousState: EditTaskState,
  formData: FormData,
): Promise<EditTaskState> {
  const parsed = parseTaskTitle(formData);
  if (!isUuid(projectId) || !isUuid(taskId)) {
    return { status: "error", message: "Tarea inválida.", title: parsed.title };
  }
  if (!parsed.success) {
    return { status: "error", message: parsed.error, title: parsed.title, invalidTitle: true };
  }

  let updated;
  try {
    updated = await updateTaskTitle(projectId, taskId, parsed.title);
  } catch {
    return {
      status: "error",
      message: "No se pudo guardar la tarea. Intentá de nuevo más tarde.",
      title: parsed.title,
    };
  }

  revalidatePath(`/projects/${projectId}`);
  if (!updated) {
    return { status: "error", message: TASK_MISSING, title: parsed.title, taskMissing: true };
  }
  return { status: "success" };
}

export async function deleteTaskAction(
  projectId: unknown,
  taskId: unknown,
): Promise<DeleteTaskState> {
  if (!isUuid(projectId) || !isUuid(taskId)) {
    return { status: "error", message: "Tarea inválida." };
  }

  let deleted;
  try {
    deleted = await deleteTask(projectId, taskId);
  } catch {
    return {
      status: "error",
      message: "No se pudo eliminar la tarea. Intentá de nuevo más tarde.",
    };
  }

  revalidateProgress(projectId);
  if (!deleted) {
    return { status: "error", message: TASK_MISSING, taskMissing: true };
  }
  return { status: "success", message: "Tarea eliminada." };
}
