// Small helpers for Telegram sign-in through the bot (no network here).
//
// How it works:
//  - The login page gets a random `code` and a random `secret`. The code goes
//    into the link t.me/<bot>?start=<code>; the secret stays in an httpOnly
//    cookie in that browser.
//  - The student presses Start in the bot, then "Confirm". Telegram tells our
//    webhook, which marks the request as confirmed for that Telegram user.
//  - The login page asks "confirmed yet?" with its cookie and gets signed in.
//
// No "server-only" import so the unit tests can load this file; it is only used
// by the /auth/telegram/* routes on the server.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** How long a sign-in request stays valid (seconds). */
export const REQUEST_TTL_SECONDS = 10 * 60;

/** Cookie that holds the browser's secret while it waits for the bot. */
export const LOGIN_COOKIE = "tg_login";

/** Prefix of the "Confirm" button's data in the bot. */
const CONFIRM_PREFIX = "ok:";

const CODE_RE = /^[A-Za-z0-9_-]{20,64}$/;

/** A random, URL-safe string (Telegram allows A-Z a-z 0-9 _ - in start codes). */
export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

export function isValidCode(code: string | undefined | null): code is string {
  return typeof code === "string" && CODE_RE.test(code);
}

/** We store only a hash of the browser's secret. */
export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * The secret Telegram sends in the X-Telegram-Bot-Api-Secret-Token header with
 * every webhook call. Made from the bot token, so no extra setting is needed.
 */
export function webhookSecret(botToken: string) {
  return createHmac("sha256", botToken).update("speaking-easy-webhook").digest("hex");
}

/** Compares two strings in constant time. */
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The code from "/start <code>" (null for a plain "/start" or other text). */
export function parseStartCode(text: string | undefined | null) {
  const match = /^\/start(?:@\w+)?\s+(\S+)\s*$/.exec(text ?? "");
  return match && isValidCode(match[1]) ? match[1] : null;
}

/** True for "/start" with or without a code. */
export function isStartCommand(text: string | undefined | null) {
  return /^\/start(?:@\w+)?(?:\s|$)/.test(text ?? "");
}

export function confirmData(code: string) {
  return `${CONFIRM_PREFIX}${code}`;
}

/** The code from the "Confirm" button's data, or null. */
export function parseConfirmData(data: string | undefined | null) {
  if (!data?.startsWith(CONFIRM_PREFIX)) return null;
  const code = data.slice(CONFIRM_PREFIX.length);
  return isValidCode(code) ? code : null;
}

/** Only our own paths (no "//evil.com"). */
export function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/home";
}

/**
 * Supabase needs an email for every account. Telegram gives none, so each
 * Telegram user gets a made-up address on the reserved ".invalid" domain
 * (it can never receive mail and never belongs to anyone).
 */
export function telegramEmail(id: number) {
  return `telegram-${id}@users.invalid`;
}
