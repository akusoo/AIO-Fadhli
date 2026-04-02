import { buildAppSnapshot } from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(
  _request: Request,
  contextParam: RouteContext<"/api/tasks/[taskId]/pin">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { taskId } = await contextParam.params;
    const { data: task, error } = await context.supabase
      .from("tasks")
      .select("id,today_pinned,status")
      .eq("id", taskId)
      .eq("user_id", context.user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!task || task.status === "done") {
      throw new Error("Task tidak bisa dipin.");
    }

    const { error: updateError } = await context.supabase
      .from("tasks")
      .update({ today_pinned: !task.today_pinned })
      .eq("id", taskId);

    if (updateError) {
      throw updateError;
    }

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah pin task.",
      400,
      context.applyCookies,
    );
  }
}
