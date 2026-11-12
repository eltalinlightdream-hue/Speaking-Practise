import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { getCurrentProfile, isSetupComplete } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (isSetupComplete(profile)) redirect("/home");

  const supabase = await createClient();
  const [{ data: groups }, { data: auth }] = await Promise.all([
    supabase.from("lesson_groups").select("id, name").eq("active", true).order("name"),
    supabase.auth.getUser(),
  ]);
  // Prefill the name Google gives us; the student can change it.
  const meta = auth.user?.user_metadata ?? {};
  const defaultName = profile.full_name ?? (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? "";

  const t = await getTranslations("onboarding");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo className="text-primary" />
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 sm:items-center sm:pt-0">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">{t("title")}</CardTitle>
            <CardDescription className="text-base">{t("lead")}</CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm groups={groups ?? []} defaultName={defaultName} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
