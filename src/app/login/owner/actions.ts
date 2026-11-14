"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type OwnerLoginState = { status?: "sent" | "invalid" | "error" };

// Owner-only email sign-in. Sends a one-time sign-in link, but ONLY to the
// owner email stored in the database (private.app_config 'owner_email').
// The answer is the same for every address, so nobody can find out the
// owner email by guessing. New sign-ups by email are switched off in
// Supabase, so this cannot be used to make student accounts either.
export async function sendOwnerLink(_prev: OwnerLoginState, formData: FormData): Promise<OwnerLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return { status: "invalid" };

  const admin = createAdminClient();
  if (!admin) return { status: "error" };

  const { data: isOwner, error } = await admin.rpc("is_owner_email", { p_email: email });
  if (error) {
    console.warn("owner login check failed:", error.message);
    return { status: "error" };
  }
  if (!isOwner) return { status: "sent" };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback?next=/home` },
  });
  if (otpError) {
    console.warn("owner login email failed:", otpError.message);
    return { status: "error" };
  }
  return { status: "sent" };
}
