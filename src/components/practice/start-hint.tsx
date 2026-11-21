"use client";

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import type { RecordingType } from "@/lib/practice/types";

export const START_HINT_ID = "start-hint";

/** Says why the Start button is grey: the microphone (or camera) has not been checked yet. */
export function StartHint({ recordingType, show }: { recordingType: RecordingType; show: boolean }) {
  const t = useTranslations("practice.check");
  if (!show) return null;
  return (
    <p id={START_HINT_ID} className="flex items-start gap-2 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      {recordingType === "video" ? t("neededVideo") : t("needed")}
    </p>
  );
}
