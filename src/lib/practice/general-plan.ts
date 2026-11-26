// Builds the steps of a General Training session from the question pools.
// Pure (no database): the server uses it when online, and the phone uses it
// with the questions it saved earlier when there is no internet.
// topicSteps() is shared with Mock Tests (src/lib/practice/mock.ts).

// Relative imports with ".ts" so the unit tests (node --test) can load this file.
import { EXAMS, partConfig, partLabel, type ExamCode, type PartConfig } from "../../config/exams.ts";
import { freshFirst, pickAcrossTopics, seenLevel } from "./random.ts";
import type { Picture, QuestionStep, Step } from "./types";

export type PoolTopic = {
  id: string;
  title: string;
  related_topic_id: string | null;
  cue_bullets: string[];
  cue_explain: string | null;
  /** Pictures (CEFR). Missing in question packs saved before 2026-11-20. */
  images?: Picture[];
  /** CEFR Part 3: arguments for and against the statement in the title. */
  points_for?: string[];
  points_against?: string[];
  /** Active questions only, in their order. */
  questions: { text: string; audio_url: string | null }[];
};

/** What topicSteps() needs from a topic (a PoolTopic or a mock set's topic). */
export type StepTopic = Pick<PoolTopic, "title" | "cue_bullets" | "cue_explain" | "images" | "points_for" | "points_against" | "questions">;

/** Question counts the student can pick. 0 means "unlimited". */
export const GENERAL_COUNTS = [3, 5, 8, 10, 0];
/** With "unlimited" and two question parts, the first part stops here so the next part is reached. */
const UNLIMITED_FIRST_PART = 12;

export type GeneralChoice = { exam: ExamCode; optionId: string; count: number };

/**
 * What the student has seen before: key -> time (ms) it was last shown.
 * Keys come from topicSeenKey / questionSeenKey. Saved in public.practice_seen.
 */
export type SeenMap = ReadonlyMap<string, number>;
export const topicSeenKey = (topicId: string) => `t:${topicId}`;
/** By text, so the same question in two topics counts as one. */
export const questionSeenKey = (part: number, text: string) => `q${part}:${text.trim().toLowerCase()}`;

/** The option and the cleaned-up count, or null for an unknown option. */
export function readChoice({ exam, optionId, count }: GeneralChoice) {
  const option = EXAMS[exam].generalTraining.find((o) => o.id === optionId);
  if (!option) return null;
  const unlimited = count === 0 && option.parts.some((p) => partConfig(exam, p)?.kind === "questions");
  const n = unlimited ? Infinity : GENERAL_COUNTS.includes(count) && count > 0 ? count : EXAMS[exam].defaultQuestionCount;
  return { option, unlimited, count: n };
}

/** A card has something to show: bullets, an "explain" line or arguments. */
function hasCard(t: StepTopic) {
  return t.cue_bullets.length > 0 || !!t.cue_explain || (t.points_for?.length ?? 0) > 0 || (t.points_against?.length ?? 0) > 0;
}

function questionStep(cfg: PartConfig, topic: StepTopic, q: StepTopic["questions"][number], first: boolean): QuestionStep {
  const step: QuestionStep = {
    kind: "question",
    part: cfg.part,
    topic: topic.title,
    text: q.text,
    audioUrl: q.audio_url,
    seconds: (first && cfg.firstQuestionSeconds) || cfg.secondsPerQuestion || 45,
  };
  if (topic.images?.length) step.images = topic.images;
  return step;
}

/**
 * The steps of one whole topic, exactly as stored: one card for a cue-card
 * part, otherwise all its questions in order (the first may get more time).
 */
export function topicSteps(cfg: PartConfig, topic: StepTopic): Step[] {
  if (cfg.kind === "cue-card") {
    return [
      {
        kind: "cue-card",
        part: cfg.part,
        title: topic.title,
        bullets: topic.cue_bullets,
        explain: topic.cue_explain,
        prepSeconds: cfg.prepSeconds ?? 60,
        speakSeconds: cfg.speakSeconds ?? 120,
        style: cfg.cardStyle ?? "ielts",
        ...(topic.images?.length ? { images: topic.images } : {}),
        ...(cfg.cardStyle === "debate" ? { pointsFor: topic.points_for ?? [], pointsAgainst: topic.points_against ?? [] } : {}),
      },
    ];
  }
  return topic.questions.map((q, i) => questionStep(cfg, topic, q, i === 0));
}

/**
 * Questions from several topics (in the order given), a few per topic, unseen
 * questions first. A question text already in `used` is never asked again.
 * Returns the steps and, for each step, the keys to mark as seen.
 */
function mixedQuestionSteps(
  cfg: PartConfig,
  topics: PoolTopic[],
  count: number,
  perTopic: number,
  seen: SeenMap,
  used: Set<string>,
): { steps: Step[]; keys: string[][] } {
  const groups = topics.map((t) => {
    const fresh = t.questions.filter((q) => {
      const key = questionSeenKey(cfg.part, q.text);
      if (used.has(key)) return false;
      used.add(key);
      return true;
    });
    return {
      topic: t.title,
      items: freshFirst(fresh, (q) => seen.get(questionSeenKey(cfg.part, q.text))).map((item) => ({ item, t })),
    };
  });
  const picked = pickAcrossTopics(groups, count, perTopic, ({ item }) => seenLevel(seen.get(questionSeenKey(cfg.part, item.text))));
  return {
    steps: picked.map(({ item }) => questionStep(cfg, item.t, item.item, false)),
    keys: picked.map(({ item }) => [topicSeenKey(item.t.id), questionSeenKey(cfg.part, item.item.text)]),
  };
}

/**
 * Part 1: a few questions from several random topics. Cue card: one random
 * card. Part 3 (IELTS): one discussion topic (linked to the cue card when
 * there is one), topped up from other topics if it is short. Whole-topic
 * parts (CEFR Part 1.2): random topics, each with all its questions, until
 * the count is reached.
 *
 * "Random" prefers what the student has not seen yet (`seen`), then what they
 * saw longest ago, so questions do not repeat until the pool runs out.
 * `keysByStep[i]` lists what step i shows, for saving as seen.
 * Without `seen` (offline) it is plain random.
 */
export function buildGeneralSteps(choice: GeneralChoice, poolFor: (part: number) => PoolTopic[], seen: SeenMap = new Map()) {
  const read = readChoice(choice);
  if (!read) return null;
  const { option, unlimited, count } = read;
  const exam = choice.exam;
  const steps: Step[] = [];
  const keysByStep: string[][] = [];
  const add = (more: { steps: Step[]; keys: string[][] }) => {
    steps.push(...more.steps);
    keysByStep.push(...more.keys);
  };
  const freshTopics = (list: PoolTopic[]) => freshFirst(list, (t) => seen.get(topicSeenKey(t.id)));
  let linkedCueId: string | null = null;
  const questionParts = option.parts.filter((p) => partConfig(exam, p)?.kind === "questions");

  for (const part of option.parts) {
    const cfg = partConfig(exam, part);
    if (!cfg) continue;
    const topics = poolFor(part);
    // "Unlimited" with two question parts: the first one stops so the next is reached.
    const partCount = unlimited && questionParts.length > 1 && part !== questionParts.at(-1) ? UNLIMITED_FIRST_PART : count;

    if (cfg.kind === "cue-card") {
      const card = freshTopics(topics.filter(hasCard))[0];
      if (!card) continue;
      linkedCueId = card.id;
      add({ steps: topicSteps(cfg, card), keys: [[topicSeenKey(card.id)]] });
    } else if (cfg.wholeTopics) {
      let picked = 0;
      for (const t of freshTopics(topics.filter((x) => x.questions.length > 0))) {
        if (picked >= partCount) break;
        const more = topicSteps(cfg, t);
        add({ steps: more, keys: t.questions.map((q) => [topicSeenKey(t.id), questionSeenKey(cfg.part, q.text)]) });
        picked += more.length;
      }
    } else if (cfg.linkedToPart) {
      const linked = linkedCueId ? topics.filter((t) => t.related_topic_id === linkedCueId) : [];
      const main = freshTopics(linked.length ? linked : topics)[0];
      const ordered = main ? [main, ...freshTopics(topics.filter((t) => t.id !== main.id))] : [];
      const used = new Set<string>();
      let picked = 0;
      for (const t of ordered) {
        const more = mixedQuestionSteps(cfg, [t], partCount - picked, partCount, seen, used);
        add(more);
        picked += more.steps.length;
        if (picked >= partCount) break;
      }
    } else {
      add(mixedQuestionSteps(cfg, freshTopics(topics), partCount, 4, seen, new Set()));
    }
  }

  return { option, unlimited, steps, keysByStep, label: option.parts.map((p) => `Part ${partLabel(exam, p)}`).join(" + ") };
}
