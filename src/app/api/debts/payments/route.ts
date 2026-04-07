import type { PayDebtInput } from "@/lib/domain/models";
import { payDebtWithSideEffects } from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as PayDebtInput;
    await payDebtWithSideEffects(context.supabase, context.user.id, body);
    return okJson({ item: { installmentId: body.installmentId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal membayar cicilan.",
      400,
      context.applyCookies,
    );
  }
}
