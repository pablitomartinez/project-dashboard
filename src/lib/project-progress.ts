// Pure progress calculation shared by the dashboard and the project page.
// The percentage is derived on every render and never stored.

import type { ProgressMode } from "@/lib/project-input";

export type TaskCounts = { total: number; completed: number };
export type ProjectProgress = { mode: ProgressMode; percent: number };

export function taskProgressPercent({ total, completed }: TaskCounts): number {
  if (total <= 0) return 0;
  const done = Math.min(Math.max(completed, 0), total);
  return Math.round((done * 100) / total);
}

export function projectProgress(
  project: { progress_mode: ProgressMode; manual_progress: number },
  counts: TaskCounts,
): ProjectProgress {
  return project.progress_mode === "tasks"
    ? { mode: "tasks", percent: taskProgressPercent(counts) }
    : { mode: "manual", percent: project.manual_progress };
}
