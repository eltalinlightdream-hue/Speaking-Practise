"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, CheckCircle2, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GroupSelect } from "@/components/group-select";
import type { LessonGroup } from "@/lib/groups";
import { DangerConfirm } from "@/components/danger-confirm";
import { deleteUser, setKept, setRole, updateStudent, type EditState } from "./actions";

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

/** Admins change a student's name and lesson group. */
export function EditStudent({
  userId,
  fullName,
  groupId,
  groups,
}: {
  userId: string;
  fullName: string;
  groupId: string;
  groups: LessonGroup[];
}) {
  const t = useTranslations("admin.students");
  const to = useTranslations("onboarding");
  const tc = useTranslations("common");
  const tr = useTranslations("admin.reports");
  const [state, action, pending] = useActionState<EditState, FormData>(updateStudent, {});
  // Controlled, so a failed save does not wipe what was typed.
  const [name, setName] = useState(fullName);
  const [group, setGroup] = useState(groupId);
  const errorText = state.error === "name" ? to("errorName") : state.error === "save" ? t("error", { message: state.message ?? "" }) : null;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="user_id" value={userId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="edit_full_name">{to("fullName")}</Label>
        <Input
          id="edit_full_name"
          name="full_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={state.error === "name" || undefined}
          required
          minLength={2}
          maxLength={100}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="edit_lesson_group_id">{t("group")}</Label>
        <GroupSelect
          id="edit_lesson_group_id"
          name="lesson_group_id"
          groups={groups}
          placeholder={tr("noGroup")}
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        />
      </div>
      {errorText && (
        <p role="alert" className="rounded-button border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorText}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
        {state.ok && !pending && (
          <p role="status" className="flex items-center gap-2 text-sm font-semibold text-primary">
            <CheckCircle2 className="size-4" aria-hidden />
            {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
