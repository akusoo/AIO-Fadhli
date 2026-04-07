import type { AddInvestmentValuationInput } from "@/lib/domain/models";
import {
  addInvestmentValuationWithSideEffects,
} from "@/lib/server/app-backend";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function POST(
  request: Request,
  contextParam: RouteParamsContext<"investmentId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { investmentId } = await contextParam.params;
    const body = (await request.json()) as Omit<AddInvestmentValuationInput, "investmentId">;

    if (!body.valuedOn) {
      throw new Error("Tanggal valuasi wajib diisi.");
    }

    if (body.currentValue < 0) {
      throw new Error("Nilai valuasi tidak boleh negatif.");
    }

    await addInvestmentValuationWithSideEffects(context.supabase, context.user.id, {
      ...body,
      investmentId,
    });

    return okJson(
      {
        item: {
          investmentId,
          valuedOn: body.valuedOn,
        },
      },
      context.applyCookies,
    );
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menyimpan valuasi investasi.",
      400,
      context.applyCookies,
    );
  }
}
