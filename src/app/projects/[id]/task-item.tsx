"use client";

import { useId, useRef, useState, useTransition } from "react";

import { useProjectNotice } from "@/app/create-project-form";
import { toggleTaskAction } from "@/app/task-actions";

type TaskItemProps = {
  projectId: string;
  task: { id: string; title: string; completed: boolean };
};

// The checkbox always reflects the persisted value: it changes only after the
// server confirms the update and the page is revalidated.
export function TaskItem({ projectId, task }: TaskItemProps) {
  const id = useId();
  const notify = useProjectNotice();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  return (
    <li className="py-2">
      <div className="flex items-start gap-3">
        <input
          id={`${id}-task`}
          type="checkbox"
          checked={task.completed}
          disabled={pending}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            if (saving.current) return;
            saving.current = true;
            const completed = event.currentTarget.checked;
            setError(null);
            startTransition(async () => {
              const result = await toggleTaskAction(projectId, task.id, completed);
              saving.current = false;
              if (result.status === "error") {
                if (result.taskMissing) notify({ message: result.message, tone: "error" });
                else setError(result.message);
              }
            });
          }}
          className="mt-0.5 size-4 shrink-0 disabled:opacity-60"
        />
        <label
          htmlFor={`${id}-task`}
          className={`min-w-0 flex-1 break-words text-sm ${
            task.completed ? "text-zinc-500 line-through dark:text-zinc-400" : ""
          }`}
        >
          {task.title}
        </label>
        {pending && (
          <span role="status" className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
            Guardando...
          </span>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 pl-7 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}
