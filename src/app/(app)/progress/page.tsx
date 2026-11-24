import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Trophy } from "lucide-react";
import { ProgressView } from "@/components/progress/progress-view";
import { WeeklyReportDownload } from "@/components/report/weekly-report-download";
import { requireProfile } from "@/lib/auth";
import { loadProgress } from "@/lib/practice/progress-data";

export default async function ProgressPage({ searchParams }: PageProps<"/progress">) {
  const profile = await requireProfile();
  const t = await getTranslations("progress");
  const tl = await getTranslations("leaderboard");
  const data = await loadProgress(profile.id, (await searchParams).month);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t("title")}</h1>
      <Link
        href="/progress/leaderboard"
        className="flex min-h-14 items-center gap-3 rounded-card border border-border bg-card px-4 font-semibold text-primary transition-colors hover:bg-surface"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Trophy className="size-5" aria-hidden />
        </span>
        <span className="flex-1">{tl("title")}</span>
        <ChevronRight className="size-5" aria-hidden />
      </Link>
      <ProgressView data={data} basePath="/progress" />
      <WeeklyReportDownload />
    </div>
  );
}
