"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXAMS, EXAM_CODES, type ExamCode } from "@/config/exams";
import { createTopic, updateTopic, type ActionResult } from "./actions";

type Option = { id: string; title: string };

export type TopicFormValues = {
  id?: string;
  exam: ExamCode;
  part: number;
  title: string;
  is_core: boolean;
  active: boolean;
  cue_bullets: string[];
  cue_explain: string | null;
  related_topic_id: string | null;
};

export function TopicForm({
  initial,
  linkOptions,
}: {
  initial: TopicFormValues;
  /** Topics that can be linked to, per exam and part (e.g. Part 2 cue cards). */
  linkOptions: Record<string, Option[]>;
}) {
  const t = useTranslations("admin");
  const isNew = !initial.id;
  const [state, action, pending] = useActionState<ActionResult, FormData>(isNew ? createTopic : updateTopic, {});
  const [exam, setExam] = useState<ExamCode>(initial.exam);
  const [part, setPart] = useState<number>(initial.part);

  const cfg = EXAMS[exam].parts.find((p) => p.part === part) ?? EXAMS[exam].parts[0];
  const isCue = cfg.kind === "cue-card";
  const linkPart = cfg.linkedToPart;
  const options = linkPart ? linkOptions[`${exam}:${linkPart}`] ?? [] : [];

  const errorText = state.error
    ? state.error === "required"
      ? t("errors.required")
      : state.error === "duplicateTitle"
        ? t("errors.duplicateTitle")
        : t("errors.generic", { message: state.error })
    : null;

  return (
    <form action={action} className="flex flex-col gap-5">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      {isNew && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="t-exam">{t("content.exam")}</Label>
            <NativeSelect id="t-exam" name="exam" value={exam} onChange={(e) => setExam(e.target.value as ExamCode)}>
              {EXAM_CODES.map((e) => (
                <option key={e} value={e}>
                  {EXAMS[e].label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="t-part">{t("content.part")}</Label>
            <NativeSelect id="t-part" name="part" value={part} onChange={(e) => setPart(Number(e.target.value))}>
              {EXAMS[exam].parts.map((p) => (
                <option key={p.part} value={p.part}>
                  {t("stats.part", { part: p.part })}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="t-title">{t("topic.title")}</Label>
        <Input id="t-title" name="title" defaultValue={initial.title} required maxLength={300} />
      </div>

      {isCue && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="t-bullets">{t("topic.bullets")}</Label>
            <Textarea id="t-bullets" name="cue_bullets" defaultValue={initial.cue_bullets.join("\n")} rows={4} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="t-explain">{t("topic.explain")}</Label>
            <Input id="t-explain" name="cue_explain" defaultValue={initial.cue_explain ?? ""} placeholder="and explain …" />
          </div>
        </>
      )}

      {linkPart && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-related">{t("topic.related")}</Label>
          <NativeSelect id="t-related" name="related_topic_id" defaultValue={initial.related_topic_id ?? ""}>
            <option value="">{t("topic.none")}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      {!isNew && (
        <div className="flex flex-col gap-3">
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="active" defaultChecked={initial.active} className="size-5 accent-primary" />
            {t("topic.active")}
          </label>
          {part === 1 && (
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="is_core" defaultChecked={initial.is_core} className="size-5 accent-primary" />
              {t("topic.core")}
            </label>
          )}
        </div>
      )}

      {errorText && (
        <p role="alert" className="rounded-button border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorText}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rounded-button bg-surface px-3 py-2 text-sm font-semibold text-surface-foreground">
          {t("topic.saved")}
        </p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {isNew ? t("topic.create") : t("topic.save")}
      </Button>
    </form>
  );
}
