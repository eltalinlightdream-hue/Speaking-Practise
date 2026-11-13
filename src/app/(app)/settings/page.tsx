import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { DeleteAccount } from "./delete-account";

export default async function SettingsPage() {
  const profile = await requireProfile();
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");
  const tr = await getTranslations("roles");

  const supabase = await createClient();
  const { data: groups } = await supabase.from("lesson_groups").select("id, name, active").order("name");
  // Students can only see active groups. If their own group was disabled,
  // show "Choose your group" instead of quietly picking another one.
  const options = (groups ?? []).filter((g) => g.active || g.id === profile.lesson_group_id);
  const groupId = options.some((g) => g.id === profile.lesson_group_id) ? (profile.lesson_group_id ?? "") : "";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t("title")}</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>{t("profileTitle")}</CardTitle>
              <CardDescription className="break-all">{profile.email ?? t("viaTelegram")}</CardDescription>
            </div>
            <Badge>{tr(profile.role)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ProfileForm groups={options} fullName={profile.full_name ?? ""} groupId={groupId} />
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

      <Card>
        <CardHeader>
          <CardTitle>{t("accountTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              <LogOut aria-hidden />
              {tc("signOut")}
            </Button>
          </form>

          <div className="flex flex-col gap-3 border-t border-border pt-5">
            <h3 className="font-semibold text-primary">{t("deleteTitle")}</h3>
            {profile.role === "owner" ? (
              <p className="text-sm text-muted-foreground">{t("ownerNote")}</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{t("deleteLead")}</p>
                <DeleteAccount />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
