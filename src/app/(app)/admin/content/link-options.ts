import "server-only";
import { EXAMS, EXAM_CODES } from "@/config/exams";
import { listTopicTitles } from "@/lib/content/queries";

/** Options for "linked topic" selects, keyed "exam:part". */
export async function loadLinkOptions() {
  const entries: [string, { id: string; title: string }[]][] = [];
  for (const exam of EXAM_CODES) {
    const linkParts = new Set(EXAMS[exam].parts.map((p) => p.linkedToPart).filter((p): p is number => Boolean(p)));
    for (const part of linkParts) {
      const rows = await listTopicTitles(exam, part);
      entries.push([`${exam}:${part}`, rows.map((r) => ({ id: r.id, title: r.title }))]);
    }
  }
  return Object.fromEntries(entries);
}
