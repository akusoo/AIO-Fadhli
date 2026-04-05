import type { AddAccountInput } from "@/lib/domain/models";
import { buildAppSnapshot, createAccount } from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddAccountInput & { clientId?: string };
    const name = body.name?.trim();

    if (!name) {
      throw new Error("Nama akun wajib diisi.");
    }

    if (body.balance < 0) {
      throw new Error("Saldo awal tidak boleh negatif.");
    }

    await createAccount(
      context.supabase,
      context.user.id,
      {
        name,
        type: body.type,
        balance: body.balance,
      },
      body.clientId,
    );

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah akun.",
      400,
      context.applyCookies,
    );
  }
}
