import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";
import { advanceRecurringTask } from "@/lib/tasks";
import { isoToday } from "@/lib/utils";

export async function POST(
  request: Request,
  contextParam: RouteParamsContext<"taskId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { taskId } = await contextParam.params;
    const body = (await request.json()) as { status: "todo" | "doing" | "done" };
    const { data: task, error } = await context.supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", context.user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!task) {
      throw new Error("Task tidak ditemukan.");
    }

    const nextTask = {
      ...task,
      status: body.status,
      completed_at: null as string | null,
      today_pinned: body.status === "done" ? false : task.today_pinned,
    };

    if (body.status === "done" && task.recurring_cadence) {
      const advanced = advanceRecurringTask({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueOn: task.due_on ?? undefined,
        projectId: task.project_id ?? undefined,
        todayPinned: task.today_pinned,
        note: task.note ?? undefined,
        startTime: task.start_time ?? undefined,
        dueTime: task.due_time ?? undefined,
        reminderAt: task.reminder_at ?? undefined,
        completedAt: task.completed_at ?? undefined,
        recurring: {
          cadence: task.recurring_cadence,
          interval: task.recurring_interval ?? undefined,
        },
      });

      nextTask.status = advanced.status;
      nextTask.due_on = advanced.dueOn ?? null;
      nextTask.reminder_at = advanced.reminderAt ?? null;
      nextTask.completed_at = advanced.completedAt ?? `${isoToday()}T00:00`;
      nextTask.today_pinned = advanced.todayPinned;
    } else if (body.status === "done") {
      nextTask.completed_at = `${isoToday()}T00:00`;
    }

    const { error: updateError } = await context.supabase
      .from("tasks")
      .update({
        status: nextTask.status,
        due_on: nextTask.due_on ?? null,
        reminder_at: nextTask.reminder_at ?? null,
        completed_at: nextTask.completed_at,
        today_pinned: nextTask.today_pinned,
      })
      .eq("id", taskId);

    if (updateError) {
      throw updateError;
    }

    return okJson({ item: { taskId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal memindahkan status task.",
      400,
      context.applyCookies,
    );
  }
}
