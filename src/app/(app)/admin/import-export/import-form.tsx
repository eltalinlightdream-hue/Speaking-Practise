"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runImport, type ImportSummary } from "./actions";

export function ImportForm() {
  const t = useTranslations("admin");
  // A chosen file is kept out of the text box so large files stay fast.
  const [pasted, setPasted] = useState("");
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const text = fileText ?? pasted;
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File) {
    setFileName(file.name);
    setFileText(await file.text());
    setSummary(null);
    setError(null);
  }

  function go(dryRun: boolean) {
    startTransition(async () => {
      const res = await runImport(text, dryRun);
      if (res.error) {
        setSummary(null);
        setError(
          res.error === "invalidJson" ? t("io.invalidJson") : res.error === "wrongFormat" ? t("io.wrongFormat") : t("errors.generic", { message: res.error }),
        );
      } else {
        setError(null);
        setSummary(res.summary ?? null);
      }
    });
  }

  const rows: [string, number][] = summary
    ? [
        [t("io.topicsCreated"), summary.topics_created],
        [t("io.topicsUpdated"), summary.topics_updated],
        [t("io.questionsCreated"), summary.questions_created],
        [t("io.questionsUpdated"), summary.questions_updated],
        [t("io.mocksCreated"), summary.mock_sets_created],
        [t("io.mocksUpdated"), summary.mock_sets_updated],
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <input
          id="import-file"
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Button asChild variant="outline" className="self-start">
          <label htmlFor="import-file" className="cursor-pointer">
            <Upload aria-hidden />
            {t("io.chooseFile")}
          </label>
        </Button>
        {fileName && <p className="text-sm text-muted-foreground">{fileName}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="import-text">{t("io.orPaste")}</Label>
        <Textarea
          id="import-text"
          value={pasted}
          onChange={(e) => {
            setPasted(e.target.value);
            setSummary(null);
            setFileName(null);
            setFileText(null);
          }}
          rows={6}
          className="font-mono text-sm"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => go(true)} disabled={pending || !text.trim()}>
          <Eye aria-hidden />
          {t("io.preview")}
        </Button>
        {summary?.dry_run && (
          <Button type="button" onClick={() => go(false)} disabled={pending}>
            {t("io.confirm")}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-button border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {summary && (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-muted p-4" role="status">
          <p className="font-semibold text-primary">{summary.dry_run ? t("io.previewNote") : t("io.done")}</p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {rows.map(([label, value]) => (
              <div key={label} className="rounded-button bg-card p-3">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-xl font-semibold tabular-nums text-primary">{value}</dd>
              </div>
            ))}
          </dl>
          {summary.problems.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 text-warning" aria-hidden />
                {t("io.problems")} ({summary.problems.length})
              </p>
              <ul className="list-disc pl-6 text-sm">
                {summary.problems.slice(0, 50).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
