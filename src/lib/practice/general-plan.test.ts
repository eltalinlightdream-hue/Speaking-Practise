import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGeneralSteps, topicSteps, type PoolTopic } from "./general-plan.ts";
import { partConfig, partLabel } from "../../config/exams.ts";
import type { CueCardStep, QuestionStep } from "./types";

let n = 0;
function topic(part: number, extra: Partial<PoolTopic> = {}): PoolTopic {
  n++;
  return { id: `t${n}`, title: `Topic ${n}`, related_topic_id: null, cue_bullets: [], cue_explain: null, questions: [], ...extra };
}
const qs = (...texts: string[]) => texts.map((text) => ({ text, audio_url: null }));
const pic = (url: string) => ({ url, alt: `alt ${url}` });

function pictureTopic(i: number) {
  return topic(2, {
    title: `Pictures ${i}`,
    images: [pic(`/p${i}a.webp`), pic(`/p${i}b.webp`)],
    questions: qs("What do you see in these pictures?", `Second ${i}?`, `Third ${i}?`),
  });
}

const cefrPools: Record<number, PoolTopic[]> = {
  1: [
    topic(1, { questions: qs("Do you like doing any sports?", "What is your favourite drink?", "Q1c?") }),
    topic(1, { questions: qs("Do you like doing any sports?", "Q2b?", "Q2c?") }),
    topic(1, { questions: qs("What is your favourite drink?", "Q3b?", "Q3c?") }),
    topic(1, { questions: qs("Q4a?", "Q4b?", "Q4c?") }),
    topic(1, { questions: qs("Q5a?", "Q5b?", "Q5c?") }),
  ],
  2: [pictureTopic(1), pictureTopic(2), pictureTopic(3)],
  3: [topic(3, { title: "A happy day", images: [pic("/card.webp")], cue_bullets: ["Describe a day.", "Who was there?", "Why?"] })],
  4: [
    topic(4, { title: "Everyone should learn music.", points_for: ["calm"], points_against: ["costly"] }),
    topic(4, { title: "No arguments here." }),
  ],
};
const cefr = (optionId: string, count: number) => buildGeneralSteps({ exam: "cefr", optionId, count }, (p) => cefrPools[p] ?? [])!;

test("CEFR part labels: 1.1, 1.2, 2, 3; IELTS keeps its numbers", () => {
  assert.deepEqual([1, 2, 3, 4].map((p) => partLabel("cefr", p)), ["1.1", "1.2", "2", "3"]);
  assert.equal(partLabel("ielts", 2), "2");
  assert.equal(partLabel("unknown", 7), "7");
  assert.equal(cefr("cefr1", 3).label, "Part 1.1 + Part 1.2");
});

test("Part 1.2 keeps a picture pair with its own questions, in order, 45 s then 30 s", () => {
  const { steps } = cefr("cefr12", 3);
  assert.equal(steps.length, 3);
  const q = steps as QuestionStep[];
  assert.equal(q[0].text, "What do you see in these pictures?");
  assert.deepEqual(q.map((s) => s.seconds), [45, 30, 30]);
  assert.ok(q.every((s) => s.part === 2 && s.images?.length === 2 && s.images[0].url === q[0].images![0].url));
  assert.equal(q[1].text.replace(/\D/g, ""), q[0].images![0].url.replace(/\D/g, ""));
});

test("Part 1.2 count is reached with whole picture groups", () => {
  const { steps } = cefr("cefr12", 5);
  assert.equal(steps.length, 6);
  assert.deepEqual((steps as QuestionStep[]).map((s) => s.seconds), [45, 30, 30, 45, 30, 30]);
  assert.equal(cefr("cefr12", 0).steps.length, 9, "unlimited: every group");
});

test("Part 1.1 never asks the same question twice and shows no pictures", () => {
  const { steps, unlimited } = cefr("cefr11", 0);
  assert.equal(unlimited, true);
  const texts = (steps as QuestionStep[]).map((s) => s.text);
  assert.equal(new Set(texts).size, texts.length);
  assert.equal(texts.length, 13, "15 questions minus 2 repeated ones");
  assert.ok((steps as QuestionStep[]).every((s) => s.seconds === 30 && !s.images));
});

test("Part 1.1 + Part 1.2: Part 1.1 first, then the picture questions", () => {
  const { steps } = cefr("cefr1", 3);
  assert.deepEqual(steps.map((s) => s.part), [1, 1, 1, 2, 2, 2]);
  const unlimited = cefr("cefr1", 0).steps;
  assert.equal(unlimited.filter((s) => s.part === 1).length, 12, "unlimited Part 1.1 stops so Part 1.2 is reached");
  assert.equal(unlimited.filter((s) => s.part === 2).length, 9);
});

test("Part 2 is a card with a picture and numbered questions", () => {
  const { steps } = cefr("cefr2", 3);
  assert.equal(steps.length, 1);
  const card = steps[0] as CueCardStep;
  assert.equal(card.kind, "cue-card");
  assert.equal(card.style, "questions");
  assert.equal(card.part, 3);
  assert.deepEqual(card.bullets, ["Describe a day.", "Who was there?", "Why?"]);
  assert.deepEqual(card.images, [pic("/card.webp")]);
  assert.equal(card.prepSeconds, 60);
  assert.equal(card.speakSeconds, 120);
});

test("Part 3 is a debate card; a topic without arguments is never picked", () => {
  for (let i = 0; i < 10; i++) {
    const card = cefr("cefr3", 3).steps[0] as CueCardStep;
    assert.equal(card.style, "debate");
    assert.equal(card.title, "Everyone should learn music.");
    assert.deepEqual(card.pointsFor, ["calm"]);
    assert.deepEqual(card.pointsAgainst, ["costly"]);
  }
});

test("IELTS cards keep the IELTS style and no CEFR fields", () => {
  const card = topicSteps(partConfig("ielts", 2)!, topic(2, { cue_bullets: ["what", "when"], cue_explain: "and explain why" }))[0] as CueCardStep;
  assert.equal(card.style, "ielts");
  assert.equal(card.images, undefined);
  assert.equal(card.pointsFor, undefined);
});

test("topics saved on the phone before pictures existed still work", () => {
  const old = { id: "x", title: "Old", related_topic_id: null, cue_bullets: [], cue_explain: null, questions: qs("A?", "B?") };
  const steps = topicSteps(partConfig("cefr", 2)!, old) as QuestionStep[];
  assert.deepEqual(steps.map((s) => [s.text, s.seconds, s.images]), [["A?", 45, undefined], ["B?", 30, undefined]]);
});
