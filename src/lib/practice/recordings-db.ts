"use client";

// Recordings live ONLY in the browser (IndexedDB). Nothing is uploaded.
// We keep the newest 10 recordings and at most ~300 MB; older ones are deleted.

import type { ExamCode } from "@/config/exams";
import type { RecordingType } from "./types";

export type StoredRecording = {
  id: string;
  createdAt: number;
  exam: ExamCode;
  mode: "general" | "mock";
  label: string;
  type: Exclude<RecordingType, "none">;
  mimeType: string;
  size: number;
  durationSeconds: number;
  blob: Blob;
};

export type RecordingMeta = Omit<StoredRecording, "blob">;

const DB_NAME = "speaking-easy";
const STORE = "recordings";
export const MAX_RECORDINGS = 10;
export const MAX_TOTAL_BYTES = 300 * 1024 * 1024;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is not available"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(req ? (req as IDBRequest<T>).result : undefined);
        };
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
      }),
  );
}

export async function listRecordings(): Promise<StoredRecording[]> {
  const all = (await tx<StoredRecording[]>("readonly", (s) => s.getAll())) ?? [];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getRecording(id: string) {
  return tx<StoredRecording>("readonly", (s) => s.get(id));
}

export async function deleteRecording(id: string) {
  await tx("readwrite", (s) => s.delete(id));
}

/** Which recordings to delete so the newest `keep` fit the limits (pure, testable). */
export function recordingsToPrune(items: { id: string; createdAt: number; size: number }[], maxCount = MAX_RECORDINGS, maxBytes = MAX_TOTAL_BYTES) {
  const newestFirst = [...items].sort((a, b) => b.createdAt - a.createdAt);
  const remove: string[] = [];
  let total = 0;
  newestFirst.forEach((r, i) => {
    total += r.size;
    // Always keep the newest one, even if it alone is over the size limit.
    if (i > 0 && (i >= maxCount || total > maxBytes)) remove.push(r.id);
  });
  return remove;
}

export async function saveRecording(rec: Omit<StoredRecording, "id" | "createdAt" | "size">): Promise<StoredRecording> {
  const full: StoredRecording = {
    ...rec,
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
    createdAt: Date.now(),
    size: rec.blob.size,
  };
  // Ask the browser not to clear our storage when space is low (best effort).
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
  await tx("readwrite", (s) => s.put(full));
  const all = await listRecordings();
  for (const id of recordingsToPrune(all)) await deleteRecording(id);
  return full;
}

export function recordingFileName(r: Pick<StoredRecording, "createdAt" | "exam" | "mimeType">, ext: string) {
  const d = new Date(r.createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  return `speaking-easy_${r.exam}_${stamp}.${ext}`;
}
