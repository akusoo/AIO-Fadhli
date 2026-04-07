import type { AddBudgetCycleInput } from "@/lib/domain/models";
import { createBudgetCycle } from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddBudgetCycleInput & { clientId?: string };
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

    const cycleId = await createBudgetCycle(
      context.supabase,
      context.user.id,
      {
        label,
        startOn: body.startOn,
        endOn: body.endOn,
        targetAmount: body.targetAmount,
        status: body.status,
      },
      body.clientId,
    );

    return okJson({ item: { cycleId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah budget cycle.",
      400,
      context.applyCookies,
    );
  }
}
