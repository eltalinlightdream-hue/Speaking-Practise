import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, Code, Users } from "lucide-react";
import { Logo } from "@/components/logo";
import { TelegramIcon, YouTubeIcon } from "@/components/brand-icons";
import { CONTRIBUTORS, ENGINEER, SITE_STARTED, type Person } from "@/config/site";
import { cn } from "@/lib/utils";

function PersonLinks({ person }: { person: Person }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {person.links.map((l) => {
        const Icon = l.kind === "telegram" ? TelegramIcon : YouTubeIcon;
        return (
          <li key={l.href}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-button border border-primary-foreground/25 px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
            >
              <Icon className="size-4 shrink-0" />
              <span>{l.kind === "telegram" ? "Telegram" : "YouTube"}</span>
              <span className="sr-only">: {person.name} ({l.handle})</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** One short line: free for everyone + privacy link. Used on phones away from the home page. */
export async function CompactFooter({ className }: { className?: string }) {
  const t = await getTranslations("footer");
  return (
    <footer className={cn("border-t border-border bg-card", className)}>
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 px-4 py-2 text-sm text-muted-foreground sm:px-6">
        <p>{t("free")}</p>
        <Link href="/privacy" className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4 hover:no-underline">
          {t("privacy")}
        </Link>
      </div>
    </footer>
  );
}

/** Bottom of every page: who built the site, why, when it started, and links. */
export async function SiteFooter({ className }: { className?: string }) {
  const t = await getTranslations("footer");
  const locale = await getLocale();
  const started = new Intl.DateTimeFormat(locale === "uz" ? "uz-Latn-UZ" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${SITE_STARTED}T00:00:00Z`));

  return (
    <footer className={cn("bg-primary text-primary-foreground", className)}>
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <section className="flex flex-col gap-3">
          <Logo inverted />
          <p className="text-sm leading-relaxed text-primary-foreground/90">{t("why")}</p>
          <p className="flex items-center gap-2 text-sm text-primary-foreground/90">
            <CalendarDays className="size-4 shrink-0" aria-hidden />
            {t("started", { date: started })}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary-foreground/80">
            <Code className="size-4" aria-hidden />
            {t("engineer")}
          </h2>
          <p className="font-semibold">{ENGINEER.name}</p>
          <PersonLinks person={ENGINEER} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary-foreground/80">
            <Users className="size-4" aria-hidden />
            {t("contributors")}
          </h2>
          <ul className="flex flex-col gap-4">
            {CONTRIBUTORS.map((p) => (
              <li key={p.name} className="flex flex-col gap-2">
                <p className="font-semibold">{p.name}</p>
                <PersonLinks person={p} />
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="border-t border-primary-foreground/15">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-primary-foreground/80 sm:px-6">
          <p>{t("free")}</p>
          <Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:no-underline">
            {t("privacy")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
