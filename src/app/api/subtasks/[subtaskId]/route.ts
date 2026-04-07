import type { UpdateSubtaskInput } from "@/lib/domain/models";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function PATCH(
  request: Request,
  contextParam: RouteParamsContext<"subtaskId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { subtaskId } = await contextParam.params;
    const body = (await request.json()) as UpdateSubtaskInput;
    const { error } = await context.supabase
      .from("subtasks")
      .update({
        title: body.title,
        note: body.note ?? null,
      })
      .eq("id", subtaskId)
      .eq("user_id", context.user.id)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    return okJson({ item: { subtaskId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah subtask.",
      400,
      context.applyCookies,
    );
  }
}
