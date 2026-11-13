"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";

export function WeekSelectDownload({
  weeks,
  userId,
  selectLabel,
  buttonLabel,
}: {
  weeks: { monday: string; label: string }[];
  userId?: string;
  selectLabel: string;
  buttonLabel: string;
}) {
  const [week, setWeek] = useState(weeks[0]?.monday ?? "");
  const q = new URLSearchParams({ week });
  if (userId) q.set("user", userId);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1.5 sm:w-80">
        <label htmlFor="report-week" className="text-sm font-semibold">
          {selectLabel}
        </label>
        <NativeSelect id="report-week" value={week} onChange={(e) => setWeek(e.target.value)}>
          {weeks.map((w) => (
            <option key={w.monday} value={w.monday}>
              {w.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button asChild variant="outline">
        {/* A plain link (not a client navigation) so the browser downloads the file. */}
        <a href={`/progress/report?${q.toString()}`} download>
          <FileDown aria-hidden />
          {buttonLabel}
        </a>
      </Button>
    </div>
  );
}
