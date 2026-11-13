import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "student" | "admin" | "owner";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  lesson_group_id: string | null;
  role: Role;
  language: "uz" | "en";
  kept: boolean;
};

// Data access layer: every server page reads the user through these helpers.
// cache() makes repeated calls within one request share the same result.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, lesson_group_id, role, language, kept")
    .eq("id", auth.user.id)
    .single();

  return (data as Profile | null) ?? null;
});

export function isSetupComplete(profile: Profile) {
  return Boolean(profile.full_name && profile.lesson_group_id);
}

export function isAdmin(profile: Profile) {
  return profile.role === "admin" || profile.role === "owner";
}

/** Signed in AND finished first-time setup. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isSetupComplete(profile)) redirect("/onboarding");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!isAdmin(profile)) redirect("/home");
  return profile;
}

export async function requireOwner(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "owner") redirect("/home");
  return profile;
}
