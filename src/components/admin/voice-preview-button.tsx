"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playQuestion, speechSupported, stopSpeaking } from "@/lib/speech";

export function VoicePreviewButton({
  text,
  audioUrl,
  showLabel = false,
}: {
  text: string;
  audioUrl?: string | null;
  showLabel?: boolean;
}) {
  const t = useTranslations("admin.question");
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    // Checked after mount so server and browser render the same HTML.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(speechSupported() || Boolean(audioUrl));
  }, [audioUrl]);

  async function toggle() {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    await playQuestion(text, audioUrl);
    setPlaying(false);
  }

  const label = playing ? t("stop") : t("preview");
  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? "sm" : "icon"}
      onClick={toggle}
      disabled={!text.trim() || !supported}
      aria-label={label}
      title={supported ? label : t("noSpeech")}
    >
      {playing ? <Square aria-hidden /> : <Volume2 aria-hidden />}
      {showLabel && label}
    </Button>
  );
}
