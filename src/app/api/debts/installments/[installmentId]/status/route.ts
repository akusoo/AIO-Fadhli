import type { UpdateDebtInstallmentStatusInput } from "@/lib/domain/models";
import {
  buildAppSnapshot,
  updateDebtInstallmentStatusWithSideEffects,
} from "@/lib/server/app-backend";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function POST(
  request: Request,
  contextParam: RouteParamsContext<"installmentId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { installmentId } = await contextParam.params;
    const body = (await request.json()) as UpdateDebtInstallmentStatusInput;
    await updateDebtInstallmentStatusWithSideEffects(context.supabase, context.user.id, {
      ...body,
      installmentId,
    });
    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah status installment.",
      400,
      context.applyCookies,
    );
  }
}
