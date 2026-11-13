// Shared types for the practice engine (used by General Training now and Mock Tests in Step 4).

import type { ExamCode } from "@/config/exams";

export type RecordingType = "none" | "audio" | "video";

export type QuestionStep = {
  kind: "question";
  part: number;
  topic: string;
  text: string;
  audioUrl: string | null;
  /** Answer time in seconds. */
  seconds: number;
};

export type CueCardStep = {
  kind: "cue-card";
  part: number;
  title: string;
  bullets: string[];
  explain: string | null;
  prepSeconds: number;
  speakSeconds: number;
};

export type Step = QuestionStep | CueCardStep;

export type SessionPlan = {
  sessionId: string;
  exam: ExamCode;
  mode: "general" | "mock";
  /** e.g. "Part 1 + Part 3" or "SPEAKING-12" */
  label: string;
  steps: Step[];
  allowReplay: boolean;
  /** Move to the next question automatically when the time runs out (mock tests). */
  autoAdvance: boolean;
  recordingType: RecordingType;
};
