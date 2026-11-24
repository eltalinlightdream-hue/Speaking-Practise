"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TelegramIcon } from "@/components/brand-icons";
import { connectTelegramBot } from "./actions";

export type BotStatus =
  | { state: "off" }
  | { state: "connected"; url: string; lastError?: string }
  | { state: "notConnected"; url?: string };

/** Owner only: shows whether the bot is connected to this site, with a button to (re)connect. */
export function TelegramBotCard({ status }: { status: BotStatus }) {
  const t = useTranslations("owner.telegram");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TelegramIcon className="size-5" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status.state === "off" && <p className="text-muted-foreground">{t("off")}</p>}
        {status.state !== "off" && (
          <>
            <p className="flex items-start gap-2">
              {status.state === "connected" ? (
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              ) : (
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
              )}
              <span>{status.state === "connected" ? t("connected") : t("notConnected")}</span>
            </p>
            {status.state === "connected" && status.lastError && (
              <p className="text-sm text-muted-foreground">{t("lastError", { message: status.lastError })}</p>
            )}
            <Button
              type="button"
              variant="outline"
              className="self-start"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await connectTelegramBot();
                  setError(res.error ? t("error", { message: res.error }) : null);
                })
              }
            >
              {status.state === "connected" ? t("reconnect") : t("connect")}
            </Button>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
