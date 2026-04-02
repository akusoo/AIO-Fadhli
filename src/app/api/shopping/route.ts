import type { AddShoppingItemInput } from "@/lib/domain/models";
import { buildAppSnapshot } from "@/lib/server/app-backend";
import { createId } from "@/lib/utils";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddShoppingItemInput & { clientId?: string };
    const { error } = await context.supabase.from("shopping_items").insert({
      id: body.clientId ?? createId("shop"),
      user_id: context.user.id,
      name: body.name,
      estimated_price: body.estimatedPrice,
      quantity: body.quantity,
      section: body.section,
      status: "planned",
      store: body.store ?? null,
      note: body.note ?? null,
      source_wish_id: null,
    });

    if (error) {
      throw error;
    }

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah shopping item.",
      400,
      context.applyCookies,
    );
  }
}
