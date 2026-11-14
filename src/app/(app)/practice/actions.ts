"use server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isExamCode } from "@/config/exams";
import { buildGeneralSteps, readChoice, type PoolTopic } from "@/lib/practice/general-plan";
import { loadPool } from "@/lib/practice/pool";
import { allowedMock, buildMockSteps } from "@/lib/practice/mock";
import type { RecordingType, SessionPlan } from "@/lib/practice/types";

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
  await requireProfile();
  if (!isExamCode(input.exam)) return { error: "invalid exam" };
  const exam = input.exam;
  const recordingType: RecordingType = ["none", "audio", "video"].includes(input.recordingType) ? input.recordingType : "none";
  const choice = readChoice({ exam, optionId: input.optionId, count: input.count });
  if (!choice) return { error: "invalid option" };

  const pools = new Map<number, PoolTopic[]>();
  for (const p of choice.option.parts) pools.set(p, await loadPool(exam, p));
  const built = buildGeneralSteps({ exam, optionId: input.optionId, count: input.count }, (p) => pools.get(p) ?? []);
  if (!built) return { error: "invalid option" };
  const { option, unlimited, steps, label } = built;

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
