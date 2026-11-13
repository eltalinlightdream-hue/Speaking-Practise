"use client";

import type { RecordingType } from "./types";

// Formats in order of preference. Chrome/Android record WebM; iPhone/Safari
// records MP4, so it must come second in the list.
const AUDIO_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/ogg;codecs=opus"];
const VIDEO_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"];

export function recordingSupported() {
  return typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function pickMimeType(type: RecordingType): string | undefined {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return undefined;
  const list = type === "video" ? VIDEO_TYPES : AUDIO_TYPES;
  return list.find((m) => MediaRecorder.isTypeSupported?.(m));
}

export function extensionFor(mimeType: string) {
  if (mimeType.includes("mp4")) return mimeType.startsWith("video") ? "mp4" : "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export type MediaErrorKind = "denied" | "notFound" | "unsupported" | "other";

export function classifyMediaError(e: unknown): { kind: MediaErrorKind; message: string } {
  const name = (e as { name?: string })?.name ?? "";
  const message = (e as { message?: string })?.message ?? String(e);
  if (name === "NotAllowedError" || name === "SecurityError") return { kind: "denied", message };
  if (name === "NotFoundError" || name === "OverconstrainedError") return { kind: "notFound", message };
  if (name === "NotSupportedError" || name === "TypeError") return { kind: "unsupported", message };
  return { kind: "other", message };
}

/** Ask for the microphone (and camera). The browser shows its permission prompt. */
export async function getMediaStream(type: RecordingType): Promise<MediaStream> {
  if (!recordingSupported()) throw Object.assign(new Error("MediaRecorder not supported"), { name: "NotSupportedError" });
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: type === "video" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
  });
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Records one whole session into a single file. */
export class SessionRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  readonly mimeType: string;

  constructor(private stream: MediaStream, type: RecordingType) {
    this.mimeType = pickMimeType(type) ?? "";
  }

  start() {
    this.chunks = [];
    this.recorder = this.mimeType ? new MediaRecorder(this.stream, { mimeType: this.mimeType }) : new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    // Collect data every second so a stop never loses more than a moment.
    this.recorder.start(1000);
  }

  get recording() {
    return this.recorder?.state === "recording";
  }

  /** Stop and return the finished file (null if nothing was recorded). */
  stop(): Promise<Blob | null> {
    const rec = this.recorder;
    if (!rec || rec.state === "inactive") return Promise.resolve(this.chunks.length ? this.toBlob() : null);
    return new Promise((resolve) => {
      rec.onstop = () => resolve(this.chunks.length ? this.toBlob() : null);
      try {
        rec.stop();
      } catch {
        resolve(this.chunks.length ? this.toBlob() : null);
      }
    });
  }

  private toBlob() {
    return new Blob(this.chunks, { type: this.recorder?.mimeType || this.mimeType || "audio/webm" });
  }
}
