import type { UpdateWishInput } from "@/lib/domain/models";
import { buildAppSnapshot, softDeleteById } from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function PATCH(
  request: Request,
  contextParam: RouteContext<"/api/wishlist/[wishId]">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { wishId } = await contextParam.params;
    const body = (await request.json()) as UpdateWishInput;
    const { error } = await context.supabase
      .from("wish_items")
      .update({
        name: body.name,
        target_price: body.targetPrice,
        priority: body.priority,
        note: body.note ?? null,
      })
      .eq("id", wishId)
      .eq("user_id", context.user.id)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah wishlist item.",
      400,
      context.applyCookies,
    );
  }
}

export async function DELETE(
  _request: Request,
  contextParam: RouteContext<"/api/wishlist/[wishId]">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { wishId } = await contextParam.params;
    await softDeleteById(context.supabase, "wish_items", context.user.id, wishId);
    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menghapus wishlist item.",
      400,
      context.applyCookies,
    );
  }
}
