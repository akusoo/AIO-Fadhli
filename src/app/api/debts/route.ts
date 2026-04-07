import type { AddDebtInput } from "@/lib/domain/models";
import { addDebtWithInstallments } from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddDebtInput;
    await addDebtWithInstallments(context.supabase, context.user.id, body);
    return okJson({ item: { debtName: body.name } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah debt.",
      400,
      context.applyCookies,
    );
  }
}
