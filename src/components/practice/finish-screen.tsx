"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Download, Flag, House, Info, RotateCcw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { extensionFor } from "@/lib/practice/recorder";
import { recordingFileName, type StoredRecording } from "@/lib/practice/recordings-db";

export function FinishScreen({
  activeSeconds,
  savedSeconds,
  recording,
  recordingError,
  onAgain,
  againLabel,
  note,
  stoppedEarly = false,
}: {
  activeSeconds: number;
  savedSeconds: number | null;
  recording: StoredRecording | null;
  recordingError: boolean;
  onAgain: () => void;
  /** Text for the "again" button (default: "Practise again"). */
  againLabel?: string;
  /** Extra line under the title, e.g. what happens with this mock test. */
  note?: string;
  /** The student pressed "End session" before the end. */
  stoppedEarly?: boolean;
}) {
  const t = useTranslations("practice.finish");
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const u = URL.createObjectURL(recording.blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [recording]);

  const shown = savedSeconds ?? activeSeconds;
  const m = Math.floor(shown / 60);
  const s = shown % 60;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span
          className={
            stoppedEarly
              ? "flex size-16 items-center justify-center rounded-full bg-surface text-surface-foreground"
              : "flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground"
          }
        >
          {stoppedEarly ? <Flag className="size-8" aria-hidden /> : <CheckCircle2 className="size-8" aria-hidden />}
        </span>
        <h1 className="text-3xl">{stoppedEarly ? t("stoppedTitle") : t("title")}</h1>
        {note && (
          <p className="flex max-w-md items-start gap-2 text-left text-muted-foreground">
            <Info className="mt-1 size-4 shrink-0" aria-hidden />
            {note}
          </p>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm text-muted-foreground">{t("time")}</p>
          <p className="text-3xl font-semibold tabular-nums text-primary">{t("minutes", { m, s })}</p>
          {savedSeconds !== null ? (
            <p className="text-sm text-muted-foreground">{t("saved")}</p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
              <WifiOff className="size-4" aria-hidden />
              {t("notSaved")}
            </p>
          )}
        </CardContent>
      </Card>

      {recording && url ? (
        <Card>
          <CardContent className="flex flex-col gap-4">
            {recording.type === "video" ? (
              <video src={url} controls playsInline className="w-full rounded-card bg-foreground" />
            ) : (
              <audio src={url} controls className="w-full" />
            )}
            <p className="flex items-start gap-2 rounded-button border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              {t("deviceOnly")}
            </p>
            <Button asChild size="lg">
              <a href={url} download={recordingFileName(recording, extensionFor(recording.mimeType))}>
                <Download aria-hidden />
                {t("download")}
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : recordingError ? (
        <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
          <AlertTriangle className="size-4" aria-hidden />
          {t("recordingFailed")}
        </p>
      ) : (
        <p className="text-center text-muted-foreground">{t("noRecording")}</p>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" variant={recording ? "outline" : "default"} onClick={onAgain}>
          <RotateCcw aria-hidden />
          {againLabel ?? t("again")}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/home">
            <House aria-hidden />
            {t("home")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
