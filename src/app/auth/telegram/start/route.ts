import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOGIN_COOKIE, REQUEST_TTL_SECONDS, hashSecret, randomToken, safeNext } from "@/lib/telegram-auth";

// The login page calls this when the student taps "Continue with Telegram".
// It makes a sign-in request: a public `code` for the bot link and a private
// secret that stays in this browser (httpOnly cookie).
export async function POST(request: Request) {
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim();
  const admin = createAdminClient();
  if (!bot || !process.env.TELEGRAM_BOT_TOKEN || !admin) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { next?: unknown };
  const code = randomToken();
  const secret = randomToken(32);

  // Tidy up: old requests are useless after 10 minutes.
  await admin
    .from("telegram_login_requests")
    .delete()
    .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  const { error } = await admin
    .from("telegram_login_requests")
    .insert({ code, secret_hash: hashSecret(secret), next_path: safeNext(body.next) });
  if (error) {
    console.warn("telegram start failed:", error.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  const response = NextResponse.json({ link: `https://t.me/${bot}?start=${code}` });
  response.cookies.set(LOGIN_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth/telegram",
    maxAge: REQUEST_TTL_SECONDS,
  });
  return response;
}
