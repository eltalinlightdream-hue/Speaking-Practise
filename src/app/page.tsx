import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Check, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentProfile } from "@/lib/auth";

export default async function LandingPage() {
  const profile = await getCurrentProfile().catch(() => null);
  if (profile) redirect("/home");

  const t = await getTranslations("landing");
  const points = [t("point1"), t("point2"), t("point3")];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo className="text-primary" />
        <LanguageSwitcher />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start justify-center gap-8 px-4 pb-16 sm:px-6 md:flex-row md:items-center md:gap-16">
        <section className="flex max-w-xl flex-col gap-6">
          <h1 className="text-4xl tracking-tight sm:text-5xl">{t("title")}</h1>
          <p className="text-lg text-muted-foreground">{t("lead")}</p>
          <ul className="flex flex-col gap-3">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-surface text-surface-foreground">
                  <Check className="size-4" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="w-full sm:w-auto sm:self-start">
            <Link href="/login">
              <Mic aria-hidden />
              {t("start")}
            </Link>
          </Button>
        </section>

        <div aria-hidden className="hidden flex-1 md:block">
          <div className="relative mx-auto aspect-square max-w-sm rounded-[32px] bg-surface/50 p-10">
            <div className="flex h-full flex-col justify-between rounded-card bg-card p-6 shadow-sm">
              <span className="text-sm font-semibold text-muted-foreground">Part 2</span>
              <p className="text-xl font-semibold text-primary">Describe a place where you want to go to relax</p>
              <div className="flex items-center gap-3">
                <span className="relative flex size-14 items-center justify-center rounded-full border-4 border-accent text-sm font-semibold text-foreground">
                  1:42
                </span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="size-2.5 rounded-full bg-destructive" /> REC
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
