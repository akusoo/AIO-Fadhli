import { NextResponse } from "next/server";
import { handleTelegramWebhookUpdate, verifyTelegramWebhookRequest } from "@/lib/server/telegram-bot";
import type { TelegramUpdate } from "@/lib/telegram/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    verifyTelegramWebhookRequest(request);

    const update = (await request.json()) as TelegramUpdate;
    const result = await handleTelegramWebhookUpdate(update);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memproses webhook Telegram.";
    const status =
      message === "Secret webhook Telegram tidak valid."
        ? 401
        : message.includes("belum diset") || message.includes("wajib diset")
          ? 503
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
