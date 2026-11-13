"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, ListChecks, Plus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoicePreviewButton } from "@/components/admin/voice-preview-button";
import { addQuestions, checkQuestions, type LineCheck } from "./actions";

export function AddQuestions({ topicId }: { topicId: string }) {
  const t = useTranslations("admin.add");
  const [single, setSingle] = useState("");
  const [bulk, setBulk] = useState("");
  const [checks, setChecks] = useState<LineCheck[] | null>(null);
  const [singleCheck, setSingleCheck] = useState<LineCheck | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addSingle() {
    startTransition(async () => {
      const [check] = await checkQuestions(topicId, single);
      // Show a similarity warning once; a second click saves anyway.
      if (check && check.status === "new" && check.similar && singleCheck?.text !== check.text) {
        setSingleCheck(check);
        return;
      }
      const res = await addQuestions(topicId, single);
      setMessage(res.error ?? t("added", { count: res.added }));
      if (!res.error) {
        setSingle("");
        setSingleCheck(null);
      }
    });
  }

  function runCheck() {
    startTransition(async () => {
      setChecks(await checkQuestions(topicId, bulk));
      setMessage(null);
    });
  }

  function saveBulk() {
    startTransition(async () => {
      const res = await addQuestions(topicId, bulk);
      setMessage(res.error ?? t("added", { count: res.added }));
      if (!res.error) {
        setBulk("");
        setChecks(null);
      }
    });
  }

  const newCount = checks?.filter((c) => c.status === "new").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <Label htmlFor="add-single">{t("single")}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="add-single"
            value={single}
            onChange={(e) => {
              setSingle(e.target.value);
              setSingleCheck(null);
            }}
            placeholder={t("singlePlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && single.trim() && (e.preventDefault(), addSingle())}
          />
          <div className="flex flex-wrap gap-2">
            <VoicePreviewButton text={single} showLabel />
            <Button type="button" onClick={addSingle} disabled={pending || single.trim().length < 2}>
              <Plus aria-hidden />
              {t("addOne")}
            </Button>
          </div>
        </div>
        {singleCheck?.similar && (
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            {t("similar", { text: singleCheck.similar.text, where: singleCheck.similar.where })}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Label htmlFor="add-bulk">{t("bulk")}</Label>
        <Textarea
          id="add-bulk"
          value={bulk}
          onChange={(e) => {
            setBulk(e.target.value);
            setChecks(null);
          }}
          placeholder={t("bulkPlaceholder")}
          rows={6}
        />
        <Button type="button" variant="secondary" onClick={runCheck} disabled={pending || !bulk.trim()} className="self-start">
          <ListChecks aria-hidden />
          {t("check")}
        </Button>
      </section>

      {checks && (
        <section className="flex flex-col gap-3">
          <h3 className="font-semibold text-primary">{t("previewTitle", { count: checks.length })}</h3>
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-card">
            {checks.map((c, i) => (
              <li key={i} className="flex flex-col gap-1 px-4 py-2.5">
                <span className={c.status === "new" ? "" : "text-muted-foreground line-through"}>{c.text}</span>
                <span className="flex items-center gap-1.5 text-sm">
                  {c.status === "new" && !c.similar && (
                    <>
                      <Check className="size-4 text-accent" aria-hidden /> {t("new")}
                    </>
                  )}
                  {c.status === "new" && c.similar && (
                    <>
                      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
                      {t("similar", { text: c.similar.text, where: c.similar.where })}
                    </>
                  )}
                  {c.status === "inTopic" && (
                    <>
                      <Copy className="size-4 text-muted-foreground" aria-hidden /> {t("inTopic")}
                    </>
                  )}
                  {c.status === "repeated" && (
                    <>
                      <Copy className="size-4 text-muted-foreground" aria-hidden /> {t("repeated")}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">{t("skipNote")}</p>
          <Button type="button" onClick={saveBulk} disabled={pending || newCount === 0} className="self-start">
            {t("saveN", { count: newCount })}
          </Button>
        </section>
      )}

      {message && (
        <p role="status" className="rounded-button bg-surface px-3 py-2 text-sm font-semibold text-surface-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
