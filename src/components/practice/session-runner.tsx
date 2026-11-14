"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Flag, Mic, RotateCcw, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { TimerRing } from "@/components/timer-ring";
import { playQuestion, speak, stopSpeaking } from "@/lib/speech";
import { SessionRecorder } from "@/lib/practice/recorder";
import type { SessionPlan, Step } from "@/lib/practice/types";

export type SessionOutcome = {
  /** True only when the student reached the end (not "End session" halfway). */
  completed: boolean;
  activeSeconds: number;
  savedSeconds: number | null;
  recording: Blob | null;
  mimeType: string;
};

type Phase = "listening" | "answering" | "prep" | "speak" | "timeUp";

const HEARTBEAT_MS = 30_000;

/** Seconds allowed in a timed phase (0 = not timed). */
function phaseLimit(p: Phase, s: Step) {
  return s.kind === "question" ? (p === "answering" ? s.seconds : 0) : p === "prep" ? s.prepSeconds : p === "speak" ? s.speakSeconds : 0;
}

function sendProgress(sessionId: string, seconds: number, finished: boolean, beacon = false, completed = false) {
  const body = JSON.stringify({ sessionId, seconds, finished, completed });
  if (beacon && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon("/api/practice/progress", new Blob([body], { type: "text/plain" }));
    return Promise.resolve(null);
  }
  return fetch("/api/practice/progress", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { savedSeconds?: number } | null) => (typeof j?.savedSeconds === "number" ? j.savedSeconds : null))
    .catch(() => null);
}

/**
 * Runs one practice session: reads questions aloud, runs timers, records,
 * and saves practice time. Shared by General Training and Mock Tests.
 */
export function SessionRunner({
  plan,
  stream,
  onFinished,
}: {
  plan: SessionPlan;
  stream: MediaStream | null;
  onFinished: (o: SessionOutcome) => void;
}) {
  const t = useTranslations("practice.session");
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("listening");
  const [phaseElapsed, setPhaseElapsed] = useState(0); // seconds in the current timed phase
  const [hidden, setHidden] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const step: Step = plan.steps[index];
  const isLast = index === plan.steps.length - 1;

  const activeMs = useRef(0);
  const phaseMs = useRef(0);
  const lastTick = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("listening");
  const token = useRef(0); // increases on every step change, so late speech callbacks are ignored
  const recorder = useRef<SessionRecorder | null>(null);
  const done = useRef(false);
  const stepRef = useRef<Step>(plan.steps[0]);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    phaseMs.current = 0;
    setPhaseElapsed(0);
    setPhase(p);
  }, []);


  // ---- Start recording once, when the session begins ----
  useEffect(() => {
    if (stream && plan.recordingType !== "none") {
      try {
        recorder.current = new SessionRecorder(stream, plan.recordingType);
        recorder.current.start();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsRecording(true);
      } catch {
        recorder.current = null;
      }
    }
    return () => {
      stopSpeaking();
      if (!done.current) void recorder.current?.stop();
    };
  }, [stream, plan.recordingType]);

  // ---- Read the step aloud, then start its timer ----
  const present = useCallback(
    (s: Step) => {
      const my = ++token.current;
      setPhaseBoth("listening");
      const text = s.kind === "question" ? s.text : s.title;
      const audio = s.kind === "question" ? s.audioUrl : null;
      playQuestion(text, audio).then(() => {
        if (token.current !== my) return;
        setPhaseBoth(s.kind === "question" ? "answering" : "prep");
      });
    },
    [setPhaseBoth],
  );

  // Present the first step once the screen is shown.
  useEffect(() => {
    const id = window.setTimeout(() => present(plan.steps[0]), 0);
    return () => window.clearTimeout(id);
  }, [plan.steps, present]);

  // ---- Clock: counts only while the page is visible ----
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now();
      const visible = document.visibilityState === "visible";
      if (lastTick.current !== null && visible) {
        const dt = now - lastTick.current;
        activeMs.current += dt;
        if (["answering", "prep", "speak"].includes(phaseRef.current)) {
          phaseMs.current += dt;
          const elapsed = Math.floor(phaseMs.current / 1000);
          setPhaseElapsed(elapsed);
          // Timer ran out: move from preparing to speaking, or show "time is up".
          const limit = phaseLimit(phaseRef.current, stepRef.current);
          if (limit && elapsed >= limit) {
            if (phaseRef.current === "prep") {
              setPhaseBoth("speak");
              void speak("Please start speaking now.");
            } else {
              setPhaseBoth("timeUp");
            }
          }
        }
      }
      lastTick.current = visible ? now : null;
      setHidden(!visible);
    }, 250);
    return () => window.clearInterval(id);
  }, [setPhaseBoth]);


  // ---- Save progress every 30 s, and when the page is closed ----
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!done.current) void sendProgress(plan.sessionId, Math.floor(activeMs.current / 1000), false);
    }, HEARTBEAT_MS);
    const onHide = () => {
      if (!done.current && document.visibilityState === "hidden") {
        sendProgress(plan.sessionId, Math.floor(activeMs.current / 1000), false, true);
      }
    };
    const onPageHide = () => {
      if (!done.current) sendProgress(plan.sessionId, Math.floor(activeMs.current / 1000), false, true);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (done.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [plan.sessionId]);

  /** completed = the student went through every step (a mock only counts then). */
  const finish = useCallback(async (completed: boolean) => {
    if (done.current) return;
    done.current = true;
    setFinishing(true);
    stopSpeaking();
    token.current++;
    const activeSeconds = Math.floor(activeMs.current / 1000);
    const [savedSeconds, blob] = await Promise.all([
      sendProgress(plan.sessionId, activeSeconds, true, false, completed),
      recorder.current ? recorder.current.stop() : Promise.resolve(null),
    ]);
    onFinished({ completed, activeSeconds, savedSeconds, recording: blob, mimeType: recorder.current?.mimeType || blob?.type || "" });
  }, [plan.sessionId, onFinished]);

  const next = useCallback(() => {
    if (isLast) {
      void finish(true);
      return;
    }
    const i = index + 1;
    stepRef.current = plan.steps[i];
    setIndex(i);
    present(plan.steps[i]);
  }, [isLast, finish, index, plan.steps, present]);

  // Mock tests move on by themselves when the time is up.
  useEffect(() => {
    if (plan.autoAdvance && phase === "timeUp") {
      const id = window.setTimeout(next, 1200);
      return () => window.clearTimeout(id);
    }
  }, [plan.autoAdvance, phase, next]);

  const limit = phaseLimit(phase, step);
  const remaining = Math.max(0, limit - phaseElapsed);
  const progress = plan.unlimited ? 100 : ((index + (phase === "timeUp" ? 1 : 0)) / plan.steps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
      {/* Top bar: progress, recording dot, end */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
          <Badge variant="outline" className="shrink-0 whitespace-nowrap">{t("part", { part: step.part })}</Badge>
          <span className="min-w-0 truncate text-sm font-semibold text-muted-foreground tabular-nums">
            {plan.unlimited ? t("questionN", { n: index + 1 }) : t("question", { n: index + 1, total: plan.steps.length })}
          </span>
          <span className="flex-1" />
          {isRecording && !finishing && (
            <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-destructive" title={t("recording")}>
              <span className="size-3 animate-pulse rounded-full bg-destructive" aria-hidden />
              {/* Small phones: the mic icon says "recording" without the word, so the end button always fits. */}
              <Mic className="size-4 sm:hidden" aria-hidden />
              <span className="sr-only sm:not-sr-only">{t("recording")}</span>
            </span>
          )}
          <Button type="button" variant="ghost" size="icon" onClick={() => {
              // A mock left halfway does not count, so make sure it was not a stray tap.
              if (plan.mode === "mock" && !window.confirm(t("quitMockConfirm"))) return;
              void finish(false);
            }}
            disabled={finishing} aria-label={t("quit")} title={t("quit")} className="shrink-0">
            <X aria-hidden />
          </Button>
        </div>
        <div className="h-1 w-full bg-border" aria-hidden>
          <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-4 py-8 text-center">
        {step.kind === "question" ? (
          <>
            <p className="text-sm font-semibold text-muted-foreground">{step.topic}</p>
            <h1 lang="en" className="max-w-2xl text-2xl leading-snug sm:text-3xl">
              {step.text}
            </h1>
          </>
        ) : (
          <div lang="en" className="w-full max-w-xl rounded-card border border-border bg-card p-6 text-left shadow-sm">
            <p className="text-xl font-semibold text-primary sm:text-2xl">{step.title}</p>
            <p className="mt-4 font-semibold">{t("youShouldSay")}</p>
            <ul className="mt-1 list-disc pl-6">
              {step.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {step.explain && <p className="mt-1">{step.explain}</p>}
          </div>
        )}

        <div className="flex flex-col items-center gap-3" aria-live="polite">
          {phase === "listening" ? (
            <p className="flex items-center gap-2 text-lg font-semibold text-primary">
              <Volume2 className="size-6 animate-pulse" aria-hidden />
              {t("listening")}
            </p>
          ) : phase === "timeUp" ? (
            <p className="flex items-center gap-2 text-lg font-semibold text-primary">
              <Flag className="size-5" aria-hidden />
              {t("timeUp")}
            </p>
          ) : (
            <>
              <TimerRing
                remaining={remaining}
                total={limit}
                label={phase === "prep" ? t("prepare") : phase === "speak" ? t("speak") : t("answer")}
              />
              {phase === "prep" && <p className="max-w-sm text-sm text-muted-foreground">{t("prepHelp")}</p>}
            </>
          )}
          {hidden && <p className="text-sm text-warning">{t("paused")}</p>}
        </div>

        {step.kind === "cue-card" && phase === "prep" && (
          <div className="flex w-full max-w-xl flex-col gap-2 text-left">
            <label htmlFor="cue-notes" className="text-sm font-semibold">
              {t("notes")}
            </label>
            <Textarea id="cue-notes" rows={4} />
          </div>
        )}
      </main>

      {/* Bottom actions: one main button */}
      <div className="sticky bottom-0 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-3 px-4 py-3">
          {plan.allowReplay && step.kind === "question" && (
            <Button type="button" variant="secondary" onClick={() => present(step)} disabled={phase === "listening" || finishing}>
              <RotateCcw aria-hidden />
              {t("replay")}
            </Button>
          )}
          {plan.unlimited && !isLast && (
            <Button type="button" variant="secondary" onClick={() => void finish(true)} disabled={finishing}>
              <Flag aria-hidden />
              {t("finish")}
            </Button>
          )}
          {step.kind === "cue-card" && phase === "prep" ? (
            <Button type="button" size="lg" onClick={() => setPhaseBoth("speak")}>
              {t("startSpeaking")}
            </Button>
          ) : (
            !plan.autoAdvance && (
              <Button type="button" size="lg" onClick={next} disabled={finishing || phase === "listening"}>
                {isLast ? t("finish") : t("nextQuestion")}
                {!isLast && <ChevronRight aria-hidden />}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
