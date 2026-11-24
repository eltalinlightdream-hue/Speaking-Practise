import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { LeaderboardList, type LeaderboardRow } from "@/components/leaderboard-list";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Period = "day" | "week";

export default async function LeaderboardPage({ searchParams }: PageProps<"/progress/leaderboard">) {
  const profile = await requireProfile();
  const t = await getTranslations("leaderboard");
  const { period: periodParam } = await searchParams;
  const period: Period = periodParam === "week" ? "week" : "day";

  const supabase = await createClient();
  const { data } = await supabase.rpc("leaderboard", { p_period: period, p_limit: 20 });
  const rows = (data ?? []) as LeaderboardRow[];

  const tabs: { id: Period; label: string; href: string }[] = [
    { id: "day", label: t("today"), href: "/progress/leaderboard" },
    { id: "week", label: t("week"), href: "/progress/leaderboard?period=week" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/progress" className="inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary">
        <ChevronLeft className="size-5" aria-hidden />
        {t("back")}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      <nav aria-label={t("title")} className="grid grid-cols-2 gap-1 rounded-button border border-border bg-card p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={period === tab.id ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center rounded-[8px] font-semibold transition-colors",
              period === tab.id ? "bg-primary text-primary-foreground" : "text-primary hover:bg-surface",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {profile.role !== "student" && <p className="text-sm text-muted-foreground">{t("notRanked")}</p>}

      <LeaderboardList rows={rows} />
    </div>
  );
}
