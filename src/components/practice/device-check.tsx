"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Mic, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { classifyMediaError, getMediaStream, recordingSupported } from "@/lib/practice/recorder";
import type { RecordingType } from "@/lib/practice/types";

/**
 * Asks for microphone (and camera) permission and shows a live level meter.
 * Calls onReady with the stream once it works; the stream is then reused for
 * the session so the browser does not ask twice.
 */
export function DeviceCheck({
  type,
  stream,
  onReady,
}: {
  type: Exclude<RecordingType, "none">;
  stream: MediaStream | null;
  onReady: (s: MediaStream) => void;
}) {
  const t = useTranslations("practice.check");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Live microphone level from the stream.
  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      setLevel(Math.min(1, peak / 64));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      ctx.close().catch(() => {});
    };
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && stream && type === "video") videoRef.current.srcObject = stream;
  }, [stream, type]);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      if (!recordingSupported()) throw Object.assign(new Error("unsupported"), { name: "NotSupportedError" });
      onReady(await getMediaStream(type));
    } catch (e) {
      const { kind, message } = classifyMediaError(e);
      setError(kind === "denied" ? t("denied") : kind === "notFound" ? t("notFound") : kind === "unsupported" ? t("unsupported") : t("error", { message }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold text-primary">{type === "video" ? t("titleVideo") : t("title")}</h3>
      {!stream ? (
        <Button type="button" variant="secondary" onClick={check} disabled={busy} className="self-start">
          {type === "video" ? <Video aria-hidden /> : <Mic aria-hidden />}
          {type === "video" ? t("buttonVideo") : t("button")}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          {type === "video" && (
            <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full max-w-sm -scale-x-100 rounded-card bg-foreground object-cover" />
          )}
          <p className="flex items-center gap-2 font-semibold text-primary">
            <CheckCircle2 className="size-5 text-accent" aria-hidden />
            {t("ok")}
          </p>
          <p className="text-sm text-muted-foreground">{t("speak")}</p>
          <div
            className="h-3 w-full max-w-sm overflow-hidden rounded-full bg-border"
            role="meter"
            aria-label={t("level")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
          >
            <div className="h-full rounded-full bg-accent transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-button border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
