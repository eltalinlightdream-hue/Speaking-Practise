"use server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EXAMS, isExamCode, partConfig, type ExamCode } from "@/config/exams";
import { pickAcrossTopics, shuffle } from "@/lib/practice/random";
import type { RecordingType, SessionPlan, Step } from "@/lib/practice/types";

type TopicWithQuestions = {
  id: string;
  title: string;
  part: number;
  related_topic_id: string | null;
  cue_bullets: string[];
  cue_explain: string | null;
  questions: { text: string; audio_url: string | null; active: boolean; sort_order: number }[];
};

const COUNTS = [3, 5, 8, 10];

async function loadTopics(exam: ExamCode, part: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, title, part, related_topic_id, cue_bullets, cue_explain, questions(text, audio_url, active, sort_order)")
    .eq("exam", exam)
    .eq("part", part)
    .eq("active", true);
  if (error) throw new Error(error.message);
  return ((data ?? []) as TopicWithQuestions[]).map((t) => ({
    ...t,
    questions: t.questions.filter((q) => q.active).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

function questionSteps(exam: ExamCode, part: number, topics: TopicWithQuestions[], count: number, perTopic: number): Step[] {
  const seconds = partConfig(exam, part)?.secondsPerQuestion ?? 45;
  return pickAcrossTopics(
    topics.map((t) => ({ topic: t.title, items: t.questions })),
    count,
    perTopic,
  ).map(({ topic, item }) => ({ kind: "question", part, topic, text: item.text, audioUrl: item.audio_url, seconds }));
}

export type StartResult = { plan?: SessionPlan; error?: "empty" | string };

/**
 * Build a General Training session and start the timer in the database.
 * optionId comes from EXAMS[exam].generalTraining (p1, p2, p3, p1p3).
 */
export async function startGeneralTraining(input: {
  exam: string;
  optionId: string;
  count: number;
  recordingType: RecordingType;
}): Promise<StartResult> {
  await requireProfile();
  if (!isExamCode(input.exam)) return { error: "invalid exam" };
  const exam = input.exam;
  const option = EXAMS[exam].generalTraining.find((o) => o.id === input.optionId);
  if (!option) return { error: "invalid option" };
  const count = COUNTS.includes(input.count) ? input.count : EXAMS[exam].defaultQuestionCount;
  const recordingType: RecordingType = ["none", "audio", "video"].includes(input.recordingType) ? input.recordingType : "none";

  const steps: Step[] = [];
  let linkedCueId: string | null = null;

  for (const part of option.parts) {
    const cfg = partConfig(exam, part);
    if (!cfg) continue;
    const topics = await loadTopics(exam, part);

    if (cfg.kind === "cue-card") {
      const cards = topics.filter((t) => t.cue_bullets.length > 0 || t.cue_explain);
      const card = shuffle(cards)[0];
      if (!card) continue;
      linkedCueId = card.id;
      steps.push({
        kind: "cue-card",
        part,
        title: card.title,
        bullets: card.cue_bullets,
        explain: card.cue_explain,
        prepSeconds: cfg.prepSeconds ?? 60,
        speakSeconds: cfg.speakSeconds ?? 120,
      });
    } else if (cfg.linkedToPart) {
      // Part 3: questions from ONE discussion topic (linked to the cue card when
      // there is one), topped up from other topics if that topic is short.
      const linked = linkedCueId ? topics.filter((t) => t.related_topic_id === linkedCueId) : [];
      const main = shuffle(linked.length ? linked : topics)[0];
      const ordered = main ? [main, ...shuffle(topics.filter((t) => t.id !== main.id))] : [];
      const picked: Step[] = [];
      for (const t of ordered) {
        for (const s of questionSteps(exam, part, [t], count - picked.length, count)) picked.push(s);
        if (picked.length >= count) break;
      }
      steps.push(...picked);
    } else {
      // Part 1: a few questions from each of several random topics.
      steps.push(...questionSteps(exam, part, topics, count, 4));
    }
  }

  if (steps.length === 0) return { error: "empty" };

  const supabase = await createClient();
  const { data: sessionId, error } = await supabase.rpc("start_practice_session", {
    p_mode: "general",
    p_exam: exam,
    p_parts: option.parts,
    p_recording_type: recordingType,
  });
  if (error || !sessionId) return { error: error?.message ?? "could not start" };

  return {
    plan: {
      sessionId: sessionId as string,
      exam,
      mode: "general",
      label: option.parts.map((p) => `Part ${p}`).join(" + "),
      steps,
      allowReplay: true,
      autoAdvance: false,
      recordingType,
    },
  };
}
