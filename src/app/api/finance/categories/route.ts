import type { AddCategoryInput } from "@/lib/domain/models";
import { createCategory } from "@/lib/server/app-backend";
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

    const categoryId = await createCategory(
      context.supabase,
      context.user.id,
      {
        name,
        kind: body.kind,
      },
      body.clientId,
    );

    return okJson({ item: { categoryId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah kategori.",
      400,
      context.applyCookies,
    );
  }
}
