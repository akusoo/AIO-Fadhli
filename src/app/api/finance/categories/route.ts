import type { AddCategoryInput } from "@/lib/domain/models";
import { buildAppSnapshot, createCategory } from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddCategoryInput & { clientId?: string };
    const name = body.name?.trim();

    if (!name) {
      throw new Error("Nama kategori wajib diisi.");
    }

    await createCategory(
      context.supabase,
      context.user.id,
      {
        name,
        kind: body.kind,
      },
      body.clientId,
    );

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah kategori.",
      400,
      context.applyCookies,
    );
  }
}
