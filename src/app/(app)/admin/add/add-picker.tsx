"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/input";
import { EXAMS, EXAM_CODES, type ExamCode } from "@/config/exams";
import { NEW_TOPIC } from "./new-topic";

/**
 * Exam, part and topic for "Add questions". Every change opens the choice
 * right away (no extra button). The last topic option, "+ New topic", opens a
 * small form on the same page.
 */
export function AddPicker({
  exam,
  part,
  topic,
  topics,
  canCreate,
}: {
  exam: ExamCode;
  part: number;
  topic: string;
  topics: { id: string; title: string; active: boolean }[];
  /** False for cue-card parts (no questions there, so no "+ New topic"). */
  canCreate: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const go = (e: string, p: number, tp: string) => {
    const q = new URLSearchParams({ exam: e, part: String(p) });
    if (tp) q.set("topic", tp);
    router.push(`/admin/add?${q}`, { scroll: false });
  };

  return (
    <div className="grid gap-3 rounded-card border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_2fr] sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="a-exam">{t("content.exam")}</Label>
        <NativeSelect id="a-exam" value={exam} onChange={(e) => go(e.target.value, 1, "")}>
          {EXAM_CODES.map((e) => (
            <option key={e} value={e}>
              {EXAMS[e].label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="a-part">{t("content.part")}</Label>
        <NativeSelect id="a-part" value={String(part)} onChange={(e) => go(exam, Number(e.target.value), "")}>
          {EXAMS[exam].parts.map((p) => (
            <option key={p.part} value={p.part}>
              {t("stats.part", { part: p.part })}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="a-topic">{t("add.chooseTopic")}</Label>
        <NativeSelect id="a-topic" value={topic} onChange={(e) => go(exam, part, e.target.value)}>
          <option value="" disabled>
            {t("add.pickTopic")}
          </option>
          {canCreate && <option value={NEW_TOPIC}>{t("add.newTopicOption")}</option>}
          {topics.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
              {x.active ? "" : ` (${t("topic.disabled")})`}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
