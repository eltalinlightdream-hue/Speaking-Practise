"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useOffline } from "next/offline";
import { useTranslations } from "next-intl";
import { RefreshCw, WifiOff } from "lucide-react";
import { flushQueue, onPendingChange, pendingSessions, setCurrentUser } from "@/lib/practice/offline-queue";

const WARM_KEY = "se-warm-at";
const WARM_EVERY_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 60_000;

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Ask the service worker to save the main pages, at most every 6 hours. */
async function warmPages(force = false) {
  if (!("serviceWorker" in navigator) || !navigator.onLine) return;
  try {
    const last = Number(window.localStorage.getItem(WARM_KEY) ?? 0);
    if (!force && Date.now() - last < WARM_EVERY_MS) return;
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "warm" });
    window.localStorage.setItem(WARM_KEY, String(Date.now()));
  } catch {
    // Not important: the pages are also saved as the student opens them.
  }
}

/**
 * Everything the app needs to work without internet, in one place:
 * - registers the service worker (production only),
 * - sends practice time that was kept on the phone, as soon as possible,
 * - refreshes the page data when the internet comes back,
 * - shows a banner while offline.
 */
export function Connectivity({ userId }: { userId: string }) {
  const t = useTranslations("offline");
  const router = useRouter();
  const nextOffline = useOffline();
  const browserOnline = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const offline = nextOffline || !browserOnline;
  const waiting = useSyncExternalStore(onPendingChange, () => pendingSessions().length, () => 0);
  const [syncing, setSyncing] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    setCurrentUser(userId);
  }, [userId]);

  // Service worker.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        // First install: save the main pages straight away.
        void warmPages(!reg.active);
      })
      .catch(() => {});
  }, []);

  // Send kept practice time now, when the internet comes back, and every minute while some waits.
  useEffect(() => {
    let stopped = false;
    async function sync() {
      if (!navigator.onLine || pendingSessions().length === 0) return;
      setSyncing(true);
      const r = await flushQueue();
      if (stopped) return;
      setSyncing(false);
      // New minutes on the server: show them.
      if (r.sent > 0) router.refresh();
    }
    void sync();
    const id = window.setInterval(sync, RETRY_MS);
    window.addEventListener("online", sync);
    return () => {
      stopped = true;
      window.clearInterval(id);
      window.removeEventListener("online", sync);
    };
  }, [router]);

  // Back online after a break: fresh data for the page that is open.
  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      router.refresh();
      void warmPages();
    }
  }, [offline, router]);

  if (offline) {
    return (
      <div role="status" className="border-b border-border bg-surface text-surface-foreground">
        <p className="mx-auto flex w-full max-w-5xl items-start gap-2 px-4 py-2 text-sm font-semibold sm:px-6">
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("banner")}
        </p>
      </div>
    );
  }
  if (waiting > 0) {
    return (
      <div role="status" className="border-b border-border bg-muted">
        <p className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-2 text-sm sm:px-6">
          <RefreshCw className={syncing ? "size-4 shrink-0 animate-spin motion-reduce:animate-none" : "size-4 shrink-0"} aria-hidden />
          {t("waiting", { n: waiting })}
        </p>
      </div>
    );
  }
  return null;
}
