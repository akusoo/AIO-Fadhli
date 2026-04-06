import type { UpdateShoppingItemInput } from "@/lib/domain/models";
import {
  buildAppSnapshot,
  deleteShoppingItemWithSideEffects,
} from "@/lib/server/app-backend";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function PATCH(
  request: Request,
  contextParam: RouteParamsContext<"itemId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { itemId } = await contextParam.params;
    const body = (await request.json()) as UpdateShoppingItemInput;
    const { error } = await context.supabase
      .from("shopping_items")
      .update({
        name: body.name,
        estimated_price: body.estimatedPrice,
        quantity: body.quantity,
        section: body.section,
        store: body.store ?? null,
        note: body.note ?? null,
      })
      .eq("id", itemId)
      .eq("user_id", context.user.id)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah shopping item.",
      400,
      context.applyCookies,
    );
  }
}

export async function DELETE(
  _request: Request,
  contextParam: RouteParamsContext<"itemId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { itemId } = await contextParam.params;
    await deleteShoppingItemWithSideEffects(context.supabase, context.user.id, itemId);
    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menghapus shopping item.",
      400,
      context.applyCookies,
    );
  }
}
