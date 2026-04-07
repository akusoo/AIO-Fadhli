import type { SetShoppingStatusInput } from "@/lib/domain/models";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function POST(
  request: Request,
  contextParam: RouteParamsContext<"itemId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { itemId } = await contextParam.params;
    const body = (await request.json()) as SetShoppingStatusInput;
    const { error } = await context.supabase
      .from("shopping_items")
      .update({ status: body.status })
      .eq("id", itemId)
      .eq("user_id", context.user.id)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    return okJson({ item: { itemId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah status shopping item.",
      400,
      context.applyCookies,
    );
  }
}
