// Builds the examiner's part of an IELTS mock test from src/config/examiner-script.json:
// the opening, the Part 1 frame, the Part 2 instructions, the Part 3 intro and the closing.
// Pure functions (no browser or database code), so they are easy to test.

import script from "@/config/examiner-script.json";
import { shuffle } from "./random";
import type { CueCardStep, ExaminerStep, QuestionStep, SpokenLine, Step } from "./types";

type ScriptLine = {
  id: string;
  kind: "say" | "ask" | "wait";
  text: string;
  answerSeconds?: number;
  waitSeconds?: number;
  hint?: string;
};

const LINES = new Map((script.lines as ScriptLine[]).map((l) => [l.id, l]));

function get(id: string): ScriptLine {
  const l = LINES.get(id);
  if (!l) throw new Error(`examiner-script.json has no line "${id}"`);
  return l;
}

/** The recorded clip for a line: public/audio/examiner/<id>.mp3 */
export function clipUrl(id: string) {
  return `${script.audioBase}${id}.mp3`;
}

export function spoken(id: string): SpokenLine {
  return { text: get(id).text, clip: clipUrl(id) };
}

/** "morning" before 12:00, "afternoon" until 17:59, then "evening" (Tashkent time). */
export function timeOfDay(date: Date = new Date()): "morning" | "afternoon" | "evening" {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", hourCycle: "h23" }).format(date));
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

/**
 * Frame 1 (where you live) or Frame 2 (work/study). Avoid asking about the same
 * thing twice: a work/study Part 1 topic gets Frame 1, a home topic gets Frame 2.
 */
export function pickFrame(part1Title: string, rand: () => number = Math.random): 1 | 2 {
  const t = part1Title.toLowerCase();
  if (script.flow.useFrame1WhenPart1TopicHas.some((w) => t.includes(w))) return 1;
  if (script.flow.useFrame2WhenPart1TopicHas.some((w) => t.includes(w))) return 2;
  return rand() < 0.5 ? 1 : 2;
}

type Timers = { part1Seconds: number; part3Seconds: number; prepSeconds: number; speakSeconds: number };

type MockContent = {
  part1: { title: string; questions: { text: string; audioUrl: string | null }[] };
  cueCard: { title: string; bullets: string[]; explain: string | null };
  part3: { title: string; questions: { text: string; audioUrl: string | null }[] };
};

/** Turn a run of script ids into steps: "say" lines are grouped, "ask" lines become questions. */
function scriptSteps(ids: string[], part: number, defaultSeconds: number): Step[] {
  const steps: Step[] = [];
  let pending: SpokenLine[] = [];
  const flush = (extra?: Partial<ExaminerStep>) => {
    if (pending.length || extra) steps.push({ kind: "examiner", part, lines: pending, ...extra });
    pending = [];
  };
  for (const id of ids) {
    const l = get(id);
    if (l.kind === "say") {
      pending.push(spoken(id));
    } else if (l.kind === "wait") {
      pending.push(spoken(id));
      flush({ waitSeconds: l.waitSeconds ?? 2, hint: l.hint });
    } else {
      flush();
      steps.push({ kind: "question", part, topic: "", text: l.text, audioUrl: clipUrl(id), seconds: l.answerSeconds ?? defaultSeconds });
    }
  }
  flush();
  return steps;
}

/**
 * The whole mock test in order: opening → Part 1 frame → the set's Part 1 topic →
 * Part 2 (instructions, cue card) → Part 3 → closing.
 */
export function buildMockSteps(content: MockContent, timers: Timers, opts: { now?: Date; rand?: () => number } = {}): Step[] {
  const rand = opts.rand ?? Math.random;
  const f = script.flow;
  const steps: Step[] = [];

  // Opening (the greeting depends on the time of day).
  const opening = f.opening.map((id) => (id === "greeting" ? f.greeting[timeOfDay(opts.now)] : id));
  steps.push(...scriptSteps(opening, 1, timers.part1Seconds));

  // Part 1: one frame, then the set's own topic.
  const frameIds = pickFrame(content.part1.title, rand) === 1 ? f.frame1 : [...f.frame2.intro, ...shuffle(f.frame2.pool, rand).slice(0, f.frame2.pick)];
  steps.push(...scriptSteps(frameIds, 1, timers.part1Seconds));
  steps.push(...scriptSteps(f.part1Next, 1, timers.part1Seconds));
  for (const q of content.part1.questions) {
    steps.push({ kind: "question", part: 1, topic: content.part1.title, text: q.text, audioUrl: q.audioUrl, seconds: timers.part1Seconds });
  }

  // Part 2: instructions, then the cue card (not read aloud).
  steps.push(...scriptSteps(f.part2Intro, 2, timers.part1Seconds));
  const card: CueCardStep = {
    kind: "cue-card",
    part: 2,
    title: content.cueCard.title,
    bullets: content.cueCard.bullets,
    explain: content.cueCard.explain,
    prepSeconds: timers.prepSeconds,
    speakSeconds: timers.speakSeconds,
    startLines: f.part2Start.map(spoken),
    endLines: f.part2End.map(spoken),
  };
  steps.push(card);

  // Part 3: intro, then the discussion questions.
  steps.push(...scriptSteps(f.part3Intro, 3, timers.part3Seconds));
  for (const q of content.part3.questions) {
    const step: QuestionStep = { kind: "question", part: 3, topic: content.part3.title, text: q.text, audioUrl: q.audioUrl, seconds: timers.part3Seconds };
    steps.push(step);
  }

  steps.push(...scriptSteps(f.closing, 3, timers.part3Seconds));
  return steps;
}
