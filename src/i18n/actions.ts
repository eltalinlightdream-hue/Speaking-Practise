"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, toLocale } from "./config";
import { createClient } from "@/lib/supabase/server";

export async function setLocale(value: string) {
  const locale = toLocale(value);
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  // Remember the choice on the profile too, when signed in.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    await supabase.from("profiles").update({ language: locale }).eq("id", data.user.id);
  }

  revalidatePath("/", "layout");
}
