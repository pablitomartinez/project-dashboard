import "server-only";

import type { ResourceInput } from "@/lib/resource-input";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type Resource = {
  id: string;
  project_id: string;
  label: string;
  url: string | null;
  created_at: string;
  updated_at: string;
};

const RESOURCE_COLUMNS = "id, project_id, label, url, created_at, updated_at";

// Foreign key violation: the project does not exist (anymore).
const FOREIGN_KEY_VIOLATION = "23503";

export async function listResources(projectId: string): Promise<Resource[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("project_resources")
    .select(RESOURCE_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("listResources failed", { code: error.code });
    throw new Error("Could not load resources.");
  }

  return (data ?? []) as Resource[];
}

// Returns false when the project does not exist. `type` keeps its default.
export async function createResource(projectId: string, input: ResourceInput): Promise<boolean> {
  const { error } = await getSupabaseServerClient()
    .from("project_resources")
    .insert({ project_id: projectId, label: input.label, url: input.url });

  if (error?.code === FOREIGN_KEY_VIOLATION) return false;
  if (error) {
    console.error("createResource failed", { code: error.code });
    throw new Error("Could not create resource.");
  }
  return true;
}

// Updates and deletes filter by both ids, so a resource can only be changed
// through its own project. They return null when no resource of that project matches.
export async function updateResource(
  projectId: string,
  resourceId: string,
  input: ResourceInput,
): Promise<Pick<Resource, "id"> | null> {
  const { data, error } = await getSupabaseServerClient()
    .from("project_resources")
    .update({ label: input.label, url: input.url })
    .eq("id", resourceId)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateResource failed", { code: error.code });
    throw new Error("Could not update resource.");
  }

  return data;
}

export async function deleteResource(
  projectId: string,
  resourceId: string,
): Promise<Pick<Resource, "id" | "label"> | null> {
  const { data, error } = await getSupabaseServerClient()
    .from("project_resources")
    .delete()
    .eq("id", resourceId)
    .eq("project_id", projectId)
    .select("id, label")
    .maybeSingle();

  if (error) {
    console.error("deleteResource failed", { code: error.code });
    throw new Error("Could not delete resource.");
  }

  return data;
}
