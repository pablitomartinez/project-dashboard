import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export type Task = {
  id: string;
  project_id: string;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

const TASK_COLUMNS = "id, project_id, title, completed, position, created_at, updated_at";

// Foreign key violation: the project does not exist (anymore).
const FOREIGN_KEY_VIOLATION = "23503";

export async function listTasks(projectId: string): Promise<Task[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listTasks failed", { code: error.code });
    throw new Error("Could not load tasks.");
  }

  return (data ?? []) as Task[];
}

// Returns false when the project does not exist.
export async function createTask(projectId: string, title: string): Promise<boolean> {
  const { error } = await getSupabaseServerClient()
    .from("tasks")
    .insert({ project_id: projectId, title });

  if (error?.code === FOREIGN_KEY_VIOLATION) return false;
  if (error) {
    console.error("createTask failed", { code: error.code });
    throw new Error("Could not create task.");
  }
  return true;
}

// Updates and deletes filter by both ids, so a task can only be changed through
// its own project. They return null when no task of that project matches.
export async function setTaskCompleted(
  projectId: string,
  taskId: string,
  completed: boolean,
): Promise<Pick<Task, "id"> | null> {
  const { data, error } = await getSupabaseServerClient()
    .from("tasks")
    .update({ completed })
    .eq("id", taskId)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("setTaskCompleted failed", { code: error.code });
    throw new Error("Could not update task.");
  }

  return data;
}

// Only the title is written, so a concurrent completion change is not overwritten.
export async function updateTaskTitle(
  projectId: string,
  taskId: string,
  title: string,
): Promise<Pick<Task, "id"> | null> {
  const { data, error } = await getSupabaseServerClient()
    .from("tasks")
    .update({ title })
    .eq("id", taskId)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateTaskTitle failed", { code: error.code });
    throw new Error("Could not update task.");
  }

  return data;
}

export async function deleteTask(
  projectId: string,
  taskId: string,
): Promise<Pick<Task, "id"> | null> {
  const { data, error } = await getSupabaseServerClient()
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("deleteTask failed", { code: error.code });
    throw new Error("Could not delete task.");
  }

  return data;
}
