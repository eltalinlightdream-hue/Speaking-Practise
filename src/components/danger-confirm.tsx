"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type DangerState = { error?: string };

/**
 * Two steps before anything is deleted: a button, then a warning with a
 * checkbox that must be ticked. The form posts `confirm=yes` plus any
 * hidden fields to the server action.
 */
export function DangerConfirm({
  action,
  hidden = {},
  labels,
}: {
  action: (prev: DangerState, formData: FormData) => Promise<DangerState>;
  hidden?: Record<string, string>;
  labels: { open: string; title: string; text: string; check: string; confirm: string; cancel: string };
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [state, formAction, pending] = useActionState<DangerState, FormData>(action, {});

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="self-start border-destructive text-destructive hover:bg-destructive/10"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
        {labels.open}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-card border border-destructive/40 bg-destructive/5 p-4" aria-label={labels.title}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-destructive">{labels.title}</p>
          <p className="text-sm">{labels.text}</p>
        </div>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          name="confirm"
          value="yes"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="size-5 shrink-0 accent-destructive"
        />
        {labels.check}
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="destructive" disabled={!checked || pending}>
          <Trash2 aria-hidden />
          {labels.confirm}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setChecked(false);
          }}
          disabled={pending}
        >
          {labels.cancel}
        </Button>
      </div>
    </form>
  );
}
