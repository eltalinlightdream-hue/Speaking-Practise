import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOGIN_COOKIE, REQUEST_TTL_SECONDS, hashSecret, safeNext } from "@/lib/telegram-auth";
import { signInTelegramUser } from "@/lib/telegram-bot";

type Status = "pending" | "ok" | "expired" | "error";

// The login page asks this every few seconds: "has the student confirmed in
// the bot yet?". Only the browser that holds the secret cookie can ask, and
// a confirmed request is used exactly once (deleted as it is used).
export async function POST() {
  const jar = await cookies();
  const secret = jar.get(LOGIN_COOKIE)?.value;
  const admin = createAdminClient();
  const answer = (status: Status, next?: string) => {
    const res = NextResponse.json({ status, next });
    if (status !== "pending") res.cookies.set(LOGIN_COOKIE, "", { path: "/auth/telegram", maxAge: 0 });
    return res;
  };
  if (!secret || !admin) return answer("expired");

  const secretHash = hashSecret(secret);
  const { data: row } = await admin
    .from("telegram_login_requests")
    .select("confirmed_at, created_at")
    .eq("secret_hash", secretHash)
    .maybeSingle();

  if (!row || Date.now() - new Date(row.created_at).getTime() > REQUEST_TTL_SECONDS * 1000) {
    if (row) await admin.from("telegram_login_requests").delete().eq("secret_hash", secretHash);
    return answer("expired");
  }
  if (!row.confirmed_at) return answer("pending");

  // Take the confirmed request (delete + read in one step, so it works once).
  const { data: taken } = await admin
    .from("telegram_login_requests")
    .delete()
    .eq("secret_hash", secretHash)
    .not("confirmed_at", "is", null)
    .select("telegram_id, first_name, last_name, username, next_path")
    .maybeSingle();
  if (!taken?.telegram_id || !taken.first_name) return answer("expired");

  const problem = await signInTelegramUser({
    id: Number(taken.telegram_id),
    first_name: taken.first_name,
    last_name: taken.last_name,
    username: taken.username,
  });
  if (problem) {
    console.warn("telegram sign-in failed:", problem);
    return answer("error");
  }
  return answer("ok", safeNext(taken.next_path));
}
