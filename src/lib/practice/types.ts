// Shared types for the practice engine (used by General Training and Mock Tests).

import type { ExamCode } from "@/config/exams";

export type RecordingType = "none" | "audio" | "video";

/** One thing the examiner says. `clip` is a recorded file; without it the browser voice reads the text. */
export type SpokenLine = { text: string; clip?: string | null };

export type QuestionStep = {
  kind: "question";
  part: number;
  /** Topic name shown above the question ("" = no label). */
  topic: string;
  text: string;
  /** Uploaded question audio, or a recorded examiner clip. */
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
  /**
   * Mock tests: what the examiner says when preparation ends ("All right? …")
   * and when the speaking time ends ("Thank you. …"). When set, the card title
   * is not read aloud (as in the real test). Without them the runner says
   * "Please start speaking now." (General Training).
   */
  startLines?: SpokenLine[];
  endLines?: SpokenLine[];
};

/** The examiner talks; the student does not answer (greeting, instructions). */
export type ExaminerStep = {
  kind: "examiner";
  part: number;
  lines: SpokenLine[];
  /** Silent pause after the lines, e.g. while the student "shows" their ID. */
  waitSeconds?: number;
  /** Message key in practice.examiner shown during the step (e.g. "idHint"). */
  hint?: string;
};

export type Step = QuestionStep | CueCardStep | ExaminerStep;

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
  /** Show what the examiner says one sentence at a time, as it is spoken (mock tests). */
  captions?: boolean;
};
