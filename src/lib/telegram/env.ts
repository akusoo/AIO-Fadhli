export function hasTelegramBotEnv() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function getTelegramBotEnv() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() || undefined;
  const ownerUserId = process.env.TELEGRAM_OWNER_USER_ID?.trim() || undefined;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined;

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN belum diset.");
  }

  return {
    botToken,
    chatId,
    ownerUserId,
    webhookSecret,
  };
}

export function getTelegramAuthorizedChatId() {
  const { chatId } = getTelegramBotEnv();

  if (!chatId) {
    throw new Error("TELEGRAM_CHAT_ID belum diset.");
  }

  return chatId;
}

export function getTelegramWebhookSecret() {
  const { webhookSecret } = getTelegramBotEnv();

  if (!webhookSecret) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET belum diset.");
  }

  return webhookSecret;
}
