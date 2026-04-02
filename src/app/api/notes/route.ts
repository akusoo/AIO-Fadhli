import type { AddNoteInput } from "@/lib/domain/models";
import { buildAppSnapshot, replaceNoteLinks } from "@/lib/server/app-backend";
import { createId } from "@/lib/utils";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddNoteInput & { clientId?: string };
    const noteId = body.clientId ?? createId("note");
    const { error } = await context.supabase.from("notes").insert({
      id: noteId,
      user_id: context.user.id,
      title: body.title,
      content: body.content,
    });

    if (error) {
      throw error;
    }

    if (body.links?.length) {
      await replaceNoteLinks(context.supabase, context.user.id, {
        noteId,
        links: body.links,
      });
    }

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson(
      {
        snapshot,
        item: {
          id: noteId,
          title: body.title,
          content: body.content,
          links: body.links ?? [],
        },
      },
      context.applyCookies,
    );
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah note.",
      400,
      context.applyCookies,
    );
  }
}
