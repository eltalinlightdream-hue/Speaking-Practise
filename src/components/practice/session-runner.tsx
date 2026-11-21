"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Captions, CaptionsOff, Check, ChevronRight, Flag, RotateCcw, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { TimerRing } from "@/components/timer-ring";
import { ExaminerCaptions } from "@/components/practice/examiner-captions";
import { playLines, preloadClips, speak, splitSentences, stopSpeaking } from "@/lib/speech";
import { SessionRecorder } from "@/lib/practice/recorder";
import type { SessionPlan, SpokenLine, Step } from "@/lib/practice/types";

export type SessionOutcome = {
  activeSeconds: number;
  savedSeconds: number | null;
  recording: Blob | null;
  mimeType: string;
  /** False when the student ended the session early with the X button (mock tests). */
  completed: boolean;
};

/**
 * listening: the examiner (or browser voice) is speaking, not timed
 * pause:     a short silent wait after examiner lines (e.g. the ID check)
 * answering / prep / speak: timed phases
 */
type Phase = "listening" | "pause" | "answering" | "prep" | "speak" | "timeUp";

const HEARTBEAT_MS = 30_000;
const SHOW_TEXT_KEY = "se.showExaminerText";

/** Seconds allowed in a timed phase (0 = not timed). */
function phaseLimit(p: Phase, s: Step) {
  if (s.kind === "question") return p === "answering" ? s.seconds : 0;
  if (s.kind === "cue-card") return p === "prep" ? s.prepSeconds : p === "speak" ? s.speakSeconds : 0;
  return 0;
}

function sendProgress(sessionId: string, seconds: number, finished: boolean, beacon = false) {
  const body = JSON.stringify({ sessionId, seconds, finished });
  if (beacon && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon("/api/practice/progress", new Blob([body], { type: "text/plain" }));
    return Promise.resolve(null);
  }
  return fetch("/api/practice/progress", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { savedSeconds?: number } | null) => (typeof j?.savedSeconds === "number" ? j.savedSeconds : null))
    .catch(() => null);
}

/** Recorded clips a plan uses, in the order they are needed. */
function clipsInPlan(steps: Step[]) {
  const urls: (string | null | undefined)[] = [];
  for (const s of steps) {
    if (s.kind === "examiner") urls.push(...s.lines.map((l) => l.clip));
    else if (s.kind === "question") urls.push(s.audioUrl);
    else urls.push(...(s.startLines ?? []).map((l) => l.clip), ...(s.endLines ?? []).map((l) => l.clip));
  }
  return urls;
}

function readShowText() {
  try {
    return window.localStorage.getItem(SHOW_TEXT_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * Runs one practice session: the examiner's lines, questions read aloud,
 * timers, recording, and saving practice time. Shared by General Training and
 * Mock Tests (plan.captions shows the examiner's words as they are spoken).
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
  const tx = useTranslations("practice.examiner");
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("listening");
  const [phaseElapsed, setPhaseElapsed] = useState(0); // seconds in the current timed phase
  const [hidden, setHidden] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [captions, setCaptions] = useState<string[]>([]);
  const [cardHidden, setCardHidden] = useState(false);
  const [showText, setShowText] = useState(readShowText);

  const step: Step = plan.steps[index];

  const activeMs = useRef(0);
  const phaseMs = useRef(0);
  const lastTick = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("listening");
  const token = useRef(0); // increases on every step change, so late speech callbacks are ignored
  const recorder = useRef<SessionRecorder | null>(null);
  const done = useRef(false);
  const indexRef = useRef(0);
  const stepRef = useRef<Step>(plan.steps[0]);
  // Latest versions of callbacks used from timers and speech promises.
  const nextRef = useRef<() => void>(() => {});
  const prepDoneRef = useRef<(fromTimer: boolean) => void>(() => {});
  const speakDoneRef = useRef<() => void>(() => {});

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    phaseMs.current = 0;
    setPhaseElapsed(0);
    setPhase(p);
  }, []);

  /** Speak lines for the current step and add each sentence to the captions as it starts. */
  const say = useCallback((lines: SpokenLine[], onSentence?: (s: string) => void) => {
    const my = token.current;
    const active = () => token.current === my;
    return playLines(
      lines,
      (s) => {
        if (!active()) return;
        setCaptions((c) => [...c, s]);
        onSentence?.(s);
      },
      active,
    ).then(active);
  }, []);

  // ---- Start recording once, when the session begins; download examiner clips ----
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

  useEffect(() => {
    preloadClips(clipsInPlan(plan.steps));
  }, [plan.steps]);

  // ---- Present a step: examiner lines, a question, or a cue card ----
  const present = useCallback(
    (s: Step) => {
      ++token.current;
      setCaptions([]);
      setCardHidden(false);
      setPhaseBoth("listening");
      if (s.kind === "examiner") {
        void say(s.lines).then((still) => {
          if (!still) return;
          const my = token.current;
          const goOn = () => {
            if (token.current === my) nextRef.current();
          };
          if (s.waitSeconds) {
            setPhaseBoth("pause");
            window.setTimeout(goOn, s.waitSeconds * 1000);
          } else {
            window.setTimeout(goOn, 400);
          }
        });
      } else if (s.kind === "question") {
        void say([{ text: s.text, clip: s.audioUrl }]).then((still) => still && setPhaseBoth("answering"));
      } else if (s.startLines) {
        // Mock test: the card is handed over silently, as in the real test.
        setPhaseBoth("prep");
      } else {
        void say([{ text: s.title }]).then((still) => still && setPhaseBoth("prep"));
      }
    },
    [say, setPhaseBoth],
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
          const limit = phaseLimit(phaseRef.current, stepRef.current);
          if (limit && elapsed >= limit) {
            if (phaseRef.current === "prep") prepDoneRef.current(true);
            else if (phaseRef.current === "speak") speakDoneRef.current();
            else setPhaseBoth("timeUp");
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

  /** completed=false when a mock test is ended early, so it does not count as done. */
  const finish = useCallback(
    async (completed = true) => {
      if (done.current) return;
      done.current = true;
      setFinishing(true);
      stopSpeaking();
      token.current++;
      const activeSeconds = Math.floor(activeMs.current / 1000);
      const [savedSeconds, blob] = await Promise.all([
        sendProgress(plan.sessionId, activeSeconds, completed),
        recorder.current ? recorder.current.stop() : Promise.resolve(null),
      ]);
      onFinished({ activeSeconds, savedSeconds, recording: blob, mimeType: recorder.current?.mimeType || blob?.type || "", completed });
    },
    [plan.sessionId, onFinished],
  );

  const next = useCallback(() => {
    const i = indexRef.current + 1;
    if (i >= plan.steps.length) {
      void finish(true);
      return;
    }
    indexRef.current = i;
    stepRef.current = plan.steps[i];
    setIndex(i);
    present(plan.steps[i]);
  }, [finish, plan.steps, present]);

  /** Cue card: preparation is over (timer or "Start speaking" tap). */
  const prepDone = useCallback(
    (fromTimer: boolean) => {
      const s = stepRef.current;
      if (s.kind !== "cue-card" || phaseRef.current !== "prep") return;
      if (s.startLines?.length) {
        setCaptions([]);
        setPhaseBoth("listening");
        void say(s.startLines).then((still) => still && setPhaseBoth("speak"));
      } else {
        setPhaseBoth("speak");
        if (fromTimer) void speak("Please start speaking now.");
      }
    },
    [say, setPhaseBoth],
  );

  /** Cue card: speaking time is over (timer or "I have finished" tap). */
  const speakDone = useCallback(() => {
    const s = stepRef.current;
    if (s.kind !== "cue-card" || phaseRef.current !== "speak") return;
    if (s.endLines?.length) {
      // The card is "taken back" when the examiner asks for the booklet (last line).
      const handBack = splitSentences(s.endLines[s.endLines.length - 1].text)[0];
      setCaptions([]);
      setPhaseBoth("listening");
      void say(s.endLines, (sentence) => sentence === handBack && setCardHidden(true)).then((still) => {
        if (!still) return;
        setCardHidden(true);
        setPhaseBoth("timeUp");
      });
    } else {
      setPhaseBoth("timeUp");
    }
  }, [say, setPhaseBoth]);

  useEffect(() => {
    nextRef.current = next;
    prepDoneRef.current = prepDone;
    speakDoneRef.current = speakDone;
  }, [next, prepDone, speakDone]);

  // Mock tests move on by themselves when the time is up.
  useEffect(() => {
    if (plan.autoAdvance && phase === "timeUp") {
      const id = window.setTimeout(next, 1200);
      return () => window.clearTimeout(id);
    }
  }, [plan.autoAdvance, phase, next]);

  function toggleShowText() {
    setShowText((v) => {
      try {
        window.localStorage.setItem(SHOW_TEXT_KEY, v ? "0" : "1");
      } catch {
        /* private mode: keep it for this session only */
      }
      return !v;
    });
  }

  const limit = phaseLimit(phase, step);
  const remaining = Math.max(0, limit - phaseElapsed);
  const progress = ((index + (phase === "timeUp" ? 1 : 0)) / plan.steps.length) * 100;
  const answerSteps = plan.steps.filter((s) => s.kind !== "examiner").length;
  const answerNumber = plan.steps.slice(0, index + 1).filter((s) => s.kind !== "examiner").length;
  const isLast = index === plan.steps.length - 1;
  const captionsMode = !!plan.captions;
  const speaking = phase === "listening";


  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
      {/* Top bar: progress, recording dot, text toggle, end */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-2">
          <Badge variant="outline" className="shrink-0 whitespace-nowrap">{t("part", { part: step.part })}</Badge>
          <span className="whitespace-nowrap text-sm font-semibold text-muted-foreground tabular-nums">
            {step.kind === "examiner" ? tx("label") : t("question", { n: answerNumber, total: answerSteps })}
          </span>
          <span className="flex-1" />
          {isRecording && !finishing && (
            <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold text-destructive">
              <span className="size-3 animate-pulse rounded-full bg-destructive" aria-hidden />
              <span className="sr-only sm:not-sr-only">{t("recording")}</span>
            </span>
          )}
          {captionsMode && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleShowText}
              aria-pressed={showText}
              aria-label={tx("showText")}
              title={tx("showText")}
            >
              {showText ? <Captions aria-hidden /> : <CaptionsOff aria-hidden />}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void finish(plan.mode !== "mock")}
            disabled={finishing}
            aria-label={t("quit")}
            title={t("quit")}
          >
            <X aria-hidden />
          </Button>
        </div>
        <div className="h-1 w-full bg-border" aria-hidden>
          <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center">
        {step.kind === "examiner" ? (
          <ExaminerCaptions lines={captions} speaking={speaking} showText={showText} hint={step.hint} />
        ) : step.kind === "question" ? (
          captionsMode ? (
            <>
              {step.topic && <p className="text-sm font-semibold text-muted-foreground">{step.topic}</p>}
              <ExaminerCaptions lines={captions} speaking={speaking} showText={showText} />
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-secondary">{step.topic}</p>
              <h1 lang="en" className="max-w-2xl text-2xl leading-snug sm:text-3xl">
                {step.text}
              </h1>
            </>
          )
        ) : (
          <>
            {captionsMode && captions.length > 0 && <ExaminerCaptions lines={captions} speaking={speaking} showText={showText} />}
            {!cardHidden && (
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
          </>
        )}

        <div className="flex flex-col items-center gap-3" aria-live="polite">
          {phase === "listening" ? (
            <p className="flex items-center gap-2 text-lg font-semibold text-primary">
              <Volume2 className="size-6 animate-pulse" aria-hidden />
              {t("listening")}
            </p>
          ) : phase === "pause" ? null : phase === "timeUp" ? (
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
        <div className="mx-auto flex min-h-[68px] w-full max-w-3xl flex-wrap items-center justify-center gap-3 px-4 py-3">
          {plan.allowReplay && step.kind === "question" && (
            <Button type="button" variant="secondary" onClick={() => present(step)} disabled={phase === "listening" || finishing}>
              <RotateCcw aria-hidden />
              {t("replay")}
            </Button>
          )}
          {step.kind === "cue-card" && phase === "prep" ? (
            <Button type="button" size="lg" onClick={() => prepDone(false)}>
              {t("startSpeaking")}
            </Button>
          ) : plan.autoAdvance ? (
            // Mock tests: one button to move on when the student has finished early.
            finishing ? null : phase === "answering" ? (
              <Button type="button" size="lg" onClick={next}>
                {isLast ? t("finish") : t("nextQuestion")}
                {!isLast && <ChevronRight aria-hidden />}
              </Button>
            ) : phase === "speak" ? (
              <Button type="button" size="lg" onClick={speakDone}>
                <Check aria-hidden />
                {t("doneSpeaking")}
              </Button>
            ) : null
          ) : (
            <Button type="button" size="lg" onClick={next} disabled={finishing || phase === "listening"}>
              {isLast ? t("finish") : t("nextQuestion")}
              {!isLast && <ChevronRight aria-hidden />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
