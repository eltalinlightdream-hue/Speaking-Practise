import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { telegramEmail, verifyTelegramLogin } from "@/lib/telegram-auth";
import { LOCALE_COOKIE } from "@/i18n/config";

// Telegram sends the user back here after "Log in with Telegram".
// 1. Check Telegram's signature (so nobody can pretend to be someone else).
// 2. Create the Supabase account the first time.
// 3. Make a one-time sign-in token on the server and use it at once,
//    which sets the normal login cookies.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const fail = (reason: string) => {
    console.warn("telegram login failed:", reason);
    return NextResponse.redirect(`${origin}/login?error=telegram`);
  };

  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const admin = createAdminClient();
  if (!botToken || !admin) return fail("not configured");

  const params = Object.fromEntries(url.searchParams);
  const tg = verifyTelegramLogin(params, botToken);
  if (!tg) return fail("bad or old signature");

  const nextParam = params.next ?? "/home";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/home";
  const email = telegramEmail(tg.id);
  const fullName = [tg.first_name, tg.last_name].filter(Boolean).join(" ").trim();

  // First visit: create the account. Later visits: it already exists.
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, telegram_id: tg.id, telegram_username: tg.username ?? null, avatar_url: tg.photo_url ?? null },
    app_metadata: { provider: "telegram" },
  });
  if (created.error && created.error.code !== "email_exists" && created.error.status !== 422) {
    return fail(`create user: ${created.error.message}`);
  }
  if (created.data.user) {
    // Don't show the made-up address anywhere.
    await admin.from("profiles").update({ email: null }).eq("id", created.data.user.id);
  }

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return fail(`link: ${link.error?.message ?? "no token"}`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error || !data.user) return fail(`verify: ${error?.message ?? "no user"}`);

  const { data: profile } = await supabase.from("profiles").select("language").eq("id", data.user.id).single();
  if (profile?.language) {
    (await cookies()).set(LOCALE_COOKIE, profile.language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return NextResponse.redirect(`${origin}${next}`);
}
