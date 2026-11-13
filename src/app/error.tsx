"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shown when a page fails to load (for example, no internet for a moment).
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-8" aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl">{t("errorTitle")}</h1>
        <p className="text-muted-foreground">{t("errorText")}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" size="lg" onClick={reset}>
          <RotateCcw aria-hidden />
          {t("tryAgain")}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/home">{t("home")}</Link>
        </Button>
      </div>
    </main>
  );
}
