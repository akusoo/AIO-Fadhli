import type { AddTaskInput } from "@/lib/domain/models";
import { createId } from "@/lib/utils";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddTaskInput & { clientId?: string };
    const createdTask = {
      id: body.clientId ?? createId("task"),
      user_id: context.user.id,
      title: body.title,
      status: "todo",
      priority: body.priority ?? "medium",
      due_on: body.dueOn ?? null,
      project_id: body.projectId ?? null,
      today_pinned: body.todayPinned ?? false,
      note: body.note ?? null,
      start_time: body.startTime ?? null,
      due_time: body.dueTime ?? null,
      reminder_at: body.reminderAt ?? null,
      completed_at: null,
      recurring_cadence: body.recurring?.cadence ?? null,
      recurring_interval: body.recurring?.interval ?? null,
    };

    const { error } = await context.supabase.from("tasks").insert(createdTask);
    if (error) {
      throw error;
    }

    return okJson(
      {
        item: {
          id: createdTask.id,
          title: createdTask.title,
          status: "todo",
          priority: createdTask.priority,
          dueOn: body.dueOn,
          projectId: body.projectId,
          todayPinned: body.todayPinned ?? false,
          note: body.note,
          startTime: body.startTime,
          dueTime: body.dueTime,
          reminderAt: body.reminderAt,
          recurring: body.recurring,
          completedAt: undefined,
        },
      },
      context.applyCookies,
    );
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah task.",
      400,
      context.applyCookies,
    );
  }
}
