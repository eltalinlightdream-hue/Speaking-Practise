import { getTranslations } from "next-intl/server";
import { ProgressView } from "@/components/progress/progress-view";
import { WeeklyReportDownload } from "@/components/report/weekly-report-download";
import { requireProfile } from "@/lib/auth";
import { loadProgress } from "@/lib/practice/progress-data";

export default async function ProgressPage({ searchParams }: PageProps<"/progress">) {
  const profile = await requireProfile();
  const t = await getTranslations("progress");
  const data = await loadProgress(profile.id, (await searchParams).month);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t("title")}</h1>
      <ProgressView data={data} basePath="/progress" />
      <WeeklyReportDownload />
    </div>
  );
}
