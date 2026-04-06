import type { UpdateTransactionInput } from "@/lib/domain/models";
import {
  buildAppSnapshot,
  updateTransactionWithSideEffects,
} from "@/lib/server/app-backend";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function PATCH(
  request: Request,
  contextParam: RouteParamsContext<"transactionId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { transactionId } = await contextParam.params;
    const body = (await request.json()) as UpdateTransactionInput;

    await updateTransactionWithSideEffects(context.supabase, context.user.id, {
      ...body,
      transactionId,
    });

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah transaksi.",
      400,
      context.applyCookies,
    );
  }
}
