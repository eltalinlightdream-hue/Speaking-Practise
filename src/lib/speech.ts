"use client";

// Everything the app says out loud:
// - recorded clips (examiner lines in mock tests, uploaded question audio), and
// - the browser's own English voice when there is no clip (or it cannot play).
// Lines are played sentence by sentence so captions can follow the voice.

import type { SpokenLine } from "@/lib/practice/types";

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const prefer = ["en-gb", "en-us", "en-au", "en"];
  for (const lang of prefer) {
    const local = english.find((v) => v.lang.toLowerCase().startsWith(lang) && v.localService);
    if (local) return local;
    const any = english.find((v) => v.lang.toLowerCase().startsWith(lang));
    if (any) return any;
  }
  return english[0] ?? null;
}

export function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak text in English. Resolves when finished (or immediately if unsupported). */
export function speak(text: string, opts: { rate?: number } = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!speechSupported()) return resolve();
    const synth = window.speechSynthesis;
    synth.cancel();
    if (cachedVoice === undefined || cachedVoice === null) cachedVoice = pickVoice();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = cachedVoice?.lang ?? "en-GB";
    if (cachedVoice) u.voice = cachedVoice;
    u.rate = opts.rate ?? 0.95;
    // Some phones never fire "end"; never wait longer than the text could take.
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, Math.max(4000, text.length * 110));
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
  });
}

/**
 * iPhone/Safari only allows speech that starts from a tap. Call this inside the
 * tap handler (before any await) so later questions can be read aloud.
 */
export function unlockSpeech() {
  if (!speechSupported()) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Recorded clips. One shared <audio> element: iPhone only lets an element play
// later (without a tap) if it was started once inside a tap (unlockAudio).

const SILENT_WAV =
  "data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

let audioEl: HTMLAudioElement | null = null;
const blobUrls = new Map<string, string>(); // clip URL -> downloaded copy
const missing = new Set<string>(); // clips that do not exist (not recorded yet)
const loading = new Map<string, Promise<void>>();
let stopCurrentClip: (() => void) | null = null;

function audio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = "auto";
  }
  return audioEl;
}

/** Call inside the Start tap (before any await), together with unlockSpeech(). */
export function unlockAudio() {
  const a = audio();
  if (!a) return;
  try {
    a.src = SILENT_WAV;
    a.play()?.catch(() => {});
  } catch {
    /* ignore */
  }
}

function loadClip(url: string): Promise<void> {
  if (blobUrls.has(url) || missing.has(url)) return Promise.resolve();
  let p = loading.get(url);
  if (!p) {
    p = fetch(url)
      .then(async (r) => {
        const type = r.headers.get("content-type") ?? "";
        // A missing file (or an HTML error page) means "use the browser voice".
        if (!r.ok || !(type.startsWith("audio/") || type === "application/octet-stream")) {
          missing.add(url);
          return;
        }
        blobUrls.set(url, URL.createObjectURL(await r.blob()));
      })
      .catch(() => {
        /* offline: try the URL directly when it is played */
      })
      .finally(() => loading.delete(url));
    loading.set(url, p);
  }
  return p;
}

/** Download clips in the background, in order, so they start instantly later. */
export function preloadClips(urls: (string | null | undefined)[]) {
  const list = [...new Set(urls.filter((u): u is string => !!u))];
  void (async () => {
    for (const u of list) await loadClip(u);
  })();
}

/**
 * Play one clip. onProgress(0..1) is called while it plays.
 * Resolves true when it played (or was stopped), false when it could not play.
 */
function playClip(url: string, onProgress: (fraction: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const el = audio();
    if (!el || missing.has(url)) return resolve(false);
    const a: HTMLAudioElement = el;
    let started = false;
    let settled = false;
    const progress = () => {
      if (a.duration > 0 && Number.isFinite(a.duration)) onProgress(Math.min(1, a.currentTime / a.duration));
    };
    const onPlaying = () => {
      started = true;
      onProgress(0);
    };
    const onEnded = () => finish(true);
    const onError = () => finish(started);
    const stop = () => {
      a.pause();
      finish(true);
    };
    function finish(ok: boolean) {
      if (settled) return;
      settled = true;
      window.clearTimeout(guard);
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("timeupdate", progress);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
      if (stopCurrentClip === stop) stopCurrentClip = null;
      resolve(ok);
    }
    // Never wait forever (a stalled network, a phone that never fires "ended").
    const guard = window.setTimeout(() => finish(started), 30_000);
    stopCurrentClip?.();
    stopCurrentClip = stop;
    a.addEventListener("playing", onPlaying);
    a.addEventListener("timeupdate", progress);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    a.src = blobUrls.get(url) ?? url;
    a.play()?.catch(() => finish(false));
  });
}

/** Split text into sentences ("Thank you. And what shall I call you?" → 2). */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[.?!]+["')\]]*\s+(?=["'([]?[A-Z0-9])/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    out.push(text.slice(start, end).trim());
    start = end;
  }
  const last = text.slice(start).trim();
  if (last) out.push(last);
  return out;
}

function pause(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

/**
 * Say one line. onSentence(s) is called as each sentence starts, so captions
 * appear together with the voice. With a clip, later sentences appear when the
 * clip reaches them (estimated from their length); with the browser voice each
 * sentence is spoken separately, so they line up exactly.
 */
async function playLine(line: SpokenLine, onSentence: (s: string) => void, isActive: () => boolean) {
  const sentences = splitSentences(line.text);
  let shown = 0;
  if (line.clip) {
    const total = sentences.reduce((n, s) => n + s.length, 0) || 1;
    const starts: number[] = [];
    let acc = 0;
    for (const s of sentences) {
      starts.push(acc / total);
      acc += s.length;
    }
    const reveal = (f: number) => {
      while (shown < sentences.length && f >= starts[shown]) onSentence(sentences[shown++]);
    };
    const played = await playClip(line.clip, reveal);
    if (played) {
      if (isActive()) reveal(1);
      return;
    }
  }
  for (let k = 0; k < sentences.length; k++) {
    if (!isActive()) return;
    if (k >= shown) onSentence(sentences[k]);
    await speak(sentences[k]);
  }
}

/** Say lines one after another. Stops early when isActive() turns false. */
export async function playLines(lines: SpokenLine[], onSentence: (s: string) => void, isActive: () => boolean = () => true) {
  for (let i = 0; i < lines.length; i++) {
    if (!isActive()) return;
    if (i > 0) {
      await pause(250);
      if (!isActive()) return;
    }
    await playLine(lines[i], onSentence, isActive);
  }
}

/** Stop the browser voice and any clip that is playing. */
export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
  stopCurrentClip?.();
}

/** Play an uploaded audio file if there is one, otherwise use the browser voice. */
export function playQuestion(text: string, audioUrl?: string | null) {
  return playLines([{ text, clip: audioUrl }], () => {});
}
