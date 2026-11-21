import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { addExaminer, pickFrame, timeOfDay } from "./examiner.ts";
import type { CueCardStep, ExaminerStep, QuestionStep, Step } from "./types";

const q = (part: number, topic: string, text: string, seconds = 45): QuestionStep => ({ kind: "question", part, topic, text, audioUrl: null, seconds });
const card: CueCardStep = { kind: "cue-card", part: 2, title: "Describe a useful object", bullets: ["What it is"], explain: null, prepSeconds: 60, speakSeconds: 120 };
const mock = (part1Topic: string): Step[] => [q(1, part1Topic, "Q1a"), q(1, part1Topic, "Q1b"), card, q(3, "Technology", "Q3a", 60), q(3, "Technology", "Q3b", 60)];
const morning = new Date("2026-11-21T04:00:00Z"); // 09:00 in Tashkent
const texts = (steps: Step[]) => steps.flatMap((s) => (s.kind === "examiner" ? s.lines.map((l) => l.text) : s.kind === "question" ? [s.text] : [`[card] ${s.title}`]));

test("greeting follows Tashkent time", () => {
  assert.equal(timeOfDay(new Date("2026-11-21T04:00:00Z")), "morning"); // 09:00
  assert.equal(timeOfDay(new Date("2026-11-21T08:00:00Z")), "afternoon"); // 13:00
  assert.equal(timeOfDay(new Date("2026-11-21T14:00:00Z")), "evening"); // 19:00
});

test("frame avoids repeating the set's own Part 1 topic", () => {
  assert.equal(pickFrame("Work and studies"), 1);
  assert.equal(pickFrame("Hometown"), 2);
  assert.equal(pickFrame("Home, decoration"), 2);
  assert.equal(pickFrame("Colours", () => 0.1), 1);
  assert.equal(pickFrame("Colours", () => 0.9), 2);
});

test("examiner lines wrap the set in exam order", () => {
  const out = texts(addExaminer(mock("Colours"), { now: morning, rand: () => 0.1 }));
  assert.equal(out[0], "This is the Speaking test for the International English Language Testing System.");
  assert.ok(out.includes("Good morning."));
  assert.ok(!out.includes("Good evening."));
  const order = ["My name is Augustus Flores.", "Let's talk about where you live now.", "Now, let's talk about a different topic.", "Q1a", "Q1b",
    "Now, I'm going to give you a topic, and I'd like you to talk about it for one to two minutes.", "[card] Describe a useful object",
    "Now, I'd like to discuss with you one or two more general questions related to this topic.", "Q3a", "Q3b", "Thank you. That is the end of the speaking test."];
  const idx = order.map((t) => out.indexOf(t));
  assert.ok(idx.every((i) => i >= 0), `missing: ${order.filter((_, k) => idx[k] < 0)}`);
  assert.deepEqual([...idx].sort((a, b) => a - b), idx);
});

test("Frame 2 asks the work/study question and 3 more", () => {
  const steps = addExaminer(mock("Hometown"), { now: morning });
  const out = texts(steps);
  const i = out.indexOf("Do you work or are you a student?");
  assert.ok(i > out.indexOf("Let's talk about what you do."));
  const frameQs = steps.filter((s): s is QuestionStep => s.kind === "question" && s.topic === "" && /work|stud/i.test(s.text) && s.text !== "Do you work or are you a student?");
  assert.equal(frameQs.length, 3);
});

test("cue card gets start/end lines; ID check pauses; question seconds kept", () => {
  const steps = addExaminer(mock("Colours"), { now: morning });
  const c = steps.find((s): s is CueCardStep => s.kind === "cue-card")!;
  assert.equal(c.startLines?.[0].text, "All right? Remember, you have one to two minutes for this, so don't worry if I stop you.");
  assert.equal(c.endLines?.at(-1)?.text, "Can I have the booklet and the paper and pencil back, please?");
  const id = steps.find((s): s is ExaminerStep => s.kind === "examiner" && s.lines.some((l) => l.text.startsWith("Can I see your identification")))!;
  assert.equal(id.waitSeconds, 3);
  assert.equal(id.hint, "idHint");
  assert.equal(steps.filter((s) => s.kind === "question" && s.part === 3).every((s) => (s as QuestionStep).seconds === 60), true);
});

test("every examiner clip exists in public/", () => {
  for (const s of addExaminer(mock("Hometown"), { now: morning })) {
    const clips = s.kind === "examiner" ? s.lines.map((l) => l.clip) : s.kind === "cue-card" ? [...(s.startLines ?? []), ...(s.endLines ?? [])].map((l) => l.clip) : s.audioUrl ? [s.audioUrl] : [];
    for (const c of clips) assert.ok(c && existsSync(new URL(`../../../public${c}`, import.meta.url)), `missing ${c}`);
  }
});
