"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, ChevronRight, Infinity as InfinityIcon, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecordingChoice } from "@/components/practice/recording-choice";
import { SessionRunner, type SessionOutcome } from "@/components/practice/session-runner";
import { FinishScreen } from "@/components/practice/finish-screen";
import { EXAMS, type ExamCode } from "@/config/exams";
import { stopStream } from "@/lib/practice/recorder";
import { unlockSpeech } from "@/lib/speech";
import { saveSessionOutcome, type FinishedSession } from "@/lib/practice/save-outcome";
import type { RecordingType, SessionPlan } from "@/lib/practice/types";
import { cn } from "@/lib/utils";
import { startGeneralTraining } from "../../actions";

type Stage = "choose" | "record" | "running" | "finished";
// 0 = unlimited (shown as ∞).
const COUNTS = [3, 5, 8, 10, 0];

export function GeneralTraining({ exam }: { exam: ExamCode }) {
  const t = useTranslations("practice");
  const cfg = EXAMS[exam];
  const [stage, setStage] = useState<Stage>("choose");
  const [optionId, setOptionId] = useState(cfg.generalTraining[0].id);
  const [count, setCount] = useState(cfg.defaultQuestionCount);
  const [recordingType, setRecordingType] = useState<RecordingType>("audio");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinishedSession | null>(null);
  const [pending, startTransition] = useTransition();

  // Release the microphone/camera when leaving the page.
  useEffect(() => () => stopStream(stream), [stream]);

  const option = cfg.generalTraining.find((o) => o.id === optionId)!;
  const onlyCueCard = option.parts.every((p) => cfg.parts.find((x) => x.part === p)?.kind === "cue-card");
  const needsStream = recordingType !== "none";
  const canStart = !needsStream || !!stream;

  function start() {
    unlockSpeech();
    setError(null);
    startTransition(async () => {
      const res = await startGeneralTraining({ exam, optionId, count, recordingType });
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
      const finished = plan ? await saveSessionOutcome(plan, outcome) : { outcome, saved: null, recordingError: false };
      stopStream(stream);
      setStream(null);
      setResult(finished);
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
        onAgain={() => {
          setResult(null);
          setPlan(null);
          setStage("choose");
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t("generalTitle", { exam: cfg.label })}</h1>

      {stage === "choose" && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg">{t("chooseParts")}</h2>
            <div role="radiogroup" aria-label={t("chooseParts")} className="grid gap-3 sm:grid-cols-2">
              {cfg.generalTraining.map((o) => {
                const selected = o.id === optionId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setOptionId(o.id)}
                    className={cn(
                      "flex min-h-20 flex-col items-start gap-1 rounded-card border-2 p-4 text-left transition-colors",
                      selected ? "border-primary bg-surface" : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <span className="font-semibold text-primary">{t(`options.${o.id}` as "options.p1")}</span>
                    <span className="text-sm text-muted-foreground">{t(`optionHelp.${o.id}` as "optionHelp.p1")}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {!onlyCueCard && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg">{t("howMany")}</h2>
              <div role="radiogroup" aria-label={t("howMany")} className="flex flex-wrap gap-2">
                {COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={n === count}
                    aria-label={n === 0 ? t("unlimited") : undefined}
                    title={n === 0 ? t("unlimited") : undefined}
                    onClick={() => setCount(n)}
                    className={cn(
                      "inline-flex min-h-11 min-w-14 items-center justify-center rounded-button border-2 px-4 font-semibold tabular-nums transition-colors",
                      n === count ? "border-primary bg-surface text-surface-foreground" : "border-border bg-card text-primary hover:bg-muted",
                    )}
                  >
                    {n === 0 ? <InfinityIcon className="size-5" aria-hidden /> : n}
                  </button>
                ))}
              </div>
              {count === 0 && <p className="text-sm text-muted-foreground">{t("unlimitedHelp")}</p>}
            </section>
          )}

          <Button type="button" size="lg" onClick={() => setStage("record")} className="self-start">
            {t("next")}
            <ChevronRight aria-hidden />
          </Button>
        </>
      )}

      {stage === "record" && (
        <>
          <RecordingChoice
            recordingType={recordingType}
            onRecordingTypeChange={setRecordingType}
            stream={stream}
            onStreamChange={setStream}
          />

          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-button border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="size-4" aria-hidden />
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="ghost" onClick={() => setStage("choose")}>
              {t("back")}
            </Button>
            <Button type="button" size="lg" onClick={start} disabled={!canStart || pending}>
              <Play aria-hidden />
              {pending ? t("starting") : t("start")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
