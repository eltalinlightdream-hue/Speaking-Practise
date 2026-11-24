import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadWeeklyReport } from "@/lib/admin/queries";
import { addDays } from "@/lib/practice/streak";
import { formatDay, formatDayRange } from "@/lib/format-date";
import { GroupFilter } from "@/components/group-filter";
import { readReportParams, reportHref } from "./params";

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const t = await getTranslations("admin.reports");
  const locale = await getLocale();
  const { monday, thisMonday, filter } = readReportParams(await searchParams);
  const { groups, report } = await loadWeeklyReport(monday, filter);
  const group = filter.group;

  const groupName = (id: string | null) => (id ? (groups.find((g) => g.id === id)?.name ?? t("noGroup")) : t("noGroup"));
  const minutes = (s: number) => t("minutesValue", { m: Math.floor(s / 60) });
  const lastActive = (d: string | null) => (d ? formatDay(d, locale) : t("never"));
  const isThisWeek = monday === thisMonday;

  const stats = [
    { label: t("active"), value: t("activeValue", { active: report.total.active, total: report.total.students }) },
    { label: t("minutes"), value: Math.floor(report.total.weekSeconds / 60).toLocaleString("en-US").replace(/,/g, " ") },
    { label: t("countedDays"), value: report.total.countedDays },
    { label: t("mocks"), value: report.total.mocksCompleted },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("lead")}</p>
      </div>

      {/* Week picker */}
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="icon">
          <Link href={reportHref("/admin/reports", addDays(monday, -7), filter)} aria-label={t("prevWeek")} title={t("prevWeek")}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <span className="font-semibold text-primary">{formatDayRange(monday, addDays(monday, 6), locale)}</span>
          {isThisWeek && <span className="text-sm text-muted-foreground">{t("thisWeek")}</span>}
        </div>
        {isThisWeek ? (
          <Button variant="outline" size="icon" disabled aria-label={t("nextWeek")} className="disabled:bg-transparent disabled:opacity-40">
            <ChevronRight aria-hidden />
          </Button>
        ) : (
          <Button asChild variant="outline" size="icon">
            <Link href={reportHref("/admin/reports", addDays(monday, 7), filter)} aria-label={t("nextWeek")} title={t("nextWeek")}>
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        )}
      </div>

      {/* Group filter */}
      <GroupFilter groups={groups.filter((g) => g.active || g.id === group)} value={filter} path="/admin/reports" params={{ week: monday }} />

      {/* Totals */}
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card border border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="text-2xl font-semibold text-primary tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {/* Per group (only when all groups are shown) */}
      {!group && report.groups.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("byGroup")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 pr-3 font-semibold">{t("group")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">{t("active")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">{t("minutes")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">{t("countedDays")}</th>
                    <th scope="col" className="py-2 text-right font-semibold">{t("mocks")}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {report.groups
                    .filter((g) => g.students > 0)
                    .map((g) => (
                      <tr key={g.groupId ?? "none"} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 pr-3 font-semibold text-primary">
                          {g.groupId ? (
                            <Link href={reportHref("/admin/reports", monday, { group: g.groupId, teacher: null })} className="underline-offset-4 hover:underline">
                              {g.name}
                            </Link>
                          ) : (
                            t("noGroup")
                          )}
                        </th>
                        <td className="py-2 pr-3 text-right">{t("activeValue", { active: g.active, total: g.students })}</td>
                        <td className="py-2 pr-3 text-right">{Math.floor(g.weekSeconds / 60)}</td>
                        <td className="py-2 pr-3 text-right">{g.countedDays}</td>
                        <td className="py-2 text-right">{g.mocksCompleted}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Students */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl">{t("students")}</h2>
          {report.students.length > 0 && (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button asChild>
                <a href={reportHref("/admin/reports/csv", monday, filter)} download>
                  <Download aria-hidden />
                  {t("download")}
                </a>
              </Button>
              <span className="text-xs text-muted-foreground">{t("downloadHelp")}</span>
            </div>
          )}
        </div>

        {report.students.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            {/* Phones: one card per student */}
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-card md:hidden">
              {report.students.map((s) => (
                <li key={s.id} className="flex items-center">
                  <Link href={`/admin/students/${s.id}`} className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3 hover:bg-muted">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate font-semibold text-primary">{s.name}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{minutes(s.weekSeconds)}</span>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {groupName(s.groupId)} · {t("countedDays")}: {t("daysValue", { n: s.countedDays })} · {t("streak")}:{" "}
                      {t("streakValue", { n: s.currentStreak })}
                    </span>
                  </Link>
                  <a
                    href={`/progress/report?week=${monday}&user=${s.id}`}
                    download
                    aria-label={`${t("pdf")}: ${s.name}`}
                    title={t("pdf")}
                    className="mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-button text-primary hover:bg-muted"
                  >
                    <FileDown className="size-5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>

            {/* Tablets and desktops: a table */}
            <div className="hidden overflow-x-auto rounded-card border border-border bg-card md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-semibold">{t("name")}</th>
                    {!group && <th scope="col" className="px-4 py-2 font-semibold">{t("group")}</th>}
                    <th scope="col" className="px-4 py-2 text-right font-semibold">{t("minutes")}</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">{t("countedDays")}</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">{t("mocks")}</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">{t("streak")}</th>
                    <th scope="col" className="px-4 py-2 font-semibold">{t("lastActive")}</th>
                    <th scope="col" className="px-4 py-2 font-semibold"><span className="sr-only">PDF</span></th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {report.students.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <th scope="row" className="px-4 py-2 font-semibold">
                        <Link href={`/admin/students/${s.id}`} className="text-primary underline-offset-4 hover:underline">
                          {s.name}
                        </Link>
                      </th>
                      {!group && <td className="px-4 py-2">{groupName(s.groupId)}</td>}
                      <td className="px-4 py-2 text-right">{Math.floor(s.weekSeconds / 60)}</td>
                      <td className="px-4 py-2 text-right">{t("daysValue", { n: s.countedDays })}</td>
                      <td className="px-4 py-2 text-right">{s.mocksCompleted}</td>
                      <td className="px-4 py-2 text-right">{s.currentStreak}</td>
                      <td className="px-4 py-2">{lastActive(s.lastActive)}</td>
                      <td className="px-2 py-1 text-right">
                        <a
                          href={`/progress/report?week=${monday}&user=${s.id}`}
                          download
                          aria-label={`${t("pdf")}: ${s.name}`}
                          title={t("pdf")}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-button px-3 font-semibold text-primary hover:bg-muted"
                        >
                          <FileDown className="size-4" aria-hidden />
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
