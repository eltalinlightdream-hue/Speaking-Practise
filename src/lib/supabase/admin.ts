import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Supabase with the SERVICE ROLE key: it skips row level security, so it is
 * used ONLY on the server, only for Telegram sign-in (creating the account and
 * a one-time sign-in token). The key lives in the hosting settings, never in git
 * and never in the browser (no NEXT_PUBLIC_ prefix).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
