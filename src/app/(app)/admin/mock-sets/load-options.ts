import "server-only";
import { EXAMS, type ExamCode } from "@/config/exams";
import { listTopicTitles } from "@/lib/content/queries";

export async function loadPartOptions(exam: ExamCode) {
  const entries = await Promise.all(
    EXAMS[exam].parts.map(async ({ part }) => [part, await listTopicTitles(exam, part)] as const),
  );
  return Object.fromEntries(entries) as Record<number, { id: string; title: string; active: boolean }[]>;
}
