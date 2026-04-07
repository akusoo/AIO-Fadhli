import type { UpdateBudgetCycleInput } from "@/lib/domain/models";
import { updateBudgetCycle } from "@/lib/server/app-backend";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function PATCH(
  request: Request,
  contextParam: RouteParamsContext<"cycleId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { cycleId } = await contextParam.params;
    const body = (await request.json()) as UpdateBudgetCycleInput;
    const label = body.label?.trim();

    if (!label) {
      throw new Error("Label cycle wajib diisi.");
    }

    if (!body.startOn || !body.endOn) {
      throw new Error("Tanggal mulai dan selesai wajib diisi.");
    }

    if (body.endOn < body.startOn) {
      throw new Error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    }

    if (body.targetAmount < 0) {
      throw new Error("Target budget tidak boleh negatif.");
    }

    await updateBudgetCycle(context.supabase, context.user.id, {
      ...body,
      cycleId,
      label,
    });

    return okJson({ item: { cycleId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah budget cycle.",
      400,
      context.applyCookies,
    );
  }
}
