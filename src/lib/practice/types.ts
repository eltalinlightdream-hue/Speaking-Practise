// Shared types for the practice engine (used by General Training now and Mock Tests in Step 4).

import type { ExamCode } from "@/config/exams";

export type RecordingType = "none" | "audio" | "video";

/** A picture shown with a question or card (CEFR Part 1.2 and Part 2). */
export type Picture = { url: string; alt: string };

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
};

export type Step = QuestionStep | CueCardStep;

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
