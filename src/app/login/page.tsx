import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { GoogleButton } from "./google-button";
import { TelegramButton } from "./telegram-button";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const t = await getTranslations("login");
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/home";
  const hasError = params.error !== undefined;
  // Telegram login switches on once the bot is set up (see README).
  const telegramBot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" aria-label="Speaking Easy">
          <Logo className="text-primary" />
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-8 sm:items-center sm:pt-0">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">{t("title")}</CardTitle>
            <CardDescription className="text-base">{telegramBot ? t("leadBoth") : t("lead")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {hasError && (
              <p role="alert" className="rounded-button border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {params.error === "telegram" ? t("telegramError") : t("error")}
              </p>
            )}
            <GoogleButton next={next} label={t("google")} />
            {telegramBot ? (
              <>
                <p className="flex items-center gap-3 text-sm text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                  {t("or")}
                </p>
                <TelegramButton bot={telegramBot} next={next} />
              </>
            ) : (
              <p className="text-center text-sm text-muted-foreground">{t("telegram")}</p>
            )}
          </CardContent>
        </Card>
      </main>
      <SiteFooter className="mt-12" />
    </div>
  );
}
