// Pure validation for task forms. No server-only imports, so it can be shared
// with Client Components and tested with `node --test`.

export const TASK_TITLE_MAX_LENGTH = 500;

export type CreateTaskState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      title: string;
      invalidTitle?: boolean;
      projectMissing?: boolean;
    };

export type ToggleTaskState =
  | { status: "success" }
  | { status: "error"; message: string; taskMissing?: boolean };

export type EditTaskState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      message: string;
      title: string;
      invalidTitle?: boolean;
      taskMissing?: boolean;
    };

export type DeleteTaskState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; taskMissing?: boolean };

export function countTasks(tasks: readonly { completed: boolean }[]) {
  const completed = tasks.filter((task) => task.completed).length;
  return { pending: tasks.length - completed, completed };
}

export type ParseTaskTitleResult =
  | { success: true; title: string }
  | { success: false; error: string; title: string };

export function parseTaskTitle(formData: FormData): ParseTaskTitleResult {
  const raw = formData.get("title");
  const entered = typeof raw === "string" ? raw : "";
  const title = entered.trim();

  if (!title) {
    return { success: false, error: "El título es obligatorio.", title: entered };
  }
  if (title.length > TASK_TITLE_MAX_LENGTH) {
    return {
      success: false,
      error: `Máximo ${TASK_TITLE_MAX_LENGTH} caracteres.`,
      title: entered,
    };
  }
  return { success: true, title };
}
