// Checks a "Log in with Telegram" answer.
//
// Telegram sends the user back to us with their details and a `hash`. The hash
// is an HMAC made with a key that only Telegram and we know (derived from the
// bot token), so a matching hash proves the details really come from Telegram.
// Docs: https://core.telegram.org/widgets/login#checking-authorization
//
// No "server-only" import here so the unit tests can load it; it is only
// used by the /auth/telegram route on the server.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
};

/** Query keys that we add ourselves; Telegram did not sign them. */
const OUR_KEYS = new Set(["hash", "next"]);

/** How old a login answer may be (seconds). */
export const MAX_AGE_SECONDS = 60 * 60;

export function telegramCheckString(params: Record<string, string>) {
  return Object.keys(params)
    .filter((k) => !OUR_KEYS.has(k))
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("\n");
}

export function telegramHash(params: Record<string, string>, botToken: string) {
  const secret = createHash("sha256").update(botToken).digest();
  return createHmac("sha256", secret).update(telegramCheckString(params)).digest("hex");
}

/** The Telegram user if the answer is real and fresh, otherwise null. */
export function verifyTelegramLogin(
  params: Record<string, string>,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = MAX_AGE_SECONDS,
): TelegramUser | null {
  const { hash, id, first_name, auth_date } = params;
  if (!botToken || !hash || !/^[0-9a-f]{64}$/i.test(hash) || !/^\d+$/.test(id ?? "") || !first_name || !/^\d+$/.test(auth_date ?? "")) {
    return null;
  }

  const expected = Buffer.from(telegramHash(params, botToken), "hex");
  const given = Buffer.from(hash.toLowerCase(), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const age = nowSeconds - Number(auth_date);
  if (age > maxAgeSeconds || age < -60) return null;

  return {
    id: Number(id),
    first_name,
    last_name: params.last_name || undefined,
    username: params.username || undefined,
    photo_url: params.photo_url || undefined,
    auth_date: Number(auth_date),
  };
}

/**
 * Supabase needs an email for every account. Telegram gives none, so each
 * Telegram user gets a made-up address on the reserved ".invalid" domain
 * (it can never receive mail and never belongs to anyone).
 */
export function telegramEmail(id: number) {
  return `telegram-${id}@users.invalid`;
}
