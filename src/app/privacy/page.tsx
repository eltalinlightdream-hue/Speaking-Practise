import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";

type Section = { title: string; items: string[] };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

// Public page (no sign-in needed). The text lives in messages/*.json.
export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const sections = t.raw("sections") as Section[];
  // Optional contact address, set in the hosting settings (never in git).
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

  return (
    <div className="flex min-h-dvh flex-col">
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" aria-label="Speaking Easy" className="text-primary">
          <Logo />
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("updated")}</p>
          <p className="text-lg">{t("intro")}</p>
        </div>

        {sections.map((s) => (
          <section key={s.title} className="flex flex-col gap-3">
            <h2 className="text-xl">{s.title}</h2>
            <ul className="flex list-disc flex-col gap-2 pl-6 marker:text-secondary">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

        {contact && (
          <p>
            {t("contact")}{" "}
            <a href={`mailto:${contact}`} className="font-semibold text-primary underline underline-offset-4">
              {contact}
            </a>
          </p>
        )}

        <Link href="/" className="inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary">
          <ChevronLeft className="size-5" aria-hidden />
          {t("back")}
        </Link>
      </main>
    </div>
      <SiteFooter className="mt-12" />
    </div>
  );
}
