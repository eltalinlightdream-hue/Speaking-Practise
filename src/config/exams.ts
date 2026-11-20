// One place for the exam structure and timers.
// Change numbers here; no other code needs to change.

export type ExamCode = "ielts" | "cefr";

export type PartConfig = {
  /** The part number stored in the database. */
  part: number;
  /** The name people see ("1", "1.1", ...). Defaults to the part number. */
  label?: string;
  /** "questions": a list of spoken questions. "cue-card": prepare, then talk about one card. */
  kind: "questions" | "cue-card";
  /** Seconds to answer each question (kind "questions"). */
  secondsPerQuestion?: number;
  /** Seconds for the first question of a topic, when it differs (CEFR Part 1.2: describe the pictures). */
  firstQuestionSeconds?: number;
  /** Ask a topic's questions together and in order, never mixed with other topics (CEFR Part 1.2). */
  wholeTopics?: boolean;
  /** Do not show the topic title above the question (CEFR Part 1.1: the real exam shows none). */
  hideTopic?: boolean;
  /** How many pictures a topic of this part has (admin form). */
  pictures?: number;
  /**
   * How a card looks (kind "cue-card"):
   * "ielts"     title + "You should say:" bullets + "and explain" line;
   * "questions" picture + numbered questions (the bullets), read aloud (CEFR Part 2);
   * "debate"    statement (the title) + arguments for and against (CEFR Part 3).
   */
  cardStyle?: "ielts" | "questions" | "debate";
  /** Seconds to prepare and maximum seconds to speak (kind "cue-card"). */
  prepSeconds?: number;
  speakSeconds?: number;
  /** For Part 3: discussion topics are linked to a Part 2 cue card. */
  linkedToPart?: number;
};

/** id is also the message key (practice.options.<id>, practice.optionHelp.<id>). */
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
      { part: 2, kind: "cue-card", cardStyle: "ielts", prepSeconds: 60, speakSeconds: 120 },
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
  // CEFR (Multi-Level), from the September 2026 exam booklet (content/cefr/mock-sets.json).
  cefr: {
    code: "cefr",
    label: "CEFR",
    parts: [
      { part: 1, label: "1.1", kind: "questions", secondsPerQuestion: 30, hideTopic: true },
      { part: 2, label: "1.2", kind: "questions", secondsPerQuestion: 30, firstQuestionSeconds: 45, wholeTopics: true, pictures: 2 },
      { part: 3, label: "2", kind: "cue-card", cardStyle: "questions", prepSeconds: 60, speakSeconds: 120, pictures: 1 },
      { part: 4, label: "3", kind: "cue-card", cardStyle: "debate", prepSeconds: 60, speakSeconds: 120 },
    ],
    generalTraining: [
      { id: "cefr11", parts: [1] },
      { id: "cefr12", parts: [2] },
      { id: "cefr1", parts: [1, 2] },
      { id: "cefr2", parts: [3] },
      { id: "cefr3", parts: [4] },
    ],
    defaultQuestionCount: 3,
  },
};

export const EXAM_CODES = Object.keys(EXAMS) as ExamCode[];

export function isExamCode(v: unknown): v is ExamCode {
  return v === "ielts" || v === "cefr";
}

export function partConfig(exam: ExamCode, part: number) {
  return EXAMS[exam].parts.find((p) => p.part === part);
}

/** The part name people see: "1.2" for CEFR part 2, "2" for IELTS part 2. Works with any exam string. */
export function partLabel(exam: string, part: number) {
  return (isExamCode(exam) && partConfig(exam, part)?.label) || String(part);
}
