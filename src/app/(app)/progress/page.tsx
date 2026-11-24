import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LeaderboardList, type LeaderboardRow } from "@/components/leaderboard-list";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Period = "day" | "week";

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const profile = await requireProfile();
  const t = await getTranslations("leaderboard");
  const { period: periodParam } = await searchParams;
  const period: Period = periodParam === "week" ? "week" : "day";

  const supabase = await createClient();
  const { data } = await supabase.rpc("leaderboard", { p_period: period, p_limit: 20 });
  const rows = (data ?? []) as LeaderboardRow[];

  const tabs: { id: Period; label: string }[] = [
    { id: "day", label: t("today") },
    { id: "week", label: t("week") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      <nav aria-label={t("title")} className="grid grid-cols-2 gap-1 rounded-button border border-border bg-card p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === "day" ? "/progress" : "/progress?period=week"}
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
