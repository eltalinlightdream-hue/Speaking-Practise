"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { ok?: boolean; error?: "name" | "group" | "save" };

/** Change name and lesson group (the only columns a student may change, with language). */
export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const fullName = String(formData.get("full_name") ?? "").replace(/\s+/g, " ").trim();
  const groupId = String(formData.get("lesson_group_id") ?? "");
  if (fullName.length < 2 || fullName.length > 100) return { error: "name" };
  if (!groupId) return { error: "group" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  // Row level security limits this to the user's own row; column privileges
  // stop anyone from changing their role this way.
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, lesson_group_id: groupId })
    .eq("id", auth.user.id);
  if (error) return { error: "save" };

  revalidatePath("/", "layout");
  return { ok: true };
}

export type DeleteState = { error?: boolean };

/**
 * Delete the signed-in user's account. The database function
 * delete_my_account() does the work (and refuses for the owner).
 */
export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  if (formData.get("confirm") !== "yes") return { error: true };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: true };

  // The account is gone; clear the login cookies on this device.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
