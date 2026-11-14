import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { REQUIRED_CHANNELS, channelUrl } from "@/config/telegram-channels";
import { GoogleButton } from "./google-button";
import { TelegramLogin } from "./telegram-login";

// Students sign in with Telegram only, so the bot can check that they joined
// our channels (src/config/telegram-channels.ts).
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
        <div className="flex flex-col gap-2 rounded-card bg-muted/60 p-3">
          <p className="text-sm text-foreground">{t("channelsNote")}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {REQUIRED_CHANNELS.map((c) => (
              <li key={c.username}>
                <a
                  href={channelUrl(c.username)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4 hover:no-underline"
                >
                  @{c.username}
                </a>
              </li>
            ))}
          </ul>
        </div>
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
