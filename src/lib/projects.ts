import "server-only";

import type { CreateProjectInput, ProgressMode, ProjectStatus } from "@/lib/project-input";
import type { TaskCounts } from "@/lib/project-progress";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type { ProgressMode, ProjectStatus };

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  progress_mode: ProgressMode;
  manual_progress: number;
  local_path: string | null;
  repository_url: string | null;
  production_url: string | null;
  branch: string | null;
  stack: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const PROJECT_COLUMNS =
  "id, name, description, status, progress_mode, manual_progress, local_path, repository_url, production_url, branch, stack, notes, created_at, updated_at";

export type ProjectWithTaskCounts = Project & { task_counts: TaskCounts };

type CountAggregate = { count: number }[] | null | undefined;
type ProjectRowWithCounts = Project & {
  task_total: CountAggregate;
  task_completed: CountAggregate;
};

// One request for every project: Postgres counts all tasks and completed tasks
// per project through two filtered embeds, so the dashboard has no N+1 queries.
export async function listProjects(): Promise<ProjectWithTaskCounts[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("projects")
    .select(`${PROJECT_COLUMNS}, task_total:tasks(count), task_completed:tasks(count)`)
    .eq("task_completed.completed", true)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("listProjects failed", { code: error.code });
    throw new Error("Could not load projects.");
  }

  return ((data ?? []) as unknown as ProjectRowWithCounts[]).map(
    ({ task_total, task_completed, ...project }) => ({
      ...project,
      task_counts: {
        total: task_total?.[0]?.count ?? 0,
        completed: task_completed?.[0]?.count ?? 0,
      },
    }),
  );
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await getSupabaseServerClient()
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getProject failed", { code: error.code });
    throw new Error("Could not load project.");
  }

  return data as Project | null;
}

export async function createProject(input: CreateProjectInput): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from("projects")
    .insert({ ...input, progress_mode: "manual" });

  if (error) {
    console.error("createProject failed", { code: error.code });
    throw new Error("Could not create project.");
  }
}

// In tasks mode manual_progress is not editable, so the stored value is kept.
export async function updateProject(id: string, input: CreateProjectInput): Promise<Project | null> {
  const changes: Partial<CreateProjectInput> = { ...input };
  if (input.progress_mode === "tasks") delete changes.manual_progress;

  const { data, error } = await getSupabaseServerClient()
    .from("projects")
    .update(changes)
    .eq("id", id)
    .select(PROJECT_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("updateProject failed", { code: error.code });
    throw new Error("Could not update project.");
  }

  return data as Project | null;
}

export async function deleteProject(id: string): Promise<Pick<Project, "name"> | null> {
  const { data, error } = await getSupabaseServerClient()
    .from("projects")
    .delete()
    .eq("id", id)
    .select("name")
    .maybeSingle();

  if (error) {
    console.error("deleteProject failed", { code: error.code });
    throw new Error("Could not delete project.");
  }

  return data;
}
