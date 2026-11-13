"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile, type ProfileState } from "./actions";

type Group = { id: string; name: string };

export function ProfileForm({ groups, fullName, groupId }: { groups: Group[]; fullName: string; groupId: string }) {
  const t = useTranslations("onboarding");
  const ts = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {});
  // Controlled fields: React resets plain form fields after every action, which
  // would wipe what the student typed when there is an error.
  const [name, setName] = useState(fullName);
  const [group, setGroup] = useState(groupId);

  const errorText =
    state.error === "name" ? t("errorName") : state.error === "group" ? t("errorGroup") : state.error === "save" ? t("errorSave") : null;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">{t("fullName")}</Label>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={state.error === "name" || undefined}
          required
          minLength={2}
          maxLength={100}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="lesson_group_id">{t("group")}</Label>
        <NativeSelect id="lesson_group_id" name="lesson_group_id" value={group} onChange={(e) => setGroup(e.target.value)} aria-invalid={state.error === "group" || undefined} required>
          <option value="" disabled>
            {t("groupPlaceholder")}
          </option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </NativeSelect>
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
            {ts("profileSaved")}
          </p>
        )}
      </div>
    </form>
  );
}
