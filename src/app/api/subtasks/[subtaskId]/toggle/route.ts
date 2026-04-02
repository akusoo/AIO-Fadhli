import { buildAppSnapshot } from "@/lib/server/app-backend";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function POST(
  _request: Request,
  contextParam: RouteParamsContext<"subtaskId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { subtaskId } = await contextParam.params;
    const { data: subtask, error } = await context.supabase
      .from("subtasks")
      .select("id,done")
      .eq("id", subtaskId)
      .eq("user_id", context.user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!subtask) {
      throw new Error("Subtask tidak ditemukan.");
    }

    const { error: updateError } = await context.supabase
      .from("subtasks")
      .update({ done: !subtask.done })
      .eq("id", subtaskId);

    if (updateError) {
      throw updateError;
    }

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah status subtask.",
      400,
      context.applyCookies,
    );
  }
}
