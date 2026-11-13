"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DangerConfirm } from "@/components/danger-confirm";
import { deleteUser, setKept, setRole } from "./actions";

export function KeptToggle({ userId, kept }: { userId: string; kept: boolean }) {
  const t = useTranslations("admin.students");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 font-semibold text-primary">
        {kept && <BadgeCheck className="size-5" aria-hidden />}
        {kept ? t("keptYes") : t("keptNo")}
      </p>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setKept(userId, !kept);
            setError(res.error ? t("error", { message: res.error }) : null);
          })
        }
      >
        {kept ? t("keptUnset") : t("keptSet")}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Owner only: switch between student and admin. */
export function RoleSwitch({ userId, role }: { userId: string; role: "student" | "admin" }) {
  const t = useTranslations("admin.students");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = role === "admin" ? "student" : "admin";
  const Icon = next === "admin" ? ShieldCheck : UserRound;
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setRole(userId, next);
            setError(res.error ? t("error", { message: res.error }) : null);
          })
        }
      >
        <Icon aria-hidden />
        {next === "admin" ? t("makeAdmin") : t("makeStudent")}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function DeleteUser({ userId, name }: { userId: string; name: string }) {
  const t = useTranslations("admin.students");
  const ts = useTranslations("settings");
  return (
    <DangerConfirm
      action={deleteUser}
      hidden={{ user_id: userId }}
      labels={{
        open: t("deleteButton"),
        title: t("deleteConfirmTitle"),
        text: t("deleteConfirmText", { name }),
        check: ts("deleteConfirmCheck"),
        confirm: t("deleteConfirmButton"),
        cancel: ts("deleteCancel"),
      }}
    />
  );
}
