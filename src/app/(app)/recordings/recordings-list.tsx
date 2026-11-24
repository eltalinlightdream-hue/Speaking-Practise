"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Download, Mic, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EXAMS, isExamCode } from "@/config/exams";
import { formatDayTime } from "@/lib/format-date";
import { extensionFor } from "@/lib/practice/recorder";
import {
  MAX_RECORDINGS,
  deleteRecording,
  listRecordings,
  recordingFileName,
  type StoredRecording,
} from "@/lib/practice/recordings-db";

type State = { status: "loading" } | { status: "unavailable" } | { status: "ready"; items: StoredRecording[] };

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RecordingsList() {
  const t = useTranslations("recordings");
  const tModes = useTranslations("practice.modes");
  const tHome = useTranslations("home");
  const locale = useLocale();
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      setState({ status: "ready", items: await listRecordings() });
    } catch {
      setState({ status: "unavailable" });
    }
  }, []);

  useEffect(() => {
    // Reading IndexedDB is async; the state is set when it answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function remove(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    await deleteRecording(id);
    await load();
  }

  const warning = (
    <p className="flex items-start gap-2 rounded-button border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      {t("warning")}
    </p>
  );

  if (state.status === "loading") {
    return (
      <>
        {warning}
        <p className="text-muted-foreground" role="status">
          {t("loading")}
        </p>
      </>
    );
  }

  if (state.status === "unavailable") {
    return (
      <>
        {warning}
        <p role="alert" className="text-destructive">
          {t("unavailable")}
        </p>
      </>
    );
  }

  const { items } = state;
  const totalBytes = items.reduce((sum, r) => sum + r.size, 0);

  return (
    <>
      {warning}

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-surface text-surface-foreground">
              <Mic className="size-5" aria-hidden />
            </span>
            <p className="font-semibold text-primary">{t("empty")}</p>
            <p className="text-sm text-muted-foreground">{t("emptyHelp")}</p>
            <Button asChild>
              <Link href="/home">{tHome("generalTraining")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground tabular-nums">
            {t("usage", { count: items.length, max: MAX_RECORDINGS, size: formatSize(totalBytes) })}
          </p>
          <ul className="flex flex-col gap-4">
            {items.map((r) => (
              <RecordingItem
                key={r.id}
                recording={r}
                title={`${isExamCode(r.exam) ? EXAMS[r.exam].label : r.exam} · ${tModes(r.mode)}`}
                date={formatDayTime(new Date(r.createdAt), locale)}
                length={t("length", { m: Math.floor(r.durationSeconds / 60), s: r.durationSeconds % 60 })}
                downloadLabel={t("download")}
                deleteLabel={t("delete")}
                onDelete={() => void remove(r.id)}
              />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function RecordingItem({
  recording,
  title,
  date,
  length,
  downloadLabel,
  deleteLabel,
  onDelete,
}: {
  recording: StoredRecording;
  title: string;
  date: string;
  length: string;
  downloadLabel: string;
  deleteLabel: string;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  // A temporary link to the file in this browser; freed when the item goes away.
  useEffect(() => {
    const u = URL.createObjectURL(recording.blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [recording.blob]);

  const Icon = recording.type === "video" ? Video : Mic;

  return (
    <li>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-surface-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold text-primary">{title}</span>
              {recording.label && <span className="text-sm font-semibold text-muted-foreground">{recording.label}</span>}
              <span className="text-sm text-muted-foreground">
                {date} · <span className="whitespace-nowrap">{length}</span> · <span className="whitespace-nowrap">{formatSize(recording.size)}</span>
              </span>
            </div>
          </div>

          {url &&
            (recording.type === "video" ? (
              <video src={url} controls playsInline preload="metadata" className="w-full rounded-card bg-foreground" />
            ) : (
              <audio src={url} controls preload="metadata" className="w-full" />
            ))}

          <div className="flex flex-wrap gap-2">
            {url && (
              <Button asChild variant="outline">
                <a href={url} download={recordingFileName(recording, extensionFor(recording.mimeType))}>
                  <Download aria-hidden />
                  {downloadLabel}
                </a>
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onDelete} className="text-destructive hover:bg-destructive/10">
              <Trash2 aria-hidden />
              {deleteLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
