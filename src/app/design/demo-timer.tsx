"use client";

import { useEffect, useState } from "react";
import { TimerRing } from "@/components/timer-ring";

export function DemoTimer() {
  const total = 120;
  const [remaining, setRemaining] = useState(102);
  useEffect(() => {
    const id = setInterval(() => setRemaining((s) => (s <= 0 ? total : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return <TimerRing remaining={remaining} total={total} label="Speaking" />;
}
