import { getLocale, getTranslations } from "next-intl/server";
import { FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, formatWeekRange, mondayOf, tashkentToday } from "@/lib/report/week";
import { WeekSelectDownload } from "./week-select-download";

/**
 * "Weekly report (PDF)" card: pick one of the last 8 weeks and download it.
 * Without userId it is the signed-in student's own report; admins pass a student's id.
 */
export async function WeeklyReportDownload({ userId }: { userId?: string }) {
  const t = await getTranslations("weeklyPdf");
  const locale = await getLocale();
  const thisMonday = mondayOf(tashkentToday());
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const monday = addDays(thisMonday, -7 * i);
    const range = formatWeekRange(monday, locale);
    return { monday, label: i === 0 ? `${range} (${t("thisWeek")})` : range };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileDown className="size-5" aria-hidden />
          {t("title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </CardHeader>
      <CardContent>
        <WeekSelectDownload weeks={weeks} userId={userId} selectLabel={t("week")} buttonLabel={t("download")} />
      </CardContent>
    </Card>
  );
}
