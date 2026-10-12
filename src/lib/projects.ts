import "server-only";

import type { CreateProjectInput, ProjectStatus } from "@/lib/project-input";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type { ProjectStatus };
export type ProgressMode = "manual" | "tasks";

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

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("listProjects failed", { code: error.code });
    throw new Error("Could not load projects.");
  }

  return (data ?? []) as Project[];
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

export async function updateProject(id: string, input: CreateProjectInput): Promise<boolean> {
  const { data, error } = await getSupabaseServerClient()
    .from("projects")
    .update(input)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateProject failed", { code: error.code });
    throw new Error("Could not update project.");
  }

  return data !== null;
}
