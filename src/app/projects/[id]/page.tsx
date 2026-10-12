import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectFeedback } from "@/app/create-project-form";
import { CreateTaskForm } from "@/app/projects/[id]/create-task-form";
import { TaskItem } from "@/app/projects/[id]/task-item";
import { isProjectId, PROJECT_STATUS_LABELS } from "@/lib/project-input";
import { getProject, type Project } from "@/lib/projects";
import { countTasks } from "@/lib/task-input";
import { listTasks, type Task } from "@/lib/tasks";

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  if (!isProjectId(id)) notFound();

  let loaded: [Project | null, Task[]] | null = null;
  try {
    loaded = await Promise.all([getProject(id), listTasks(id)]);
  } catch (error) {
    console.error(
      "Failed to load project:",
      error instanceof Error ? error.message : "unknown error",
    );
  }
  if (loaded && !loaded[0]) notFound();

  const backLink = (
    <Link
      href="/"
      className="self-start text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
    >
      ← Volver al dashboard
    </Link>
  );

  if (!loaded) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        {backLink}
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          No se pudo cargar el proyecto. Intentá de nuevo más tarde.
        </p>
      </main>
    );
  }

  const [project, tasks] = loaded as [Project, Task[]];
  const { pending: pendingCount, completed: completedCount } = countTasks(tasks);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          <span className="mt-1.5 shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
            {PROJECT_STATUS_LABELS[project.status]}
          </span>
        </div>
        {project.description && (
          <p className="break-words text-sm text-zinc-600 dark:text-zinc-400">
            {project.description}
          </p>
        )}
      </header>

      <section
        aria-labelledby="tasks-heading"
        className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="tasks-heading" className="font-medium">Tareas</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {plural(pendingCount, "pendiente", "pendientes")} ·{" "}
            {plural(completedCount, "completada", "completadas")}
          </p>
        </div>

        <ProjectFeedback>
          <CreateTaskForm projectId={project.id} />
          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              Todavía no hay tareas.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {tasks.map((task) => (
                <TaskItem key={task.id} projectId={project.id} task={task} />
              ))}
            </ul>
          )}
        </ProjectFeedback>
      </section>
    </main>
  );
}
