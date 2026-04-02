import { buildAppSnapshot, moveWishToShoppingWithSideEffects } from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(
  _request: Request,
  contextParam: RouteContext<"/api/wishlist/[wishId]/move-to-shopping">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { wishId } = await contextParam.params;
    await moveWishToShoppingWithSideEffects(context.supabase, context.user.id, wishId);
    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal memindahkan wishlist ke shopping.",
      400,
      context.applyCookies,
    );
  }
}
