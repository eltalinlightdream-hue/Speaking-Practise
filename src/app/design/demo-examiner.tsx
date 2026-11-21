"use client";

import { useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExaminerCaptions } from "@/components/practice/examiner-captions";
import { spoken } from "@/lib/practice/examiner";
import { playLines, preloadClips, stopSpeaking, unlockAudio, unlockSpeech } from "@/lib/speech";

// A few real examiner clips, to hear the voice and see captions follow it.
const SAMPLE = ["open-01", "open-02", "open-03a", "open-04", "open-05", "open-06", "p2-06", "p2-07"].map(spoken);

export function DemoExaminer() {
  const [lines, setLines] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const run = useRef(0);

  function play() {
    unlockSpeech();
    unlockAudio();
    preloadClips(SAMPLE.map((l) => l.clip));
    const my = ++run.current;
    setLines([]);
    setPlaying(true);
    void playLines(SAMPLE, (s) => run.current === my && setLines((c) => [...c, s]), () => run.current === my).then(() => {
      if (run.current === my) setPlaying(false);
    });
  }

  function stop() {
    run.current++;
    stopSpeaking();
    setPlaying(false);
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <ExaminerCaptions lines={lines} speaking={playing} showText />
      {playing ? (
        <Button type="button" variant="outline" onClick={stop}>
          <Square aria-hidden />
          Stop
        </Button>
      ) : (
        <Button type="button" onClick={play}>
          <Play aria-hidden />
          Play examiner sample
        </Button>
      )}
    </div>
  );
}
