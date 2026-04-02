import type { AddRecurringPlanInput } from "@/lib/domain/models";
import { buildAppSnapshot } from "@/lib/server/app-backend";
import { createId } from "@/lib/utils";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddRecurringPlanInput & { clientId?: string };
    const recurringPlan = {
      id: body.clientId ?? createId("rec"),
      user_id: context.user.id,
      label: body.label,
      kind: body.kind,
      amount: body.amount,
      cadence: body.cadence,
      next_occurrence_on: body.nextOccurrenceOn,
      account_id: body.accountId,
      category_id: body.categoryId ?? null,
      merchant: body.merchant ?? null,
      tags: body.tags ?? [],
      note: body.note ?? null,
      enabled: true,
    };

    const { error } = await context.supabase.from("recurring_plans").insert(recurringPlan);

    if (error) {
      throw error;
    }

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah recurring plan.",
      400,
      context.applyCookies,
    );
  }
}
