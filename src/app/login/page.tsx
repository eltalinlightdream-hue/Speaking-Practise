import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleButton } from "./google-button";
import { TelegramLogin } from "./telegram-login";

// Students sign in with their Telegram account (through the bot).
// Google sign-in is hidden but kept: set NEXT_PUBLIC_GOOGLE_LOGIN=on in Vercel
// to show it again. The owner can also sign in by email at /login/owner.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const t = await getTranslations("login");
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/home";
  const hasError = params.error !== undefined;
  const telegramBot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim();
  const showGoogle = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "on";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">{t("title")}</CardTitle>
        <CardDescription className="text-base">{t("leadTelegram")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hasError && (
          <p role="alert" className="rounded-button border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {params.error === "telegram" ? t("telegramError") : t("error")}
          </p>
        )}
        {telegramBot ? (
          <TelegramLogin
            next={next}
            labels={{
              start: t("telegramStart"),
              open: t("telegramOpen"),
              waiting: t("telegramWaiting"),
              expired: t("telegramExpired"),
              error: t("telegramError"),
              retry: t("telegramRetry"),
            }}
          />
        ) : (
          <p className="text-center text-sm text-muted-foreground">{t("telegram")}</p>
        )}
        {showGoogle && (
          <>
            <p className="flex items-center gap-3 text-sm text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
              {t("or")}
            </p>
            <GoogleButton next={next} label={t("google")} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
