import { createSupabaseAdmin, hasSupabaseAdminEnv } from "@/lib/services/supabase-admin";
import { buildTelegramBudgetMessage, buildTelegramDebtMessage, buildTelegramDigest, buildTelegramHelpMessage, buildTelegramTodayMessage } from "@/lib/reminders/telegram";
import { buildAppSnapshot } from "@/lib/server/app-backend";
import { sendTelegramMessage } from "@/lib/telegram/client";
import { getTelegramAuthorizedChatId, getTelegramBotEnv, getTelegramWebhookSecret, hasTelegramBotEnv } from "@/lib/telegram/env";
import type { TelegramMessage, TelegramUpdate } from "@/lib/telegram/types";

function getIncomingTelegramMessage(update: TelegramUpdate) {
  return update.message ?? update.edited_message;
}

function normalizeTelegramCommand(text?: string) {
  const token = text?.trim().split(/\s+/)[0];

  if (!token?.startsWith("/")) {
    return null;
  }

  return token.slice(1).split("@")[0]?.toLowerCase() ?? null;
}

async function resolveOwnerUserId() {
  const admin = createSupabaseAdmin();
  const { ownerUserId } = getTelegramBotEnv();

  if (ownerUserId) {
    return ownerUserId;
  }

  const { data, error } = await admin.from("profiles").select("id").order("created_at").limit(2);

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("Belum ada profile user yang bisa dipakai oleh bot Telegram.");
  }

  if (data.length > 1) {
    throw new Error(
      "Ada lebih dari satu profile. Set TELEGRAM_OWNER_USER_ID agar bot tahu data user mana yang harus dibaca.",
    );
  }

  return data[0].id as string;
}

async function loadTelegramSnapshot() {
  if (!hasTelegramBotEnv()) {
    throw new Error("Bot Telegram belum dikonfigurasi.");
  }

  if (!hasSupabaseAdminEnv()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY wajib diset untuk bot Telegram.");
  }

  const admin = createSupabaseAdmin();
  const userId = await resolveOwnerUserId();
  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error(`User owner Telegram ${userId} tidak ditemukan.`);
  }

  const snapshot = await buildAppSnapshot(admin, data.user);

  return {
    snapshot,
  };
}

function isAuthorizedTelegramMessage(message: TelegramMessage) {
  return String(message.chat.id) === getTelegramAuthorizedChatId();
}

async function buildTelegramCommandReply(command: string | null, update: TelegramUpdate) {
  if (command === "start" || command === "help") {
    return buildTelegramHelpMessage();
  }

  if (command === "ping") {
    return "Bot Telegram aktif dan webhook sudah menerima pesan.";
  }

  const { snapshot } = await loadTelegramSnapshot();

  switch (command) {
    case "digest":
      return buildTelegramDigest(snapshot);
    case "today":
      return buildTelegramTodayMessage(snapshot);
    case "debts":
      return buildTelegramDebtMessage(snapshot);
    case "budget":
      return buildTelegramBudgetMessage(snapshot);
    default: {
      const message = getIncomingTelegramMessage(update);
      const text = message?.text?.trim();

      if (!text) {
        return "Pesan diterima, tapi belum ada teks yang bisa diproses.";
      }

      return [`Perintah "${text}" belum dikenali.`, "", buildTelegramHelpMessage()].join("\n");
    }
  }
}

export function verifyTelegramWebhookRequest(request: Request) {
  const expectedSecret = getTelegramWebhookSecret();
  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token");

  if (receivedSecret !== expectedSecret) {
    throw new Error("Secret webhook Telegram tidak valid.");
  }
}

export function verifyTelegramAdminRequest(request: Request) {
  const expectedSecret = getTelegramWebhookSecret();
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;
  const headerToken = request.headers.get("x-telegram-admin-secret");
  const receivedSecret = bearerToken || headerToken;

  if (receivedSecret !== expectedSecret) {
    throw new Error("Secret admin Telegram tidak valid.");
  }
}

export async function handleTelegramWebhookUpdate(update: TelegramUpdate) {
  const message = getIncomingTelegramMessage(update);

  if (!message) {
    return { handled: false, reason: "no-message" } as const;
  }

  if (!isAuthorizedTelegramMessage(message)) {
    return { handled: false, reason: "unauthorized-chat" } as const;
  }

  const reply = await buildTelegramCommandReply(normalizeTelegramCommand(message.text), update);
  await sendTelegramMessage(String(message.chat.id), reply);

  return { handled: true, reason: "replied" } as const;
}

export async function sendTelegramDigestToOwner() {
  const chatId = getTelegramAuthorizedChatId();
  const { snapshot } = await loadTelegramSnapshot();
  const text = buildTelegramDigest(snapshot);

  await sendTelegramMessage(chatId, text);

  return {
    chatId,
    text,
  };
}
