import type { SetWishStatusInput } from "@/lib/domain/models";
import { buildAppSnapshot } from "@/lib/server/app-backend";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function POST(
  request: Request,
  contextParam: RouteParamsContext<"wishId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { wishId } = await contextParam.params;
    const body = (await request.json()) as SetWishStatusInput;
    const { error } = await context.supabase
      .from("wish_items")
      .update({ status: body.status })
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
      error instanceof Error ? error.message : "Gagal mengubah status wishlist.",
      400,
      context.applyCookies,
    );
  }
}
