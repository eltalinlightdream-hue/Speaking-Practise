import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Crown, Info, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { telegramApi } from "@/lib/telegram-bot";
import { RoleSwitch } from "../admin/students/student-actions";
import { TelegramBotCard, type BotStatus } from "./telegram-bot-card";

/** Asks Telegram where the bot's messages go, to show "connected" or not. */
async function loadBotStatus(): Promise<BotStatus> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME) return { state: "off" };
  const h = await headers();
  const expected = `https://${h.get("x-forwarded-host") ?? h.get("host")}/auth/telegram/webhook`;
  const info = await telegramApi<{ url?: string; last_error_message?: string }>("getWebhookInfo", {}).catch(() => null);
  const url = info?.result?.url;
  return url === expected ? { state: "connected", url, lastError: info?.result?.last_error_message } : { state: "notConnected", url };
}

export default async function OwnerPage() {
  const owner = await requireOwner();
  const t = await getTranslations("owner");
  const tRoles = await getTranslations("roles");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["admin", "owner"])
    .order("role", { ascending: false })
    .order("full_name");
  if (error) throw new Error(error.message);
  const people = data ?? [];
  const admins = people.filter((p) => p.role === "admin");
  const botStatus = await loadBotStatus();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("lead")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admins")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y divide-border">
            {people.map((p) => {
              const Icon = p.role === "owner" ? Crown : ShieldCheck;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-surface-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/admin/students/${p.id}`} className="truncate font-semibold text-primary underline-offset-4 hover:underline">
                      {p.full_name || p.email}
                      {p.id === owner.id && ` (${t("you")})`}
                    </Link>
                    <span className="truncate text-sm text-muted-foreground">
                      {tRoles(p.role)} · {p.email}
                    </span>
                  </div>
                  {p.role === "admin" && (
                    // Own line on phones, so the name next to it is not squeezed.
                    <div className="w-full sm:w-auto">
                      <RoleSwitch userId={p.id} role="admin" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {admins.length === 0 && <p className="text-muted-foreground">{t("noAdmins")}</p>}
        </CardContent>
      </Card>

      <TelegramBotCard status={botStatus} />

      <div className="flex flex-col items-start gap-3">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("howTo")}
        </p>
        <Button asChild>
          <Link href="/admin/students">{t("openStudents")}</Link>
        </Button>
      </div>
    </div>
  );
}
