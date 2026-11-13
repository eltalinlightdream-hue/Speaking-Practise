"use client";

import { useTranslations } from "next-intl";
import { DangerConfirm } from "@/components/danger-confirm";
import { deleteAccount } from "./actions";

export function DeleteAccount() {
  const t = useTranslations("settings");
  return (
    <DangerConfirm
      action={deleteAccount}
      labels={{
        open: t("deleteButton"),
        title: t("deleteConfirmTitle"),
        text: t("deleteConfirmText"),
        check: t("deleteConfirmCheck"),
        confirm: t("deleteConfirmButton"),
        cancel: t("deleteCancel"),
      }}
    />
  );
}
