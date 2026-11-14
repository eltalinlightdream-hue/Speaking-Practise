"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecordingChoice } from "@/components/practice/recording-choice";
import { StartHint, START_HINT_ID } from "@/components/practice/start-hint";
import { SessionRunner, type SessionOutcome } from "@/components/practice/session-runner";
import { FinishScreen } from "@/components/practice/finish-screen";
import { EXAMS, type ExamCode } from "@/config/exams";
import type { NextMock } from "@/lib/practice/mock-rotation";
import { stopStream } from "@/lib/practice/recorder";
import { saveSessionOutcome, type FinishedSession } from "@/lib/practice/save-outcome";
import { unlockSpeech } from "@/lib/speech";
import type { RecordingType, SessionPlan } from "@/lib/practice/types";
import { startMockTest } from "../../actions";

type Stage = "ready" | "running" | "finished";

export function MockTest({ exam, next }: { exam: ExamCode; next: NextMock }) {
  const t = useTranslations("practice");
  const router = useRouter();
  const cfg = EXAMS[exam];
  const [stage, setStage] = useState<Stage>("ready");
  const [recordingType, setRecordingType] = useState<RecordingType>("audio");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinishedSession | null>(null);
  const [pending, startTransition] = useTransition();

  // Each new step starts at the top of the page (on a phone the last tap was near the bottom).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stage]);

  // Release the microphone/camera when leaving the page.
  useEffect(() => () => stopStream(stream), [stream]);

  const canStart = recordingType === "none" || !!stream;

  function start() {
    unlockSpeech();
    setError(null);
    startTransition(async () => {
      const res = await startMockTest({ exam, mockSetId: next.set.id, recordingType });
      if (res.error || !res.plan) {
        if (res.error === "taken") {
          // Finished on another device meanwhile: load the next set.
          setError(t("mock.taken"));
          router.refresh();
        } else {
          setError(res.error === "empty" ? t("mock.broken") : (res.error ?? "error"));
        }
        return;
      }
      setPlan(res.plan);
      setStage("running");
    });
  }

  const onFinished = useCallback(
    async (outcome: SessionOutcome) => {
      const finished = plan ? await saveSessionOutcome(plan, outcome) : { outcome, saved: null, recordingError: false };
      stopStream(stream);
      setStream(null);
      setResult(finished);
      setStage("finished");
      // The server page picks the next set (a finished one will not come back).
      router.refresh();
    },
    [plan, stream, router],
  );

  if (stage === "running" && plan) return <SessionRunner plan={plan} stream={stream} onFinished={onFinished} />;

  if (stage === "finished" && result) {
    const completed = result.outcome.completed;
    return (
      <FinishScreen
        activeSeconds={result.outcome.activeSeconds}
        savedSeconds={result.outcome.savedSeconds}
        recording={result.saved}
        recordingError={result.recordingError}
        stoppedEarly={!completed}
        note={completed ? t("mock.doneNote", { name: plan?.label ?? "" }) : t("mock.stoppedNote")}
        againLabel={t("mock.another")}
        onAgain={() => {
          setResult(null);
          setPlan(null);
          setStage("ready");
          // Ask again in case the refresh after finishing has not arrived yet (slow internet).
          router.refresh();
        }}
      />
    );
  }

  const part = (n: number) => cfg.parts.find((p) => p.part === n);
  const p1 = part(1);
  const p2 = part(2);
  const p3 = part(3);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t("mockTitle", { exam: cfg.label })}</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{t("mock.number", { n: next.number, total: next.total })}</Badge>
            {next.cycle > 1 && <Badge variant="outline">{t("mock.round", { n: next.cycle })}</Badge>}
          </div>
          <CardTitle className="pt-2 text-xl">{next.set.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {p1 && (
              <li className="flex items-start gap-3">
                <span className="w-16 shrink-0 font-semibold text-primary">{t("session.part", { part: 1 })}</span>
                <span>{t("mock.p1", { s: p1.secondsPerQuestion ?? 45 })}</span>
              </li>
            )}
            {p2 && (
              <li className="flex items-start gap-3">
                <span className="w-16 shrink-0 font-semibold text-primary">{t("session.part", { part: 2 })}</span>
                <span>{t("mock.p2", { prep: Math.round((p2.prepSeconds ?? 60) / 60), speak: Math.round((p2.speakSeconds ?? 120) / 60) })}</span>
              </li>
            )}
            {p3 && (
              <li className="flex items-start gap-3">
                <span className="w-16 shrink-0 font-semibold text-primary">{t("session.part", { part: 3 })}</span>
                <span>{t("mock.p3", { s: p3.secondsPerQuestion ?? 60 })}</span>
              </li>
            )}
          </ul>
          <p className="flex items-start gap-2 rounded-button bg-muted px-3 py-2 text-sm">
            <Clock className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden />
            {t("mock.rules")}
          </p>
        </CardContent>
      </Card>

      <RecordingChoice recordingType={recordingType} onRecordingTypeChange={setRecordingType} stream={stream} onStreamChange={setStream} />

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-button border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <StartHint recordingType={recordingType} show={!canStart} />

      <Button type="button" size="lg" onClick={start} disabled={!canStart || pending} className="self-start" aria-describedby={canStart ? undefined : START_HINT_ID}>
        <Play aria-hidden />
        {pending ? t("starting") : t("mock.start")}
      </Button>
    </div>
  );
}
