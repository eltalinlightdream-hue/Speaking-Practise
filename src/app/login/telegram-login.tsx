"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TelegramIcon } from "@/components/brand-icons";

type Labels = {
  start: string;
  open: string;
  waiting: string;
  expired: string;
  error: string;
  retry: string;
};

type Phase = "idle" | "creating" | "waiting" | "expired" | "error";

const POLL_MS = 2000;

/**
 * Sign-in through the bot:
 * 1. tap the button -> the server makes a request and we show "Open Telegram",
 * 2. the student presses Start and Confirm in the bot,
 * 3. this page keeps asking the server and goes to the app once confirmed.
 */
export function TelegramLogin({ next, labels }: { next: string; labels: Labels }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [link, setLink] = useState<string | null>(null);
  const busy = useRef(false);

  async function start() {
    setPhase("creating");
    try {
      const res = await fetch("/auth/telegram/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ next }),
      });
      const data = (await res.json()) as { link?: string };
      if (!res.ok || !data.link) throw new Error("start failed");
      setLink(data.link);
      setPhase("waiting");
    } catch {
      setPhase("error");
    }
  }

  const poll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch("/auth/telegram/poll", { method: "POST", cache: "no-store" });
      const data = (await res.json()) as { status: string; next?: string };
      if (data.status === "ok") window.location.assign(data.next ?? "/home");
      else if (data.status === "expired") setPhase("expired");
      else if (data.status === "error") setPhase("error");
    } catch {
      // Network hiccup: try again on the next tick.
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = window.setInterval(poll, POLL_MS);
    // Phones pause timers while Telegram is open: check at once on return.
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [phase, poll]);

  if (phase === "waiting" && link) {
    return (
      <div className="flex flex-col gap-3">
        <Button asChild variant="outline" size="lg" className="w-full whitespace-normal px-4 text-center text-base sm:text-lg">
          <a href={link} target="_blank" rel="noopener noreferrer">
            <TelegramIcon />
            {labels.open}
          </a>
        </Button>
        <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
          {labels.waiting}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {(phase === "expired" || phase === "error") && (
        <p role="alert" className="text-sm text-destructive">
          {phase === "expired" ? labels.expired : labels.error}
        </p>
      )}
      <Button variant="outline" size="lg" className="w-full whitespace-normal px-4 text-center text-base sm:text-lg" onClick={start} disabled={phase === "creating"}>
        {phase === "creating" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <TelegramIcon />}
        {phase === "expired" || phase === "error" ? labels.retry : labels.start}
      </Button>
    </div>
  );
}
