// Shared types for the practice engine (used by General Training now and Mock Tests in Step 4).

import type { ExamCode } from "@/config/exams";

export type RecordingType = "none" | "audio" | "video";

/** A picture shown with a question or card (CEFR Part 1.2 and Part 2). */
export type Picture = { url: string; alt: string };

/** One thing the examiner says. `clip` is a recorded file; without it the browser voice reads the text. */
export type SpokenLine = { text: string; clip?: string | null };

export type QuestionStep = {
  kind: "question";
  part: number;
  topic: string;
  text: string;
  audioUrl: string | null;
  /** Answer time in seconds. */
  seconds: number;
  /** Pictures to look at while answering (CEFR Part 1.2). */
  images?: Picture[];
};

export type CueCardStep = {
  kind: "cue-card";
  part: number;
  title: string;
  bullets: string[];
  explain: string | null;
  prepSeconds: number;
  speakSeconds: number;
  /** How the card looks (see cardStyle in src/config/exams.ts). Missing = "ielts". */
  style?: "ielts" | "questions" | "debate";
  /** Pictures on the card (CEFR Part 2). */
  images?: Picture[];
  /** CEFR Part 3: arguments for and against the statement in the title. */
  pointsFor?: string[];
  pointsAgainst?: string[];
  /**
   * IELTS mock tests: what the examiner says when preparation ends ("All right? …")
   * and when the speaking time ends ("Thank you. …"). When set, the card title
   * is not read aloud (as in the real test).
   */
  startLines?: SpokenLine[];
  endLines?: SpokenLine[];
};

/** The examiner talks; the student does not answer (greeting, instructions). IELTS mock tests. */
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

/** A session started without internet: the server creates it later (see offline-queue.ts). */
export type PendingStart = {
  mode: "general" | "mock";
  exam: ExamCode;
  parts: number[];
  recordingType: RecordingType;
  mockSetId: string | null;
  /** ISO time the session started on the phone. */
  startedAt: string;
};

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
  /** "Unlimited" General Training: no total shown, the student ends it with Finish. */
  unlimited?: boolean;
  recordingType: RecordingType;
  /** Set when the session was started offline; its time is kept on the phone until it is sent. */
  pendingStart?: PendingStart;
};
