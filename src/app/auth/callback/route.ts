import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE } from "@/i18n/config";

// Google sends the user back here with a one-time code.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/home";
  // Only allow same-site relative paths (no "//evil.com").
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/home";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Use the language saved on the profile, if the user had chosen one.
      const { data: profile } = await supabase.from("profiles").select("language").eq("id", data.user.id).single();
      if (profile?.language) {
        (await cookies()).set(LOCALE_COOKIE, profile.language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback`);
}
