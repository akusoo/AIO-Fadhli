import { getTelegramBotEnv } from "@/lib/telegram/env";

type TelegramApiResponse<T> = {
  ok: boolean;
  description?: string;
  result: T;
};

async function callTelegramApi<T>(method: string, payload: Record<string, unknown>) {
  const { botToken } = getTelegramBotEnv();
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as TelegramApiResponse<T>;

  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API ${method} gagal.`);
  }

  return data.result;
}

export async function sendTelegramMessage(chatId: string, text: string) {
  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}
