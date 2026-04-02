import type { AddTransactionInput } from "@/lib/domain/models";
import { buildAppSnapshot, createTransactionWithSideEffects } from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddTransactionInput & { clientId?: string };
    await createTransactionWithSideEffects(
      context.supabase,
      context.user.id,
      body,
      body.clientId,
    );
    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah transaksi.",
      400,
      context.applyCookies,
    );
  }
}
