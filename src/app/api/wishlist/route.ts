import type { AddWishInput } from "@/lib/domain/models";
import { createId } from "@/lib/utils";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddWishInput & { clientId?: string };
    const wishId = body.clientId ?? createId("wish");
    const { error } = await context.supabase.from("wish_items").insert({
      id: wishId,
      user_id: context.user.id,
      name: body.name,
      target_price: body.targetPrice,
      priority: body.priority,
      status: "wish",
      note: body.note ?? null,
      source_url: body.sourceUrl ?? null,
      image_url: body.imageUrl ?? null,
    });

    if (error) {
      throw error;
    }

    return okJson({ item: { wishId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah wishlist item.",
      400,
      context.applyCookies,
    );
  }
}
