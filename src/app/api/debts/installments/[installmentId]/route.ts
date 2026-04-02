import type { UpdateDebtInstallmentInput } from "@/lib/domain/models";
import {
  buildAppSnapshot,
  updateDebtInstallmentWithSideEffects,
} from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function PATCH(
  request: Request,
  contextParam: RouteContext<"/api/debts/installments/[installmentId]">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { installmentId } = await contextParam.params;
    const body = (await request.json()) as UpdateDebtInstallmentInput;
    await updateDebtInstallmentWithSideEffects(context.supabase, context.user.id, {
      ...body,
      installmentId,
    });
    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah installment.",
      400,
      context.applyCookies,
    );
  }
}
