"use client";

import type { SessionOutcome } from "@/components/practice/session-runner";
import { saveRecording, type StoredRecording } from "./recordings-db";
import type { SessionPlan } from "./types";

export type FinishedSession = { outcome: SessionOutcome; saved: StoredRecording | null; recordingError: boolean };

/** After a session: keep the recording on this device (IndexedDB) if there is one. */
export async function saveSessionOutcome(plan: SessionPlan, outcome: SessionOutcome): Promise<FinishedSession> {
  if (plan.recordingType === "none") return { outcome, saved: null, recordingError: false };
  if (!outcome.recording) return { outcome, saved: null, recordingError: true };
  try {
    const saved = await saveRecording({
      exam: plan.exam,
      mode: plan.mode,
      label: plan.label,
      type: plan.recordingType,
      mimeType: outcome.mimeType || outcome.recording.type,
      durationSeconds: outcome.activeSeconds,
      blob: outcome.recording,
    });
    return { outcome, saved, recordingError: false };
  } catch {
    return { outcome, saved: null, recordingError: true };
  }
}
