import type { UpdateNoteInput } from "@/lib/domain/models";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function PATCH(
  request: Request,
  contextParam: RouteParamsContext<"noteId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { noteId } = await contextParam.params;
    const body = (await request.json()) as UpdateNoteInput;
    const { error } = await context.supabase
      .from("notes")
      .update({
        title: body.title,
        content: body.content,
      })
      .eq("id", noteId)
      .eq("user_id", context.user.id)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    return okJson({ item: { noteId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah note.",
      400,
      context.applyCookies,
    );
  }
}
