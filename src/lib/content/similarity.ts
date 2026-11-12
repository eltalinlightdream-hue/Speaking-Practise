// Duplicate detection for questions. Pure functions, no database.

const STOP = new Set(["a", "an", "the", "do", "does", "did", "you", "your", "is", "are", "of", "to", "in", "what", "how", "why"]);

export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string) {
  const all = normalize(text).split(" ").filter(Boolean);
  const content = all.filter((w) => !STOP.has(w));
  return new Set(content.length >= 2 ? content : all);
}

/** 0..1, where 1 means the same words. */
export function similarity(a: string, b: string) {
  if (normalize(a) === normalize(b)) return 1;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  return shared / (ta.size + tb.size - shared);
}

export const DUPLICATE_THRESHOLD = 0.75;

export type DuplicateMatch = { text: string; score: number; where?: string };

/** Best match above the threshold, or null. */
export function findDuplicate(text: string, existing: { text: string; where?: string }[]): DuplicateMatch | null {
  let best: DuplicateMatch | null = null;
  for (const e of existing) {
    const score = similarity(text, e.text);
    if (score >= DUPLICATE_THRESHOLD && (!best || score > best.score)) best = { text: e.text, score, where: e.where };
  }
  return best;
}

/** Split pasted text into questions: one per line, trimmed, bullets removed, empty lines skipped. */
export function splitLines(pasted: string) {
  return pasted
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 2);
}
