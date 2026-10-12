import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Proyecto no encontrado</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        El proyecto no existe o fue eliminado.
      </p>
      <Link href="/" className="self-start text-sm underline-offset-4 hover:underline">
        ← Volver al dashboard
      </Link>
    </main>
  );
}
