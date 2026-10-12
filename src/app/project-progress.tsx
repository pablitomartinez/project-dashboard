import { PROGRESS_MODE_LABELS } from "@/lib/project-input";
import type { ProjectProgress, TaskCounts } from "@/lib/project-progress";

export function ProjectProgressBar({
  progress,
  counts,
}: {
  progress: ProjectProgress;
  counts: TaskCounts;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
        <span>
          Progreso · {PROGRESS_MODE_LABELS[progress.mode]}
          {progress.mode === "tasks" && ` (${counts.completed} de ${counts.total} tareas)`}
        </span>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{progress.percent} %</span>
      </div>
      <div
        role="progressbar"
        aria-label={`Progreso ${PROGRESS_MODE_LABELS[progress.mode].toLowerCase()}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div
          className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
