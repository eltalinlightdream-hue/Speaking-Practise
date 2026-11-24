import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <span className="flex size-16 items-center justify-center rounded-full bg-surface text-surface-foreground">
        <MapPinOff className="size-8" aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl">{t("notFoundTitle")}</h1>
        <p className="text-muted-foreground">{t("notFoundText")}</p>
      </div>
      <Button asChild size="lg">
        <Link href="/home">{t("home")}</Link>
      </Button>
    </main>
  );
}
