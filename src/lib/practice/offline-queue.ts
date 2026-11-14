"use client";

// Practice time that still has to reach the server.
//
// Kept in localStorage, so it survives a closed tab, a locked phone or a day
// without internet. flushQueue() sends everything to /api/practice/sync; the
// server functions are safe to call twice, so sending again never double counts.

import type { PendingStart } from "./types";

export type { PendingStart };

export type PendingSession = {
  id: string;
  start?: PendingStart;
  seconds: number;
  finished: boolean;
  completed: boolean;
  /** Changes every time the entry changes (to spot updates during a send). */
  rev: number;
  /** Who practised. Only that user's entries are sent (a phone can be shared). */
  user?: string;
};

const KEY = "se-pending-sessions-v1";
const USER_KEY = "se-current-user";

/** Remember who is signed in on this phone (set by the app layout). */
export function setCurrentUser(id: string) {
  try {
    window.localStorage.setItem(USER_KEY, id);
  } catch {
    // Storage blocked: entries just stay without an owner.
  }
}

function currentUser() {
  try {
    return window.localStorage.getItem(USER_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
const EVENT = "se-pending-change";

function read(): PendingSession[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as PendingSession[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: PendingSession[]) {
  try {
    if (list.length) window.localStorage.setItem(KEY, JSON.stringify(list));
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage full or blocked: nothing else we can do on this device.
  }
}

/** This user's sessions that still wait to be sent. */
export function pendingSessions() {
  const user = currentUser();
  return read().filter((e) => !e.user || !user || e.user === user);
}

export function onPendingChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Add or update a session. Time never goes down and "finished" never goes back. */
export function queueProgress(entry: { id: string; start?: PendingStart; seconds: number; finished: boolean; completed: boolean }) {
  const list = read();
  const old = list.find((e) => e.id === entry.id);
  const next: PendingSession = {
    id: entry.id,
    start: old?.start ?? entry.start,
    seconds: Math.max(old?.seconds ?? 0, entry.seconds),
    finished: (old?.finished ?? false) || entry.finished,
    completed: (old?.completed ?? false) || (entry.finished && entry.completed),
    rev: (old?.rev ?? 0) + 1,
    user: old?.user ?? currentUser(),
  };
  write([...list.filter((e) => e.id !== entry.id), next]);
}

export function dropPending(id: string) {
  write(read().filter((e) => e.id !== id));
}

let flushing: Promise<FlushResult> | null = null;
export type FlushResult = { sent: number; saved: Record<string, number>; offline: boolean };

/** Send everything waiting. Resolves with what the server saved. Never throws. */
export function flushQueue(): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async (): Promise<FlushResult> => {
    const items = pendingSessions();
    if (items.length === 0) return { sent: 0, saved: {}, offline: false };
    try {
      const res = await fetch("/api/practice/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.slice(0, 50) }),
      });
      if (!res.ok) return { sent: 0, saved: {}, offline: false };
      const body = (await res.json()) as { saved: Record<string, number>; drop: string[] };
      const done = new Set([...Object.keys(body.saved ?? {}), ...(body.drop ?? [])]);
      const sentRev = new Map(items.map((e) => [e.id, e.rev]));
      // Entries that changed while we were sending stay, but the server knows them now.
      write(
        read()
          .filter((e) => !done.has(e.id) || e.rev !== sentRev.get(e.id))
          .map((e) => (done.has(e.id) ? { ...e, start: undefined } : e)),
      );
      return { sent: done.size, saved: body.saved ?? {}, offline: false };
    } catch {
      return { sent: 0, saved: {}, offline: true };
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
