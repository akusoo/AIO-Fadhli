import type { AddTransactionInput } from "@/lib/domain/models";
import { createTransactionWithSideEffects } from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddTransactionInput & { clientId?: string };
    const transactionId = await createTransactionWithSideEffects(
      context.supabase,
      context.user.id,
      body,
      body.clientId,
    );
    return okJson({ item: { transactionId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah transaksi.",
      400,
      context.applyCookies,
    );
  }
}
