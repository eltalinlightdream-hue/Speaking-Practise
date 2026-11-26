"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/input";
import { updateReminders, type ReminderState } from "./actions";

/** 08:00, 08:30, … 21:00 */
const TIMES = Array.from({ length: 27 }, (_, i) => {
  const minutes = 8 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
});

/** Telegram practice reminders: on/off and the time. */
export function ReminderForm({ enabled, time }: { enabled: boolean; time: string | null }) {
  const t = useTranslations("settings.reminders");
  const [state, formAction, pending] = useActionState<ReminderState, FormData>(updateReminders, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="size-5 shrink-0 accent-primary" />
        {t("enabled")}
      </label>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reminder-time">{t("time")}</Label>
        <NativeSelect id="reminder-time" name="time" defaultValue={time ? time.slice(0, 5) : "auto"} aria-describedby="reminder-time-help">
          <option value="auto">{t("auto")}</option>
          {TIMES.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </NativeSelect>
        <p id="reminder-time-help" className="text-sm text-muted-foreground">
          {t("help")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {t("save")}
        </Button>
        {state.ok && (
          <p role="status" className="flex items-center gap-1 text-sm font-semibold text-primary">
            <Check className="size-4" aria-hidden />
            {t("saved")}
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {t("error")}
          </p>
        )}
      </div>
    </form>
  );
}
