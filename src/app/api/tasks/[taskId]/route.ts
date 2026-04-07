import type { UpdateTaskInput } from "@/lib/domain/models";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function PATCH(
  request: Request,
  contextParam: RouteParamsContext<"taskId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { taskId } = await contextParam.params;
    const body = (await request.json()) as UpdateTaskInput;
    const { error } = await context.supabase
      .from("tasks")
      .update({
        title: body.title,
        status: body.status,
        priority: body.priority,
        due_on: body.dueOn ?? null,
        project_id: body.projectId ?? null,
        today_pinned: body.todayPinned ?? false,
        note: body.note ?? null,
        start_time: body.startTime ?? null,
        due_time: body.dueTime ?? null,
        reminder_at: body.reminderAt ?? null,
        completed_at: body.completedAt ?? null,
        recurring_cadence: body.recurring?.cadence ?? null,
        recurring_interval: body.recurring?.interval ?? null,
      })
      .eq("id", taskId)
      .eq("user_id", context.user.id)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    return okJson({ item: { taskId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah task.",
      400,
      context.applyCookies,
    );
  }
}
