"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExamCode } from "@/config/exams";
import { createTopic, type ActionResult } from "../content/actions";

/** Create a topic without leaving "Add questions"; afterwards the page opens it for questions. */
export function NewTopicInline({
  exam,
  part,
  linkOptions,
  cancelHref,
}: {
  exam: ExamCode;
  part: number;
  /** Cue cards this topic can be linked to (Part 3), or null when the part has no link. */
  linkOptions: { id: string; title: string }[] | null;
  cancelHref: string;
}) {
  const t = useTranslations("admin");
  const ts = useTranslations("settings");
  const [state, action, pending] = useActionState<ActionResult, FormData>(createTopic, {});
  const errorText = state.error
    ? state.error === "required"
      ? t("errors.required")
      : state.error === "duplicateTitle"
        ? t("errors.duplicateTitle")
        : t("errors.generic", { message: state.error })
    : null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="exam" value={exam} />
      <input type="hidden" name="part" value={part} />
      <input type="hidden" name="after" value="add" />
      <div className="flex flex-col gap-2">
        <Label htmlFor="n-title">{t("topic.title")}</Label>
        <Input id="n-title" name="title" required maxLength={300} autoFocus aria-invalid={!!errorText || undefined} />
      </div>
      {linkOptions && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="n-related">{t("topic.related")}</Label>
          <NativeSelect id="n-related" name="related_topic_id" defaultValue="">
            <option value="">{t("topic.none")}</option>
            {linkOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      {errorText && (
        <p role="alert" className="rounded-button border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorText}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
        <Button asChild variant="outline">
          <Link href={cancelHref}>{ts("deleteCancel")}</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          <Plus aria-hidden />
          {t("add.createAndContinue")}
        </Button>
      </div>
    </form>
  );
}
