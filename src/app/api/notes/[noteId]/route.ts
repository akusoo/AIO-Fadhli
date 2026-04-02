import type { UpdateNoteInput } from "@/lib/domain/models";
import { buildAppSnapshot } from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function PATCH(
  request: Request,
  contextParam: RouteContext<"/api/notes/[noteId]">,
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

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah note.",
      400,
      context.applyCookies,
    );
  }
}
