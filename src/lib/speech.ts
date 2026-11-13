"use client";

// Browser text-to-speech with an English voice. Used for the admin "Preview
// voice" button now, and by the practice engine in Step 3.

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

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/** Play an uploaded audio file if there is one, otherwise use the browser voice. */
export async function playQuestion(text: string, audioUrl?: string | null) {
  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl);
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("audio failed"));
        audio.play().catch(reject);
      });
      return;
    } catch {
      // Fall back to the browser voice.
    }
  }
  await speak(text);
}
