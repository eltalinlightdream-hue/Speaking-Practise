import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ExamCode } from "@/config/exams";
import type { PoolTopic } from "./general-plan";
import { readPictures } from "./pictures";

type TopicRow = {
  id: string;
  title: string;
  related_topic_id: string | null;
  cue_bullets: string[];
  cue_explain: string | null;
  images: unknown;
  points_for: string[];
  points_against: string[];
  questions: { text: string; audio_url: string | null; active: boolean; sort_order: number }[];
};

/** Active topics of one part with their active questions in order (General Training and the offline question pack). */
export async function loadPool(exam: ExamCode, part: number): Promise<PoolTopic[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select(
      "id, title, related_topic_id, cue_bullets, cue_explain, images, points_for, points_against, questions(text, audio_url, active, sort_order)",
    )
    .eq("exam", exam)
    .eq("part", part)
    .eq("active", true);
  if (error) throw new Error(error.message);
  return ((data ?? []) as TopicRow[]).map((t) => ({
    ...t,
    images: readPictures(t.images),
    questions: t.questions
      .filter((q) => q.active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((q) => ({ text: q.text, audio_url: q.audio_url })),
  }));
}
