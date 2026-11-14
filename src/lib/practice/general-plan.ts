// Builds the steps of a General Training session from the question pools.
// Pure (no database): the server uses it when online, and the phone uses it
// with the questions it saved earlier when there is no internet.

import { EXAMS, partConfig, type ExamCode } from "@/config/exams";
import { pickAcrossTopics, shuffle } from "./random";
import type { Step } from "./types";

export type PoolTopic = {
  id: string;
  title: string;
  related_topic_id: string | null;
  cue_bullets: string[];
  cue_explain: string | null;
  /** Active questions only, in their order. */
  questions: { text: string; audio_url: string | null }[];
};

/** Question counts the student can pick. 0 means "unlimited". */
export const GENERAL_COUNTS = [3, 5, 8, 10, 0];
/** With "unlimited" in Part 1 + Part 3, Part 1 stops here so Part 3 is reached. */
const UNLIMITED_PART1_WITH_PART3 = 12;

export type GeneralChoice = { exam: ExamCode; optionId: string; count: number };

/** The option and the cleaned-up count, or null for an unknown option. */
export function readChoice({ exam, optionId, count }: GeneralChoice) {
  const option = EXAMS[exam].generalTraining.find((o) => o.id === optionId);
  if (!option) return null;
  const unlimited = count === 0 && option.parts.some((p) => partConfig(exam, p)?.kind === "questions");
  const n = unlimited ? Infinity : GENERAL_COUNTS.includes(count) && count > 0 ? count : EXAMS[exam].defaultQuestionCount;
  return { option, unlimited, count: n };
}

function questionSteps(exam: ExamCode, part: number, topics: PoolTopic[], count: number, perTopic: number): Step[] {
  const seconds = partConfig(exam, part)?.secondsPerQuestion ?? 45;
  return pickAcrossTopics(
    topics.map((t) => ({ topic: t.title, items: t.questions })),
    count,
    perTopic,
  ).map(({ topic, item }) => ({ kind: "question", part, topic, text: item.text, audioUrl: item.audio_url, seconds }));
}

/**
 * Part 1: a few questions from several random topics. Part 2: one random cue
 * card. Part 3: one discussion topic (linked to the cue card when there is
 * one), topped up from other topics if it is short.
 */
export function buildGeneralSteps(choice: GeneralChoice, poolFor: (part: number) => PoolTopic[]) {
  const read = readChoice(choice);
  if (!read) return null;
  const { option, unlimited, count } = read;
  const exam = choice.exam;
  const steps: Step[] = [];
  let linkedCueId: string | null = null;

  for (const part of option.parts) {
    const cfg = partConfig(exam, part);
    if (!cfg) continue;
    const topics = poolFor(part);

    if (cfg.kind === "cue-card") {
      const card = shuffle(topics.filter((t) => t.cue_bullets.length > 0 || t.cue_explain))[0];
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
      const p1Count = unlimited && option.parts.length > 1 ? UNLIMITED_PART1_WITH_PART3 : count;
      steps.push(...questionSteps(exam, part, topics, p1Count, 4));
    }
  }

  return { option, unlimited, steps, label: option.parts.map((p) => `Part ${p}`).join(" + ") };
}
