"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Info, Mic, MicOff, Play, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceCheck } from "@/components/practice/device-check";
import { SessionRunner, type SessionOutcome } from "@/components/practice/session-runner";
import { FinishScreen } from "@/components/practice/finish-screen";
import { EXAMS, type ExamCode } from "@/config/exams";
import { stopStream } from "@/lib/practice/recorder";
import { unlockAudio, unlockSpeech } from "@/lib/speech";
import { saveRecording, type StoredRecording } from "@/lib/practice/recordings-db";
import type { RecordingType, SessionPlan } from "@/lib/practice/types";
import { cn } from "@/lib/utils";
import { startMockTest } from "../../actions";

type Stage = "setup" | "running" | "finished";

function isIOS() {
  return typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/** Mock Test: setup (recording + device check) → the full test with the examiner → finish screen. */
export function MockTest({ exam }: { exam: ExamCode }) {
  const t = useTranslations("practice");
  const cfg = EXAMS[exam];
  const [stage, setStage] = useState<Stage>("setup");
  const [recordingType, setRecordingType] = useState<RecordingType>("audio");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ outcome: SessionOutcome; saved: StoredRecording | null; recordingError: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [ios, setIos] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setIos(isIOS()), []);

  // Release the microphone/camera when leaving the page.
  useEffect(() => () => stopStream(stream), [stream]);

  const needsStream = recordingType !== "none";
  const canStart = !needsStream || !!stream;

  function chooseRecording(type: RecordingType) {
    setRecordingType(type);
    // A video stream is needed for video; an audio-only stream is not enough.
    if (stream && (type === "none" || (type === "video") !== stream.getVideoTracks().length > 0)) {
      stopStream(stream);
      setStream(null);
    }
  }

  function start() {
    // iPhone: sound may only start from a tap, so unlock both voices before any await.
    unlockSpeech();
    unlockAudio();
    setError(null);
    startTransition(async () => {
      const res = await startMockTest({ exam, recordingType });
      if (res.error || !res.plan) {
        setError(res.error === "empty" ? t("empty") : res.error ?? "error");
        return;
      }
      setPlan(res.plan);
      setStage("running");
    });
  }

  const onFinished = useCallback(
    async (outcome: SessionOutcome) => {
      let saved: StoredRecording | null = null;
      let recordingError = false;
      if (outcome.recording && plan && plan.recordingType !== "none") {
        try {
          saved = await saveRecording({
            exam: plan.exam,
            mode: plan.mode,
            label: plan.label,
            type: plan.recordingType,
            mimeType: outcome.mimeType || outcome.recording.type,
            durationSeconds: outcome.activeSeconds,
            blob: outcome.recording,
          });
        } catch {
          recordingError = true;
        }
      } else if (plan && plan.recordingType !== "none") {
        recordingError = true;
      }
      stopStream(stream);
      setStream(null);
      setResult({ outcome, saved, recordingError });
      setStage("finished");
    },
    [plan, stream],
  );

  if (stage === "running" && plan) return <SessionRunner plan={plan} stream={stream} onFinished={onFinished} />;

  if (stage === "finished" && result) {
    return (
      <FinishScreen
        activeSeconds={result.outcome.activeSeconds}
        savedSeconds={result.outcome.savedSeconds}
        recording={result.saved}
        recordingError={result.recordingError}
        note={result.outcome.completed ? undefined : t("mockEnded")}
        onAgain={() => {
          setResult(null);
          setPlan(null);
          setStage("setup");
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl">{t("mockTitle", { exam: cfg.label })}</h1>
        <p className="text-muted-foreground">{t("mockLead")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("mockHowTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            <li>{t("mockHow1")}</li>
            <li>{t("mockHow2")}</li>
            <li>{t("mockHow3")}</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("recordingTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("recordingLead")}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div role="radiogroup" aria-label={t("recordingTitle")} className="grid gap-3 sm:grid-cols-3">
            {(["audio", "video", "none"] as const).map((type) => {
              const Icon = type === "audio" ? Mic : type === "video" ? Video : MicOff;
              const selected = type === recordingType;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => chooseRecording(type)}
                  className={cn(
                    "flex min-h-20 flex-col items-start gap-1 rounded-card border-2 p-4 text-left transition-colors",
                    selected ? "border-primary bg-surface" : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2 font-semibold text-primary">
                    <Icon className="size-5" aria-hidden />
                    {t(`recording.${type}`)}
                  </span>
                  <span className="text-sm text-muted-foreground">{t(`recordingHelp.${type}`)}</span>
                </button>
              );
            })}
          </div>

          {recordingType !== "none" && <DeviceCheck key={recordingType} type={recordingType} stream={stream} onReady={setStream} />}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("mockVoiceNote")}
        </p>
        {ios && (
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("safariNote")}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-button border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4" aria-hidden />
          {error}
        </p>
      )}

      <Button type="button" size="lg" onClick={start} disabled={!canStart || pending} className="self-start">
        <Play aria-hidden />
        {pending ? t("starting") : t("mockStart")}
      </Button>
    </div>
  );
}
