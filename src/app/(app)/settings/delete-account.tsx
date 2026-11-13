"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAccount, type DeleteState } from "./actions";

/** Two steps: a button, then a clear warning with a checkbox before anything is deleted. */
export function DeleteAccount() {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {});

  if (!open) {
    return (
      <Button type="button" variant="outline" className="self-start border-destructive text-destructive hover:bg-destructive/10" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        {t("deleteButton")}
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card border border-destructive/40 bg-destructive/5 p-4" aria-labelledby="delete-title">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <div className="flex flex-col gap-1">
          <p id="delete-title" className="font-semibold text-destructive">
            {t("deleteConfirmTitle")}
          </p>
          <p className="text-sm">{t("deleteConfirmText")}</p>
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
        {t("deleteConfirmCheck")}
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {t("deleteError")}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="destructive" disabled={!checked || pending}>
          <Trash2 aria-hidden />
          {t("deleteConfirmButton")}
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
          {t("deleteCancel")}
        </Button>
      </div>
    </form>
  );
}
