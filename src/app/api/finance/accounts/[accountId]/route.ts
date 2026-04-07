import type { UpdateAccountInput } from "@/lib/domain/models";
import {
  deleteAccountWithSideEffects,
  updateAccount,
} from "@/lib/server/app-backend";
import {
  errorJson,
  getAuthedRouteContext,
  okJson,
  type RouteParamsContext,
} from "@/lib/server/routes";

export async function PATCH(
  request: Request,
  contextParam: RouteParamsContext<"accountId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { accountId } = await contextParam.params;
    const body = (await request.json()) as Omit<UpdateAccountInput, "accountId">;
    const name = body.name?.trim();

    if (!name) {
      throw new Error("Nama akun wajib diisi.");
    }

    if (body.balance < 0) {
      throw new Error("Saldo akun tidak boleh negatif.");
    }

    await updateAccount(context.supabase, context.user.id, {
      accountId,
      name,
      type: body.type,
      balance: body.balance,
    });

    return okJson({ item: { accountId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal mengubah akun.",
      400,
      context.applyCookies,
    );
  }
}

export async function DELETE(
  _request: Request,
  contextParam: RouteParamsContext<"accountId">,
) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const { accountId } = await contextParam.params;
    await deleteAccountWithSideEffects(context.supabase, context.user.id, accountId);

    return okJson({ item: { accountId } }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menghapus akun.",
      400,
      context.applyCookies,
    );
  }
}
