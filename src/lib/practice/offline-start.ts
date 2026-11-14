"use client";

// Starting a practice session without internet.
//
// The General Training page keeps a copy of the question pools on the phone
// (refreshed every few hours while online). With no internet, the session is
// built from that copy and gets its own id; its time goes into the offline
// queue and reaches the server when the internet is back.

import { EXAMS, type ExamCode } from "@/config/exams";
import { buildGeneralSteps, type PoolTopic } from "./general-plan";
import type { RecordingType, SessionPlan, Step } from "./types";

type Pack = { exam: ExamCode; savedAt: number; parts: Record<number, PoolTopic[]> };

const packKey = (exam: ExamCode) => `se-question-pack-v1-${exam}`;
const REFRESH_MS = 6 * 60 * 60 * 1000;
/** How long the server gets to start a session before the phone starts one by itself. */
export const ONLINE_START_TIMEOUT_MS = 12_000;

function readPack(exam: ExamCode): Pack | null {
  try {
    const raw = window.localStorage.getItem(packKey(exam));
    return raw ? (JSON.parse(raw) as Pack) : null;
  } catch {
    return null;
  }
}

/** Download the question pools when the saved copy is missing or old. Never throws. */
export async function refreshQuestionPack(exam: ExamCode) {
  if (!navigator.onLine) return;
  const pack = readPack(exam);
  if (pack && Date.now() - pack.savedAt < REFRESH_MS) return;
  try {
    const res = await fetch(`/api/practice/content?exam=${exam}`);
    if (!res.ok) return;
    const fresh = (await res.json()) as Pack;
    window.localStorage.setItem(packKey(exam), JSON.stringify({ ...fresh, savedAt: Date.now() }));
  } catch {
    // Offline or storage full: keep the old copy.
  }
}

function newId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** General Training from the saved questions. "nopack" = never downloaded on this phone. */
export function offlineGeneralPlan(input: { exam: ExamCode; optionId: string; count: number; recordingType: RecordingType }): SessionPlan | "nopack" | "empty" {
  const pack = readPack(input.exam);
  if (!pack) return "nopack";
  const built = buildGeneralSteps(input, (p) => pack.parts[p] ?? []);
  if (!built || built.steps.length === 0) return "empty";
  return {
    sessionId: newId(),
    exam: input.exam,
    mode: "general",
    label: built.label,
    steps: built.steps,
    allowReplay: true,
    autoAdvance: false,
    unlimited: built.unlimited,
    recordingType: input.recordingType,
    pendingStart: {
      mode: "general",
      exam: input.exam,
      parts: built.option.parts,
      recordingType: input.recordingType,
      mockSetId: null,
      startedAt: new Date().toISOString(),
    },
  };
}

/** The mock test the page showed, with the steps the page brought along. */
export function offlineMockPlan(input: { exam: ExamCode; mockSetId: string; name: string; steps: Step[]; recordingType: RecordingType }): SessionPlan {
  return {
    sessionId: newId(),
    exam: input.exam,
    mode: "mock",
    label: input.name,
    steps: input.steps,
    allowReplay: false,
    autoAdvance: true,
    recordingType: input.recordingType,
    pendingStart: {
      mode: "mock",
      exam: input.exam,
      parts: EXAMS[input.exam].parts.map((p) => p.part).filter((p) => input.steps.some((s) => s.part === p)),
      recordingType: input.recordingType,
      mockSetId: input.mockSetId,
      startedAt: new Date().toISOString(),
    },
  };
}

/** Resolve with the promise, or "timeout" when it takes too long (the request may still finish later). */
export function withTimeout<T>(p: Promise<T>, ms = ONLINE_START_TIMEOUT_MS): Promise<T | "timeout"> {
  return Promise.race([p, new Promise<"timeout">((r) => window.setTimeout(() => r("timeout"), ms))]);
}
