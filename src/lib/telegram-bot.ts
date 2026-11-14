import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { telegramEmail } from "@/lib/telegram-auth";
import { LOCALE_COOKIE } from "@/i18n/config";

export type TelegramProfile = {
  id: number;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
};

/** Calls the Telegram Bot API. Returns Telegram's JSON answer. */
export async function telegramApi<T = unknown>(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not set" } as { ok: boolean; result?: T; description?: string };
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return (await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }))) as {
    ok: boolean;
    result?: T;
    description?: string;
  };
}

export type TelegramLoginInfo = { login_email: string; role: "student" | "admin" | "owner" | null };

/**
 * Which account this Telegram user signs in to, and its role (null = no account yet).
 * The owner's Telegram id (private.app_config 'owner_telegram_id') leads to the
 * owner's email account, so the owner has ONE account for email and Telegram.
 */
export async function telegramLoginInfo(telegramId: number): Promise<TelegramLoginInfo | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("telegram_login_info", { p_telegram_id: telegramId }).single<TelegramLoginInfo>();
  if (error) console.warn("telegram_login_info failed:", error.message);
  return data ?? null;
}

/**
 * Signs THIS browser in as the given Telegram user:
 * creates the Supabase account the first time, then makes a one-time sign-in
 * token on the server and uses it at once (that sets the normal login cookies).
 * Returns an error message, or null when it worked.
 */
export async function signInTelegramUser(tg: TelegramProfile): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return "not configured";

  const info = await telegramLoginInfo(tg.id);
  if (!info) return "login info failed";
  const email = info.login_email;
  const isTelegramAccount = email === telegramEmail(tg.id);
  const fullName = [tg.first_name, tg.last_name].filter(Boolean).join(" ").trim();

  // First visit: create the account. Later visits: it already exists.
  if (info.role === null) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName, telegram_id: tg.id, telegram_username: tg.username ?? null },
      app_metadata: { provider: isTelegramAccount ? "telegram" : "email" },
    });
    if (created.error && created.error.code !== "email_exists" && created.error.status !== 422) {
      return `create user: ${created.error.message}`;
    }
    if (created.data.user && isTelegramAccount) {
      // Don't show the made-up address anywhere.
      await admin.from("profiles").update({ email: null }).eq("id", created.data.user.id);
    }
  }

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return `link: ${link.error?.message ?? "no token"}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error || !data.user) return `verify: ${error?.message ?? "no user"}`;

  const { data: profile } = await supabase.from("profiles").select("language").eq("id", data.user.id).single();
  if (profile?.language) {
    (await cookies()).set(LOCALE_COOKIE, profile.language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return null;
}
