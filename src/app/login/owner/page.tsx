import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnerForm } from "./owner-form";

// Hidden page: not linked anywhere. Only the owner email gets a link.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OwnerLoginPage() {
  const t = await getTranslations("ownerLogin");
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">{t("title")}</CardTitle>
        <CardDescription className="text-base">{t("lead")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <OwnerForm
          labels={{ email: t("email"), submit: t("submit"), sent: t("sent"), invalid: t("invalid"), error: t("error") }}
        />
        <Link href="/login" className="text-sm text-primary underline underline-offset-4 hover:no-underline">
          {t("back")}
        </Link>
      </CardContent>
    </Card>
  );
}
