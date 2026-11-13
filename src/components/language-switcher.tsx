"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "uz", label: "Oʻzbekcha", short: "UZ" },
  { value: "en", label: "English", short: "EN" },
] as const;

export function LanguageSwitcher({ className, variant = "compact" }: { className?: string; variant?: "compact" | "full" }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="radiogroup"
      aria-label={t("language")}
      className={cn("inline-flex rounded-button border border-border bg-card p-1", pending && "opacity-70", className)}
    >
      {OPTIONS.map((o) => {
        const active = o.value === locale;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            lang={o.value}
            disabled={pending}
            onClick={() => !active && startTransition(() => setLocale(o.value))}
            className={cn(
              "min-h-9 min-w-11 rounded-[8px] px-3 text-sm font-semibold transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-primary hover:bg-muted",
            )}
          >
            {variant === "full" ? o.label : o.short}
          </button>
        );
      })}
    </div>
  );
}
