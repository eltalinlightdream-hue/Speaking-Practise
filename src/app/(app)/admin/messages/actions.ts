"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadGroups } from "@/lib/admin/queries";
import { groupIdsFor, readGroupFilter, selectedTeacher } from "@/lib/groups";
import { sendToChats } from "@/lib/telegram-send";
import { MAX_LENGTH } from "./limits";

export type SendState = {
  done?: { test: boolean; delivered: number; failed: number };
  error?: "empty" | "long" | "noRecipients" | "noTelegram" | "notConfigured" | "failed";
  message?: string;
};

/**
 * Sends the message through the Telegram bot.
 * mode=test -> only to the sender (to check how it looks).
 * mode=send -> to every student in the chosen audience (all / a teacher's groups / one group).
 * The database decides who may send and who receives (admin_message_recipients).
 */
export async function sendMessage(_prev: SendState, formData: FormData): Promise<SendState> {
  const sender = await requireAdmin();
  const t = await getTranslations("admin.messages");
  if (!process.env.TELEGRAM_BOT_TOKEN) return { error: "notConfigured" };

  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  if (!body) return { error: "empty" };
  if (body.length > MAX_LENGTH) return { error: "long" };
  const test = formData.get("mode") === "test";

  // The sender's name at the end, so students know who wrote.
  const text = `${body}\n\n— ${sender.full_name ?? "Speaking Easy"}`;
  const supabase = await createClient();

  if (test) {
    const { data: myId, error } = await supabase.rpc("admin_my_telegram_id");
    if (error) return { error: "failed", message: error.message };
    if (!myId) return { error: "noTelegram" };
    const result = await sendToChats([Number(myId)], `🧪 ${t("testPrefix")}\n\n${text}`);
    return { done: { test: true, ...result } };
  }

  const groups = await loadGroups();
  const filter = readGroupFilter({
    group: String(formData.get("group") ?? "") || undefined,
    teacher: String(formData.get("teacher") ?? "") || undefined,
  });
  const ids = groupIdsFor(groups, filter);
  const teacher = selectedTeacher(groups, filter);
  const audience = filter.group
    ? (groups.find((g) => g.id === filter.group)?.name ?? t("allStudents"))
    : (teacher ?? t("allStudents"));

  const { data, error } = await supabase.rpc("admin_message_recipients", { p_group_ids: ids });
  if (error) return { error: "failed", message: error.message };
  const rows = (data ?? []) as { telegram_id: number | string }[];
  const chatIds = [...new Set(rows.map((r) => Number(r.telegram_id)))];
  if (chatIds.length === 0) return { error: "noRecipients" };

  const result = await sendToChats(chatIds, text);
  const logged = await supabase.rpc("admin_log_message", {
    p_audience: audience,
    p_body: body,
    p_recipients: chatIds.length,
    p_delivered: result.delivered,
    p_failed: result.failed,
  });
  if (logged.error) console.warn("admin_log_message failed:", logged.error.message);
  revalidatePath("/admin/messages");
  return { done: { test: false, ...result } };
}
