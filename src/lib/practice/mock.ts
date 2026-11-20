import "server-only";
import { createClient } from "@/lib/supabase/server";
import { EXAMS, type ExamCode } from "@/config/exams";
import { chooseNextMock, remainingInCycle, type NextMock } from "./mock-rotation";
import { topicSteps } from "./general-plan";
import { readPictures } from "./pictures";
import type { Step } from "./types";

// Server helpers for Mock Tests: find the student's next mock set and turn
// it into the steps the SessionRunner plays.

async function loadRotation(userId: string, exam: ExamCode) {
  const supabase = await createClient();
  const [sets, history] = await Promise.all([
    supabase.from("mock_sets").select("id, name").eq("exam", exam).eq("active", true).order("sort_order"),
    supabase.from("mock_history").select("mock_set_id, cycle").eq("user_id", userId).eq("exam", exam),
  ]);
  if (sets.error) throw new Error(sets.error.message);
  if (history.error) throw new Error(history.error.message);
  return { sets: sets.data ?? [], history: history.data ?? [] };
}

/** The next mock set for this student (null when the exam has no active sets). */
export async function findNextMock(userId: string, exam: ExamCode): Promise<NextMock | null> {
  const { sets, history } = await loadRotation(userId, exam);
  return chooseNextMock(sets, history);
}

/**
 * The set the start button asked for, if the rotation allows it right now
 * (not finished yet in this cycle). The page shows the student one set and
 * this makes sure exactly that set starts.
 */
export async function allowedMock(userId: string, exam: ExamCode, mockSetId: string): Promise<NextMock | null> {
  const { sets, history } = await loadRotation(userId, exam);
  const { cycle, doneCount, remaining } = remainingInCycle(sets, history);
  const set = remaining.find((s) => s.id === mockSetId);
  return set ? { set, cycle, number: doneCount + 1, total: sets.length } : null;
}

type SetTopic = {
  part: number;
  sort_order: number;
  topics: {
    title: string;
    cue_bullets: string[];
    cue_explain: string | null;
    images: unknown;
    points_for: string[];
    points_against: string[];
    questions: { text: string; audio_url: string | null; active: boolean; sort_order: number }[];
  } | null;
};

/**
 * The steps of one mock set, exactly as the set is: every part in exam
 * order, the set's own topic for that part, its questions in their order
 * (pictures, card style and timers come from topicSteps and the exam config).
 * Returns the parts that are missing so the caller can refuse a broken set.
 */
export async function buildMockSteps(exam: ExamCode, mockSetId: string): Promise<{ steps: Step[]; missingParts: number[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mock_set_topics")
    .select(
      "part, sort_order, topics(title, cue_bullets, cue_explain, images, points_for, points_against, questions(text, audio_url, active, sort_order))",
    )
    .eq("mock_set_id", mockSetId);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown as SetTopic[]).sort((a, b) => a.sort_order - b.sort_order);

  const steps: Step[] = [];
  const missingParts: number[] = [];

  for (const cfg of EXAMS[exam].parts) {
    // A topic the student cannot see (disabled) comes back as null.
    const topics = rows.filter((r) => r.part === cfg.part && r.topics).map((r) => r.topics!);
    const before = steps.length;

    for (const topic of topics) {
      steps.push(
        ...topicSteps(cfg, {
          ...topic,
          images: readPictures(topic.images),
          questions: topic.questions
            .filter((x) => x.active)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((q) => ({ text: q.text, audio_url: q.audio_url })),
        }),
      );
    }
    if (steps.length === before) missingParts.push(cfg.part);
  }

  return { steps, missingParts };
}
