"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeOnboarding, type OnboardingState } from "./actions";

type Group = { id: string; name: string };

export function OnboardingForm({ groups, defaultName }: { groups: Group[]; defaultName: string }) {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});

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
          defaultValue={defaultName}
          placeholder={t("fullNamePlaceholder")}
          aria-invalid={state.error === "name" || undefined}
          required
          minLength={2}
          maxLength={100}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="lesson_group_id">{t("group")}</Label>
        <NativeSelect id="lesson_group_id" name="lesson_group_id" defaultValue="" aria-invalid={state.error === "group" || undefined} required>
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
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? tc("saving") : t("submit")}
      </Button>
    </form>
  );
}
