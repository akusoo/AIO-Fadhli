import {
  recordShoppingPurchaseWithSideEffects,
} from "@/lib/server/app-backend";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function POST(
  _request: Request,
  contextParam: RouteParamsContext<"itemId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { itemId } = await contextParam.params;
    await recordShoppingPurchaseWithSideEffects(context.supabase, context.user.id, itemId);
    return okJson({ item: { itemId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mencatat shopping purchase.",
      400,
      context.applyCookies,
    );
  }
}
