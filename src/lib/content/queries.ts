import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ExamCode } from "@/config/exams";

export type TopicRow = {
  id: string;
  exam: ExamCode;
  part: number;
  title: string;
  is_core: boolean;
  related_topic_id: string | null;
  cue_bullets: string[];
  cue_explain: string | null;
  is_placeholder: boolean;
  active: boolean;
};

export type QuestionRow = {
  id: string;
  topic_id: string;
  text: string;
  sort_order: number;
  audio_url: string | null;
  active: boolean;
};

export type MockSetRow = { id: string; exam: ExamCode; name: string; sort_order: number; active: boolean };

const TOPIC_COLUMNS = "id, exam, part, title, is_core, related_topic_id, cue_bullets, cue_explain, is_placeholder, active";

export async function listTopics(filter: { exam: ExamCode; part?: number; search?: string; includeDisabled?: boolean }) {
  const supabase = await createClient();
  let query = supabase
    .from("topics")
    .select(`${TOPIC_COLUMNS}, questions(count), related:related_topic_id(title)`)
    .eq("exam", filter.exam);
  if (filter.part) query = query.eq("part", filter.part);
  if (!filter.includeDisabled) query = query.eq("active", true);
  if (filter.search) query = query.ilike("title", `%${filter.search.replace(/[%_]/g, "")}%`);
  const { data, error } = await query.order("part").order("title");
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => {
    const { questions, related, ...rest } = t as unknown as TopicRow & {
      questions: { count: number }[];
      related: { title: string } | null;
    };
    return { ...rest, question_count: questions?.[0]?.count ?? 0, related_title: related?.title ?? null };
  });
}

export async function getTopic(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("topics").select(TOPIC_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as TopicRow | null;
}

export async function getTopicQuestions(topicId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id, topic_id, text, sort_order, audio_url, active")
    .eq("topic_id", topicId)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as QuestionRow[];
}

export async function listTopicTitles(exam: ExamCode, part: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, title, active")
    .eq("exam", exam)
    .eq("part", part)
    .order("title");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function contentStats() {
  const supabase = await createClient();
  const [topics, questions, mocks] = await Promise.all([
    supabase.from("topics").select("exam, part, active"),
    supabase.from("questions").select("active, topics!inner(exam, part)"),
    supabase.from("mock_sets").select("exam, active"),
  ]);
  for (const r of [topics, questions, mocks]) if (r.error) throw new Error(r.error.message);
  return {
    topics: (topics.data ?? []) as { exam: ExamCode; part: number; active: boolean }[],
    questions: (questions.data ?? []) as unknown as { active: boolean; topics: { exam: ExamCode; part: number } }[],
    mocks: (mocks.data ?? []) as { exam: ExamCode; active: boolean }[],
  };
}
