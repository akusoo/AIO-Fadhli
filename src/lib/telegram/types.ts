export type TelegramChat = {
  id: number | string;
  type: string;
};

export type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  text?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};
