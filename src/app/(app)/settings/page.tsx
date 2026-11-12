import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { requireProfile } from "@/lib/auth";

export default async function SettingsPage() {
  const profile = await requireProfile();
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");
  const tr = await getTranslations("roles");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t("title")}</h1>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-primary">{profile.full_name}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
          <Badge>{tr(profile.role)}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tc("language")}</CardTitle>
          <CardDescription>{t("languageHelp")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LanguageSwitcher variant="full" />
        </CardContent>
      </Card>

      <form action="/auth/signout" method="post">
        <Button type="submit" variant="outline" className="w-full sm:w-auto">
          <LogOut aria-hidden />
          {tc("signOut")}
        </Button>
      </form>
    </div>
  );
}
