import type { UpdateInvestmentInput } from "@/lib/domain/models";
import {
  softDeleteById,
  updateInvestment,
} from "@/lib/server/app-backend";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function PATCH(
  request: Request,
  contextParam: RouteParamsContext<"investmentId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { investmentId } = await contextParam.params;
    const body = (await request.json()) as Omit<UpdateInvestmentInput, "investmentId">;

    await updateInvestment(context.supabase, context.user.id, {
      ...body,
      investmentId,
    });

    return okJson({ item: { investmentId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah investasi.",
      400,
      context.applyCookies,
    );
  }
}

export async function DELETE(
  _request: Request,
  contextParam: RouteParamsContext<"investmentId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { investmentId } = await contextParam.params;
    await softDeleteById(context.supabase, "investments", context.user.id, investmentId);
    return okJson({ item: { investmentId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menghapus investasi.",
      400,
      context.applyCookies,
    );
  }
}
