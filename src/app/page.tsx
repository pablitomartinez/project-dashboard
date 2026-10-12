import { connection } from "next/server";

import { CreateProjectForm } from "@/app/create-project-form";
import { PROJECT_STATUS_LABELS } from "@/lib/project-input";
import { listProjects, type Project } from "@/lib/projects";

export default async function Home() {
  await connection();

  let projects: Project[] | null = null;
  try {
    projects = await listProjects();
  } catch (error) {
    console.error(
      "Failed to load projects:",
      error instanceof Error ? error.message : "unknown error",
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>

      <CreateProjectForm />

      {projects === null ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          No se pudieron cargar los proyectos. Intentá de nuevo más tarde.
        </p>
      ) : projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Todavía no hay proyectos.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li
              key={project.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-medium">{project.name}</h2>
                <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
                  {PROJECT_STATUS_LABELS[project.status]}
                </span>
              </div>
              {project.description && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {project.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
