import { NextResponse } from "next/server";
import { sendTelegramDigestToOwner, verifyTelegramAdminRequest } from "@/lib/server/telegram-bot";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    verifyTelegramAdminRequest(request);

    const result = await sendTelegramDigestToOwner();

    return NextResponse.json({
      ok: true,
      chatId: result.chatId,
      preview: result.text,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengirim digest Telegram.";
    const status =
      message === "Secret admin Telegram tidak valid."
        ? 401
        : message.includes("belum diset") || message.includes("wajib diset")
          ? 503
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
