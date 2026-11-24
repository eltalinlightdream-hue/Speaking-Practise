import "server-only";
import { telegramApi } from "@/lib/telegram-bot";

/** Telegram allows about 30 messages a second; stay well under it. */
const GAP_MS = 50;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SendAnswer = { ok: boolean; description?: string; error_code?: number; parameters?: { retry_after?: number } };

/**
 * Sends the same plain-text message to each chat, one after another.
 * A chat that blocked the bot (or deleted Telegram) counts as failed; the rest still get it.
 * When Telegram says "too many requests", waits as long as it asks and tries once more.
 */
export async function sendToChats(chatIds: number[], text: string): Promise<{ delivered: number; failed: number }> {
  let delivered = 0;
  let failed = 0;
  for (const chatId of chatIds) {
    let answer = (await telegramApi("sendMessage", { chat_id: chatId, text, link_preview_options: { is_disabled: true } })) as SendAnswer;
    if (!answer.ok && answer.error_code === 429) {
      await sleep(Math.min(answer.parameters?.retry_after ?? 1, 30) * 1000);
      answer = (await telegramApi("sendMessage", { chat_id: chatId, text, link_preview_options: { is_disabled: true } })) as SendAnswer;
    }
    if (answer.ok) delivered++;
    else failed++;
    await sleep(GAP_MS);
  }
  return { delivered, failed };
}
