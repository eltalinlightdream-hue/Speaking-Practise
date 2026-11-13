"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Info, Mic, MicOff, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceCheck } from "@/components/practice/device-check";
import { stopStream } from "@/lib/practice/recorder";
import type { RecordingType } from "@/lib/practice/types";
import { cn } from "@/lib/utils";

function isIOS() {
  return typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * "Audio / Video + audio / No recording" with the microphone (and camera)
 * check. Shared by General Training and Mock Tests.
 */
export function RecordingChoice({
  recordingType,
  onRecordingTypeChange,
  stream,
  onStreamChange,
}: {
  recordingType: RecordingType;
  onRecordingTypeChange: (t: RecordingType) => void;
  stream: MediaStream | null;
  onStreamChange: (s: MediaStream | null) => void;
}) {
  const t = useTranslations("practice");
  const [ios, setIos] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setIos(isIOS()), []);

  function choose(type: RecordingType) {
    onRecordingTypeChange(type);
    // A video stream is needed for video; an audio-only stream is not enough.
    if (stream && (type === "none" || (type === "video") !== stream.getVideoTracks().length > 0)) {
      stopStream(stream);
      onStreamChange(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("recordingTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("recordingLead")}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div role="radiogroup" aria-label={t("recordingTitle")} className="grid gap-3 sm:grid-cols-3">
            {(["audio", "video", "none"] as const).map((type) => {
              const Icon = type === "audio" ? Mic : type === "video" ? Video : MicOff;
              const selected = type === recordingType;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(type)}
                  className={cn(
                    "flex min-h-20 flex-col items-start gap-1 rounded-card border-2 p-4 text-left transition-colors",
                    selected ? "border-primary bg-surface" : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2 font-semibold text-primary">
                    <Icon className="size-5" aria-hidden />
                    {t(`recording.${type}`)}
                  </span>
                  <span className="text-sm text-muted-foreground">{t(`recordingHelp.${type}`)}</span>
                </button>
              );
            })}
          </div>

          {recordingType !== "none" && <DeviceCheck key={recordingType} type={recordingType} stream={stream} onReady={onStreamChange} />}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("voiceNote")}
        </p>
        {ios && (
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("safariNote")}
          </p>
        )}
      </div>
    </>
  );
}
