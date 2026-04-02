import type { SetNoteLinksInput } from "@/lib/domain/models";
import { buildAppSnapshot, replaceNoteLinks } from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function PUT(
  request: Request,
  contextParam: RouteContext<"/api/notes/[noteId]/links">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { noteId } = await contextParam.params;
    const body = (await request.json()) as SetNoteLinksInput;
    await replaceNoteLinks(context.supabase, context.user.id, {
      ...body,
      noteId,
    });
    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah relasi note.",
      400,
      context.applyCookies,
    );
  }
}
