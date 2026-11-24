"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Captions, CaptionsOff, Check, ChevronRight, Clock, Flag, Mic, RotateCcw, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { TimerRing } from "@/components/timer-ring";
import { CueCardView } from "@/components/practice/cue-card-view";
import { ExamPictures } from "@/components/practice/exam-pictures";
import { ExaminerCaptions } from "@/components/practice/examiner-captions";
import { partConfig, partLabel } from "@/config/exams";
import { playLines, preloadClips, speak, splitSentences, stopSpeaking } from "@/lib/speech";
import { SessionRecorder } from "@/lib/practice/recorder";
import type { SessionPlan, SpokenLine, Step } from "@/lib/practice/types";
import { dropPending, flushQueue, pendingSessions, queueProgress } from "@/lib/practice/offline-queue";

export type SessionOutcome = {
  /** True only when the student reached the end (not "End session" halfway). */
  completed: boolean;
  activeSeconds: number;
  savedSeconds: number | null;
  /** Not saved yet, but kept on this phone and sent when the internet is back. */
  queued: boolean;
  recording: Blob | null;
  mimeType: string;
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

/** What is read aloud for a card: its title, or (CEFR Part 2) the card's questions. */
function cardSpeech(s: Extract<Step, { kind: "cue-card" }>) {
  return s.style === "questions" && s.bullets.length ? s.bullets.join(" ") : s.title;
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
 * Save practice time. Offline sessions, failed saves and saves made while the
 * phone has no internet go into the offline queue, which is sent later.
 * Resolves with the seconds the server saved, or null if not saved yet.
 */
async function sendProgress(plan: SessionPlan, seconds: number, finished: boolean, beacon = false, completed = false): Promise<number | null> {
  const entry = { id: plan.sessionId, start: plan.pendingStart, seconds, finished, completed };
  if (plan.pendingStart) {
    queueProgress(entry);
    if (beacon || !navigator.onLine) return null;
    const r = await flushQueue();
    return r.saved[plan.sessionId] ?? null;
  }
  const body = JSON.stringify({ sessionId: plan.sessionId, seconds, finished, completed });
  if (beacon && typeof navigator.sendBeacon === "function") {
    if (!navigator.onLine || !navigator.sendBeacon("/api/practice/progress", new Blob([body], { type: "text/plain" }))) queueProgress(entry);
    return null;
  }
  try {
    const r = await fetch("/api/practice/progress", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
    if (r.ok) {
      const j = (await r.json()) as { savedSeconds?: number };
      if (typeof j.savedSeconds === "number") {
        dropPending(plan.sessionId);
        return j.savedSeconds;
      }
      return null;
    }
    // Server trouble or an expired login: keep it and try again later.
    if (r.status >= 500 || r.status === 401) queueProgress(entry);
    return null;
  } catch {
    queueProgress(entry);
    return null;
  }
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
  const tx = useTranslations("practice.examiner");
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("listening");
  const [phaseElapsed, setPhaseElapsed] = useState(0); // seconds in the current timed phase
  const [activeSeconds, setActiveSeconds] = useState(0); // practice time shown to the student (same clock that is saved)
  const [hidden, setHidden] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [captions, setCaptions] = useState<string[]>([]);
  const [cardHidden, setCardHidden] = useState(false);
  const [showText, setShowText] = useState(readShowText);

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
  const indexRef = useRef(0);
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

  // ---- Present a step: examiner lines, a question, or a card; then start its timer ----
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
        // IELTS mock: the card is handed over silently, as in the real test.
        setPhaseBoth("prep");
      } else {
        void say([{ text: cardSpeech(s) }]).then((still) => still && setPhaseBoth("prep"));
      }
    },
    [say, setPhaseBoth],
  );

  // Load every picture and examiner clip of the session now, so each one is ready when its turn comes.
  useEffect(() => {
    const urls = new Set(plan.steps.flatMap((s) => (s.kind === "examiner" ? [] : (s.images?.map((i) => i.url) ?? []))));
    for (const url of urls) new window.Image().src = url;
    preloadClips(clipsInPlan(plan.steps));
  }, [plan.steps]);

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
        setActiveSeconds(Math.floor(activeMs.current / 1000));
        if (["answering", "prep", "speak"].includes(phaseRef.current)) {
          phaseMs.current += dt;
          const elapsed = Math.floor(phaseMs.current / 1000);
          setPhaseElapsed(elapsed);
          // Timer ran out: move from preparing to speaking, or show "time is up".
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
      if (!done.current) void sendProgress(plan, Math.floor(activeMs.current / 1000), false);
    }, HEARTBEAT_MS);
    // An offline session is written down at once, so even a closed tab keeps it.
    if (plan.pendingStart) queueProgress({ id: plan.sessionId, start: plan.pendingStart, seconds: 0, finished: false, completed: false });
    const onHide = () => {
      if (!done.current && document.visibilityState === "hidden") {
        void sendProgress(plan, Math.floor(activeMs.current / 1000), false, true);
      }
    };
    const onPageHide = () => {
      if (!done.current) void sendProgress(plan, Math.floor(activeMs.current / 1000), false, true);
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
  }, [plan]);

  /** completed = the student went through every step (a mock only counts then). */
  const finish = useCallback(async (completed: boolean) => {
    if (done.current) return;
    done.current = true;
    setFinishing(true);
    stopSpeaking();
    token.current++;
    const activeSeconds = Math.floor(activeMs.current / 1000);
    const [savedSeconds, blob] = await Promise.all([
      sendProgress(plan, activeSeconds, true, false, completed),
      recorder.current ? recorder.current.stop() : Promise.resolve(null),
    ]);
    const queued = savedSeconds === null && pendingSessions().some((e) => e.id === plan.sessionId);
    onFinished({ completed, activeSeconds, savedSeconds, queued, recording: blob, mimeType: recorder.current?.mimeType || blob?.type || "" });
  }, [plan, onFinished]);

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

  /** Card: preparation is over (timer or "Start speaking" tap). */
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

  /** Card: speaking time is over. IELTS mock: "Thank you", then the booklet is taken back. */
  const speakDone = useCallback(() => {
    const s = stepRef.current;
    if (s.kind !== "cue-card" || phaseRef.current !== "speak") return;
    if (s.endLines?.length) {
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

  // Mock tests move on by themselves when the time is up.
  useEffect(() => {
    if (plan.autoAdvance && phase === "timeUp") {
      const id = window.setTimeout(next, 1200);
      return () => window.clearTimeout(id);
    }
  }, [plan.autoAdvance, phase, next]);

  const hideTopic = partConfig(plan.exam, step.part)?.hideTopic;
  const limit = phaseLimit(phase, step);
  const remaining = Math.max(0, limit - phaseElapsed);
  // IELTS mock tests (with the recorded examiner) show the examiner's words as captions.
  const captionsMode = plan.steps.some((s) => s.kind === "examiner");
  const speaking = phase === "listening";
  const answerTotal = plan.steps.filter((s) => s.kind !== "examiner").length;
  const answerNumber = plan.steps.slice(0, index + 1).filter((s) => s.kind !== "examiner").length;
  const progress = plan.unlimited ? 100 : ((index + (phase === "timeUp" ? 1 : 0)) / plan.steps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
      {/* Top bar: progress, recording dot, end */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
          <Badge variant="outline" className="shrink-0 whitespace-nowrap">{t("part", { part: partLabel(plan.exam, step.part) })}</Badge>
          <span className="min-w-0 truncate text-sm font-semibold text-muted-foreground tabular-nums">
            {step.kind === "examiner"
              ? tx("label")
              : plan.unlimited
                ? t("questionN", { n: index + 1 })
                : t("question", { n: answerNumber, total: answerTotal })}
          </span>
          <span className="flex-1" />
          {/* Cards and pictures can push the big timer off a phone screen: keep the time visible up here. */}
          {(step.kind === "cue-card" || (step.kind === "question" && !!step.images?.length)) && limit > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary tabular-nums" aria-hidden>
              <Clock className="size-4" />
              {formatClock(remaining)}
            </span>
          )}
          {isRecording && !finishing && (
            <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-destructive" title={t("recording")}>
              <span className="size-3 animate-pulse rounded-full bg-destructive" aria-hidden />
              {/* Small phones: the mic icon says "recording" without the word, so the end button always fits. */}
              <Mic className="size-4 sm:hidden" aria-hidden />
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
              className="shrink-0"
            >
              {showText ? <Captions aria-hidden /> : <CaptionsOff aria-hidden />}
            </Button>
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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-5 px-4 py-5 text-center sm:gap-8 sm:py-8">
        {/* How long this session has counted so far (pauses while the page is hidden, like the saved time). */}
        <p
          role="timer"
          aria-label={`${t("practiceTime")}: ${formatClock(activeSeconds)}`}
          className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground"
        >
          <Clock className="size-4 shrink-0" aria-hidden />
          {t("practiceTime")}
          <span className="text-foreground tabular-nums">{formatClock(activeSeconds)}</span>
        </p>
        {step.kind === "examiner" ? (
          <ExaminerCaptions lines={captions} speaking={speaking} showText={showText} hint={step.hint} />
        ) : step.kind === "question" ? (
          <>
            {!hideTopic && step.topic && <p className="text-sm font-semibold text-muted-foreground">{step.topic}</p>}
            {step.images && <ExamPictures pictures={step.images} className="max-w-2xl" />}
            {captionsMode ? (
              <ExaminerCaptions lines={captions} speaking={speaking} showText={showText} />
            ) : (
              <h1 lang="en" className="max-w-2xl text-2xl leading-snug sm:text-3xl">
                {step.text}
              </h1>
            )}
          </>
        ) : (
          <>
            {captionsMode && captions.length > 0 && <ExaminerCaptions lines={captions} speaking={speaking} showText={showText} />}
            {!cardHidden && <CueCardView card={step} />}
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
              {phase === "prep" && (
                <p className="max-w-sm text-sm text-muted-foreground">
                  {t("prepHelp")}
                  {step.kind === "cue-card" && step.style === "debate" && <> {t("debateHelp")}</>}
                </p>
              )}
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
            <Button type="button" size="lg" onClick={() => prepDone(false)}>
              {t("startSpeaking")}
            </Button>
          ) : plan.autoAdvance ? (
            // Mock tests: the student can move on once they have finished answering
            // (time limits are long), or end the Part 2 long turn early.
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

/** 75 -> "1:15", 3725 -> "1:02:05". */
function formatClock(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
