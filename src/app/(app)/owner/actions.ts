"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { webhookSecret } from "@/lib/telegram-auth";
import { telegramApi } from "@/lib/telegram-bot";

/**
 * Owner only: tells Telegram to send the bot's messages to this site
 * (https://<this address>/auth/telegram/webhook) with our secret header.
 * Run it once after setting up the bot, and again if the address changes.
 */
export async function connectTelegramBot(): Promise<{ error?: string }> {
  await requireOwner();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { error: "TELEGRAM_BOT_TOKEN is not set in Vercel." };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return { error: "Unknown site address." };
  const url = `https://${host}/auth/telegram/webhook`;

  const res = await telegramApi("setWebhook", {
    url,
    secret_token: webhookSecret(token),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  revalidatePath("/owner");
  return res.ok ? {} : { error: res.description ?? "Telegram said no." };
}
