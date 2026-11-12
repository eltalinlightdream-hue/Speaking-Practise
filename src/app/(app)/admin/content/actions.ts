"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isExamCode, partConfig } from "@/config/exams";
import { findDuplicate, normalize, splitLines } from "@/lib/content/similarity";

export type ActionResult = { ok?: boolean; error?: string };

function revalidateContent(topicId?: string) {
  revalidatePath("/admin", "layout");
  if (topicId) revalidatePath(`/admin/content/${topicId}`);
}

function readTopicFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").replace(/\s+/g, " ").trim();
  const bullets = String(formData.get("cue_bullets") ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
  const explain = String(formData.get("cue_explain") ?? "").trim() || null;
  const related = String(formData.get("related_topic_id") ?? "") || null;
  return { title, bullets, explain, related };
}

export async function createTopic(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const exam = String(formData.get("exam"));
  const part = Number(formData.get("part"));
  if (!isExamCode(exam) || !partConfig(exam, part)) return { error: "invalid exam or part" };
  const { title, bullets, explain, related } = readTopicFields(formData);
  if (!title) return { error: "required" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .insert({ exam, part, title, cue_bullets: bullets, cue_explain: explain, related_topic_id: related })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "duplicateTitle" : error.message };

  revalidateContent();
  redirect(`/admin/content/${data.id}`);
}

export async function updateTopic(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id"));
  const { title, bullets, explain, related } = readTopicFields(formData);
  if (!title) return { error: "required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("topics")
    .update({
      title,
      is_core: formData.get("is_core") === "on",
      active: formData.get("active") === "on",
      cue_bullets: bullets,
      cue_explain: explain,
      related_topic_id: related,
    })
    .eq("id", id);
  if (error) return { error: error.code === "23505" ? "duplicateTitle" : error.message };

  revalidateContent(id);
  return { ok: true };
}

export async function setTopicActive(id: string, active: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("topics").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateContent(id);
}

export async function updateQuestionText(id: string, text: string): Promise<ActionResult> {
  await requireAdmin();
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 2) return { error: "required" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("questions").update({ text: clean }).eq("id", id).select("topic_id").single();
  if (error) return { error: error.code === "23505" ? "duplicate" : error.message };
  revalidateContent(data.topic_id);
  return { ok: true };
}

export async function setQuestionActive(id: string, active: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("questions").update({ active }).eq("id", id).select("topic_id").single();
  if (error) throw new Error(error.message);
  revalidateContent(data.topic_id);
}

export async function setQuestionAudio(id: string, audioUrl: string | null): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: before } = await supabase.from("questions").select("audio_url, topic_id").eq("id", id).single();
  const { error } = await supabase.from("questions").update({ audio_url: audioUrl }).eq("id", id);
  if (error) return { error: error.message };

  // Remove the old file from storage when it is replaced or removed.
  const marker = "/storage/v1/object/public/question-audio/";
  if (before?.audio_url && before.audio_url !== audioUrl && before.audio_url.includes(marker)) {
    const path = decodeURIComponent(before.audio_url.split(marker)[1] ?? "");
    if (path) await supabase.storage.from("question-audio").remove([path]);
  }
  revalidateContent(before?.topic_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Adding questions with duplicate checks
// ---------------------------------------------------------------------------

export type LineCheck = {
  text: string;
  status: "new" | "inTopic" | "repeated";
  similar?: { text: string; where: string } | null;
};

export async function checkQuestions(topicId: string, pasted: string): Promise<LineCheck[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: topic } = await supabase.from("topics").select("id, exam, part, title").eq("id", topicId).single();
  if (!topic) return [];

  // Compare with every question of the same exam and part.
  const { data: existing } = await supabase
    .from("questions")
    .select("text, topic_id, topics!inner(title, exam, part)")
    .eq("topics.exam", topic.exam)
    .eq("topics.part", topic.part);

  const rows = (existing ?? []) as unknown as { text: string; topic_id: string; topics: { title: string } }[];
  const inTopic = new Set(rows.filter((r) => r.topic_id === topicId).map((r) => normalize(r.text)));
  const pool = rows.map((r) => ({ text: r.text, where: r.topics.title }));

  const seen = new Set<string>();
  return splitLines(pasted).map((text) => {
    const key = normalize(text);
    if (inTopic.has(key)) return { text, status: "inTopic" as const };
    if (seen.has(key)) return { text, status: "repeated" as const };
    seen.add(key);
    const dup = findDuplicate(text, pool);
    return { text, status: "new" as const, similar: dup ? { text: dup.text, where: dup.where ?? "" } : null };
  });
}

export async function addQuestions(topicId: string, pasted: string): Promise<{ added: number; error?: string }> {
  await requireAdmin();
  const checks = await checkQuestions(topicId, pasted);
  const toAdd = checks.filter((c) => c.status === "new").map((c) => c.text);
  if (toAdd.length === 0) return { added: 0 };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("questions")
    .select("sort_order")
    .eq("topic_id", topicId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = (last?.sort_order ?? 0) + 1;

  const { error } = await supabase
    .from("questions")
    .insert(toAdd.map((text, i) => ({ topic_id: topicId, text, sort_order: start + i })));
  if (error) return { added: 0, error: error.message };

  revalidateContent(topicId);
  return { added: toAdd.length };
}
