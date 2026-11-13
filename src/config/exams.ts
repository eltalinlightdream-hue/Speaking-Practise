// One place for the exam structure and timers.
// Change numbers here; no other code needs to change.

export type ExamCode = "ielts" | "cefr";

export type PartConfig = {
  part: number;
  /** "questions": a list of spoken questions. "cue-card": prepare, then talk about one card. */
  kind: "questions" | "cue-card";
  /** Seconds to answer each question (kind "questions"). */
  secondsPerQuestion?: number;
  /** Seconds to prepare and maximum seconds to speak (kind "cue-card"). */
  prepSeconds?: number;
  speakSeconds?: number;
  /** For Part 3: discussion topics are linked to a Part 2 cue card. */
  linkedToPart?: number;
};

export type GeneralTrainingOption = { id: string; parts: number[] };

export type ExamConfig = {
  code: ExamCode;
  label: string;
  parts: PartConfig[];
  generalTraining: GeneralTrainingOption[];
  /** Default number of questions per part in General Training. */
  defaultQuestionCount: number;
  /** True while the real format has not been added yet. */
  placeholder?: boolean;
};

export const EXAMS: Record<ExamCode, ExamConfig> = {
  ielts: {
    code: "ielts",
    label: "IELTS",
    parts: [
      { part: 1, kind: "questions", secondsPerQuestion: 45 },
      { part: 2, kind: "cue-card", prepSeconds: 60, speakSeconds: 120 },
      { part: 3, kind: "questions", secondsPerQuestion: 60, linkedToPart: 2 },
    ],
    generalTraining: [
      { id: "p1", parts: [1] },
      { id: "p2", parts: [2] },
      { id: "p3", parts: [3] },
      { id: "p1p3", parts: [1, 3] },
    ],
    defaultQuestionCount: 5,
  },
  cefr: {
    code: "cefr",
    label: "CEFR",
    placeholder: true,
    parts: [
      { part: 1, kind: "questions", secondsPerQuestion: 30 },
      { part: 2, kind: "cue-card", prepSeconds: 60, speakSeconds: 120 },
      { part: 3, kind: "questions", secondsPerQuestion: 60 },
    ],
    generalTraining: [
      { id: "p1", parts: [1] },
      { id: "p2", parts: [2] },
      { id: "p3", parts: [3] },
    ],
    defaultQuestionCount: 5,
  },
};

export const EXAM_CODES = Object.keys(EXAMS) as ExamCode[];

export function isExamCode(v: unknown): v is ExamCode {
  return v === "ielts" || v === "cefr";
}

export function partConfig(exam: ExamCode, part: number) {
  return EXAMS[exam].parts.find((p) => p.part === part);
}
