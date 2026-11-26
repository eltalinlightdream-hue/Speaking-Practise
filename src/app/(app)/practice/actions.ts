"use server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isExamCode, type ExamCode } from "@/config/exams";
import { buildGeneralSteps, readChoice, type PoolTopic, type SeenMap } from "@/lib/practice/general-plan";
import { loadPool } from "@/lib/practice/pool";
import { allowedMock, buildMockSteps } from "@/lib/practice/mock";
import type { RecordingType, SessionPlan } from "@/lib/practice/types";

/** With "unlimited" we cannot know how far the student gets; count this many steps as seen. */
const UNLIMITED_SEEN_STEPS = 10;

/** What this student was shown before in General Training (key -> last time, ms). */
async function loadSeen(userId: string, exam: ExamCode): Promise<SeenMap> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("practice_seen").select("item_key, seen_at").eq("user_id", userId).eq("exam", exam);
  if (error) {
    console.error("practice_seen read failed", error.message);
    return new Map(); // still works, just plain random
  }
  return new Map((data ?? []).map((r) => [r.item_key as string, Date.parse(r.seen_at as string)]));
}

async function saveSeen(userId: string, exam: ExamCode, keys: string[]) {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return;
  const supabase = await createClient();
  const seenAt = new Date().toISOString();
  const { error } = await supabase
    .from("practice_seen")
    .upsert(unique.map((item_key) => ({ user_id: userId, exam, item_key, seen_at: seenAt })), { onConflict: "user_id,exam,item_key" });
  if (error) console.error("practice_seen save failed", error.message);
}

export type StartResult = { plan?: SessionPlan; error?: "empty" | "taken" | string };

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
  const profile = await requireProfile();
  if (!isExamCode(input.exam)) return { error: "invalid exam" };
  const exam = input.exam;
  const recordingType: RecordingType = ["none", "audio", "video"].includes(input.recordingType) ? input.recordingType : "none";
  const choice = readChoice({ exam, optionId: input.optionId, count: input.count });
  if (!choice) return { error: "invalid option" };

  const pools = new Map<number, PoolTopic[]>();
  const [seen] = await Promise.all([
    loadSeen(profile.id, exam),
    ...choice.option.parts.map(async (p) => pools.set(p, await loadPool(exam, p))),
  ]);
  const built = buildGeneralSteps({ exam, optionId: input.optionId, count: input.count }, (p) => pools.get(p) ?? [], seen);
  if (!built) return { error: "invalid option" };
  const { option, unlimited, steps, keysByStep, label } = built;

  if (steps.length === 0) return { error: "empty" };

  const supabase = await createClient();
  const { data: sessionId, error } = await supabase.rpc("start_practice_session", {
    p_mode: "general",
    p_exam: exam,
    p_parts: option.parts,
    p_recording_type: recordingType,
  });
  if (error || !sessionId) return { error: error?.message ?? "could not start" };

  await saveSeen(profile.id, exam, keysByStep.slice(0, unlimited ? UNLIMITED_SEEN_STEPS : undefined).flat());

  return {
    plan: {
      sessionId: sessionId as string,
      exam,
      mode: "general",
      label,
      steps,
      allowReplay: true,
      autoAdvance: false,
      unlimited,
      recordingType,
    },
  };
}

/**
 * Start the mock test the page showed. The set runs exactly as it is:
 * Part 1 topic, Part 2 cue card, Part 3 topic. No replay; questions move on
 * by themselves when the time is up.
 */
export async function startMockTest(input: { exam: string; mockSetId: string; recordingType: RecordingType }): Promise<StartResult> {
  const profile = await requireProfile();
  if (!isExamCode(input.exam)) return { error: "invalid exam" };
  const exam = input.exam;
  const recordingType: RecordingType = ["none", "audio", "video"].includes(input.recordingType) ? input.recordingType : "none";

  // Finished on another device meanwhile, or not allowed yet: ask for a reload.
  const next = await allowedMock(profile.id, exam, input.mockSetId);
  if (!next) return { error: "taken" };

  const { steps, missingParts } = await buildMockSteps(exam, next.set.id);
  if (steps.length === 0 || missingParts.length > 0) return { error: "empty" };

  const supabase = await createClient();
  const parts = [...new Set(steps.map((s) => s.part))];
  const { data: sessionId, error } = await supabase.rpc("start_practice_session", {
    p_mode: "mock",
    p_exam: exam,
    p_parts: parts,
    p_recording_type: recordingType,
    p_mock_set_id: next.set.id,
  });
  if (error || !sessionId) return { error: error?.message ?? "could not start" };

  return {
    plan: {
      sessionId: sessionId as string,
      exam,
      mode: "mock",
      label: next.set.name,
      steps,
      allowReplay: false,
      autoAdvance: true,
      recordingType,
    },
  };
}
