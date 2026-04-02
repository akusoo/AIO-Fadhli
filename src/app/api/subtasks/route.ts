import type { AddSubtaskInput } from "@/lib/domain/models";
import { buildAppSnapshot } from "@/lib/server/app-backend";
import { createId } from "@/lib/utils";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddSubtaskInput & { clientId?: string };
    const createdSubtask = {
      id: body.clientId ?? createId("subtask"),
      user_id: context.user.id,
      task_id: body.taskId,
      title: body.title,
      note: body.note ?? null,
      done: false,
    };

    const { error } = await context.supabase.from("subtasks").insert(createdSubtask);

    if (error) {
      throw error;
    }

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson(
      {
        snapshot,
        item: {
          id: createdSubtask.id,
          taskId: createdSubtask.task_id,
          title: createdSubtask.title,
          note: body.note,
          done: false,
        },
      },
      context.applyCookies,
    );
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah subtask.",
      400,
      context.applyCookies,
    );
  }
}
