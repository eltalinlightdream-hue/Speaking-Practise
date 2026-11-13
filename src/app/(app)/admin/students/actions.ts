"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DangerState } from "@/components/danger-confirm";

// The database functions check every rule again (admin_set_kept,
// owner_set_role, admin_delete_user), so these are safe even if a button
// was shown by mistake.

const UUID = /^[0-9a-f-]{36}$/i;

export async function setKept(userId: string, kept: boolean) {
  await requireAdmin();
  if (!UUID.test(userId)) return { error: "bad id" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_kept", { p_user_id: userId, p_kept: kept });
  revalidatePath(`/admin/students/${userId}`);
  return error ? { error: error.message } : {};
}

export async function setRole(userId: string, role: "student" | "admin") {
  await requireAdmin();
  if (!UUID.test(userId) || !["student", "admin"].includes(role)) return { error: "bad input" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("owner_set_role", { p_user_id: userId, p_role: role });
  revalidatePath(`/admin/students/${userId}`);
  revalidatePath("/owner");
  return error ? { error: error.message } : {};
}

export async function deleteUser(_prev: DangerState, formData: FormData): Promise<DangerState> {
  await requireAdmin();
  const t = await getTranslations("admin.students");
  const userId = String(formData.get("user_id") ?? "");
  if (formData.get("confirm") !== "yes" || !UUID.test(userId)) return { error: t("error", { message: "not confirmed" }) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_user", { p_user_id: userId });
  if (error) return { error: t("error", { message: error.message }) };

  revalidatePath("/admin/students");
  redirect("/admin/students");
}
