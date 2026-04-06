import type { AddInvestmentInput } from "@/lib/domain/models";
import {
  buildAppSnapshot,
  createInvestmentWithSideEffects,
} from "@/lib/server/app-backend";
import { errorJson, getAuthedRouteContext, okJson } from "@/lib/server/routes";

export async function POST(request: Request) {
  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  try {
    const body = (await request.json()) as AddInvestmentInput & { clientId?: string };
    const name = body.name?.trim();
    const platform = body.platform?.trim();

    if (!name) {
      throw new Error("Nama investasi wajib diisi.");
    }

    if (!platform) {
      throw new Error("Platform investasi wajib diisi.");
    }

    if (!body.accountId) {
      throw new Error("Akun sumber wajib dipilih.");
    }

    if (!body.startDate) {
      throw new Error("Tanggal mulai wajib diisi.");
    }

    if (body.investedAmount <= 0 || body.currentValue < 0) {
      throw new Error("Nilai investasi tidak valid.");
    }

    await createInvestmentWithSideEffects(
      context.supabase,
      context.user.id,
      {
        ...body,
        name,
        platform,
      },
      body.clientId,
    );

    const snapshot = await buildAppSnapshot(context.supabase, context.user);
    return okJson({ snapshot }, context.applyCookies);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "Gagal menambah investasi.",
      400,
      context.applyCookies,
    );
  }
}
