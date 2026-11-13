"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: "name" | "group" | "save" };

export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const fullName = String(formData.get("full_name") ?? "").replace(/\s+/g, " ").trim();
  const groupId = String(formData.get("lesson_group_id") ?? "");

  if (fullName.length < 2 || fullName.length > 100) return { error: "name" };
  if (!groupId) return { error: "group" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  // Row level security makes sure users can only update their own row,
  // and column privileges stop them from changing their role.
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, lesson_group_id: groupId })
    .eq("id", auth.user.id);

  if (error) return { error: "save" };
  redirect("/home");
}
