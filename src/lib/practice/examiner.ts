// Builds the examiner's part of an IELTS mock test from src/config/examiner-script.json:
// the opening, the Part 1 frame, the Part 2 instructions, the Part 3 intro and the closing.
// Pure functions (no browser or database code), so they are easy to test.

import script from "../../config/examiner-script.json" with { type: "json" };
import { shuffle } from "./random.ts";
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
 * Add the examiner to an IELTS mock test built from a mock set (Part 1 questions,
 * the Part 2 cue card, Part 3 questions, in that order):
 * opening → Part 1 frame → "a different topic" + the set's Part 1 →
 * Part 2 instructions + cue card (start/end lines) → Part 3 intro + questions → closing.
 */
export function addExaminer(steps: Step[], opts: { now?: Date; rand?: () => number } = {}): Step[] {
  const rand = opts.rand ?? Math.random;
  const f = script.flow;
  const part = (n: number) => steps.filter((s) => s.part === n);
  const part1 = part(1);
  const part2 = part(2);
  const part3 = part(3);
  const firstQ = part1.find((s): s is QuestionStep => s.kind === "question");
  const part1Seconds = firstQ?.seconds ?? 45;
  const part3Seconds = part3.find((s): s is QuestionStep => s.kind === "question")?.seconds ?? 60;
  const out: Step[] = [];

  // Opening (the greeting depends on the time of day).
  const opening = f.opening.map((id) => (id === "greeting" ? f.greeting[timeOfDay(opts.now)] : id));
  out.push(...scriptSteps(opening, 1, part1Seconds));

  // Part 1: one frame, then the set's own topic.
  const frameIds = pickFrame(firstQ?.topic ?? "", rand) === 1 ? f.frame1 : [...f.frame2.intro, ...shuffle(f.frame2.pool, rand).slice(0, f.frame2.pick)];
  out.push(...scriptSteps(frameIds, 1, part1Seconds));
  if (part1.length) out.push(...scriptSteps(f.part1Next, 1, part1Seconds), ...part1);

  // Part 2: instructions, then the cue card (handed over silently, not read aloud).
  if (part2.length) {
    out.push(...scriptSteps(f.part2Intro, 2, part1Seconds));
    for (const s of part2) {
      out.push(s.kind === "cue-card" ? ({ ...s, startLines: f.part2Start.map(spoken), endLines: f.part2End.map(spoken) } satisfies CueCardStep) : s);
    }
  }

  // Part 3: intro, then the discussion questions.
  if (part3.length) out.push(...scriptSteps(f.part3Intro, 3, part3Seconds), ...part3);

  out.push(...scriptSteps(f.closing, part3.length ? 3 : 2, part3Seconds));
  return out;
}
