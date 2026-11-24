"use client";

import { useTranslations } from "next-intl";
import { IdCard, UserRound, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * What the examiner has said so far in this turn, one sentence per line,
 * added as each sentence is spoken. The newest line is bold and, while the
 * voice is still speaking, has a speaker icon (meaning is not shown by colour).
 */
export function ExaminerCaptions({
  lines,
  speaking,
  showText,
  hint,
}: {
  lines: string[];
  speaking: boolean;
  showText: boolean;
  /** Message key in practice.examiner, e.g. "idHint". */
  hint?: string;
}) {
  const t = useTranslations("practice.examiner");
  return (
    <div className="w-full max-w-2xl rounded-card border border-border bg-card p-5 text-left shadow-sm">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <UserRound className="size-4" aria-hidden />
        {t("label")}
      </p>
      {showText ? (
        <div lang="en" aria-live="polite" className="flex min-h-14 flex-col gap-2">
          {lines.map((line, i) => {
            const last = i === lines.length - 1;
            return (
              <p key={i} className={cn("caption-in", last ? "text-xl font-semibold leading-snug sm:text-2xl" : "text-lg")}>
                {last && speaking && <Volume2 className="mr-2 inline size-5 -translate-y-0.5 text-primary" aria-hidden />}
                {line}
              </p>
            );
          })}
        </div>
      ) : (
        <p className="flex min-h-14 items-center gap-2 text-muted-foreground">
          <Volume2 className={cn("size-5 shrink-0", speaking && "animate-pulse")} aria-hidden />
          {t("textHidden")}
        </p>
      )}
      {hint && (
        <p className="mt-4 flex items-start gap-2 rounded-button bg-muted px-3 py-2 text-sm text-muted-foreground">
          <IdCard className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t(hint as "idHint")}
        </p>
      )}
    </div>
  );
}
