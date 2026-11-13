import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Check, ChevronLeft, ChevronRight, Flame, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EXAMS, isExamCode } from "@/config/exams";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DAY_GOAL_SECONDS, TIME_ZONE, summarise } from "@/lib/practice/streak";
import { addMonths, isMonth, monthGrid, monthOf } from "@/lib/practice/calendar";
import { formatDayTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const RECENT = 20;

type SessionRow = {
  id: string;
  mode: "general" | "mock";
  exam: string;
  parts: number[];
  started_at: string;
  duration_seconds: number;
  completed: boolean;
  ended_at: string | null;
  mock_sets: { name: string } | null;
};

export default async function ProgressPage({ searchParams }: PageProps<"/progress">) {
  const profile = await requireProfile();
  const t = await getTranslations("progress");
  const tModes = await getTranslations("practice.modes");
  const locale = await getLocale();
  const intlLocale = locale === "uz" ? "uz-Latn" : "en-GB";

  const supabase = await createClient();
  const [days, recent] = await Promise.all([
    supabase.from("practice_sessions").select("day_tashkent, duration_seconds").eq("user_id", profile.id),
    supabase
      .from("practice_sessions")
      .select("id, mode, exam, parts, started_at, duration_seconds, completed, ended_at, mock_sets(name)")
      .eq("user_id", profile.id)
      .order("started_at", { ascending: false })
      .limit(RECENT),
  ]);
  if (days.error) throw new Error(days.error.message);
  if (recent.error) throw new Error(recent.error.message);

  const summary = summarise(days.data ?? []);
  const sessions = (recent.data ?? []) as unknown as SessionRow[];

  // Which month the calendar shows (never later than this month).
  const thisMonth = monthOf(summary.today);
  const sp = await searchParams;
  const month = isMonth(sp.month) && sp.month <= thisMonth ? sp.month : thisMonth;
  const weeks = monthGrid(month);

  const monthTitle = new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-15T12:00:00Z`),
  );
  // 2026-11-02 is a Monday: name the 7 weekdays from it.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 2 + i, 12))),
  );
  const longDate = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "long", timeZone: "UTC" });

  const minutesLeft = Math.max(0, Math.ceil((DAY_GOAL_SECONDS - summary.secondsToday) / 60));
  const goalDone = summary.secondsToday >= DAY_GOAL_SECONDS;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t("title")}</h1>

      {/* Streaks */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex flex-col gap-2">
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Flame className="size-5" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">{t("currentStreak")}</p>
            <p className="text-2xl font-semibold text-primary tabular-nums">{t("days", { count: summary.current })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <span className="flex size-10 items-center justify-center rounded-full bg-surface text-surface-foreground">
              <Trophy className="size-5" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">{t("longestStreak")}</p>
            <p className="text-2xl font-semibold text-primary tabular-nums">{t("days", { count: summary.longest })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Today */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg">{t("today")}</h2>
            <p className="font-semibold tabular-nums">{t("todayMinutes", { minutes: summary.minutesToday })}</p>
          </div>
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={15}
            aria-valuenow={Math.min(15, summary.minutesToday)}
            aria-label={t("todayMinutes", { minutes: summary.minutesToday })}
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, (summary.secondsToday / DAY_GOAL_SECONDS) * 100)}%` }}
            />
          </div>
          <p className="flex items-center gap-2 text-sm">
            {goalDone && <Check className="size-4 text-primary" aria-hidden />}
            {goalDone ? t("goalDone") : t("goalLeft", { minutes: minutesLeft })}
          </p>
          <p className="text-sm text-muted-foreground">{t("rule")}</p>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div className="flex flex-col">
            <CardTitle>{t("calendar")}</CardTitle>
            <p className="text-sm capitalize text-muted-foreground">{monthTitle}</p>
          </div>
          <div className="flex gap-1">
            <Button asChild variant="ghost" size="icon">
              <Link href={`/progress?month=${addMonths(month, -1)}`} aria-label={t("prevMonth")} title={t("prevMonth")} scroll={false}>
                <ChevronLeft aria-hidden />
              </Link>
            </Button>
            {month < thisMonth ? (
              <Button asChild variant="ghost" size="icon">
                <Link href={`/progress?month=${addMonths(month, 1)}`} aria-label={t("nextMonth")} title={t("nextMonth")} scroll={false}>
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" size="icon" disabled aria-label={t("nextMonth")} className="disabled:bg-transparent disabled:opacity-40">
                <ChevronRight aria-hidden />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <table className="w-full table-fixed border-separate border-spacing-1 text-center">
            <caption className="sr-only">
              {t("calendar")}, {monthTitle}
            </caption>
            <thead>
              <tr>
                {weekdays.map((w) => (
                  <th key={w} scope="col" className="pb-1 text-xs font-semibold capitalize text-muted-foreground">
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, i) => (
                <tr key={i}>
                  {week.map((day, j) => {
                    if (!day) return <td key={j} />;
                    const seconds = summary.secondsByDay.get(day) ?? 0;
                    const counted = summary.counted.has(day);
                    const isToday = day === summary.today;
                    const label = longDate.format(new Date(`${day}T12:00:00Z`));
                    const minutes = Math.floor(seconds / 60);
                    return (
                      <td key={j} className="p-0">
                        <div
                          className={cn(
                            "relative mx-auto flex aspect-square max-w-12 flex-col items-center justify-center rounded-button text-sm tabular-nums",
                            counted ? "bg-surface font-semibold text-surface-foreground" : "text-foreground",
                            isToday && "outline-2 outline-offset-0 outline-primary",
                          )}
                        >
                          <span aria-hidden>{Number(day.slice(8))}</span>
                          {counted ? (
                            <Check className="size-3" strokeWidth={3} aria-hidden />
                          ) : seconds > 0 ? (
                            <span className="mt-0.5 size-1.5 rounded-full bg-secondary" aria-hidden />
                          ) : (
                            <span className="h-3" aria-hidden />
                          )}
                          <span className="sr-only">
                            {counted
                              ? t("dayCounted", { date: label, minutes })
                              : seconds > 0
                                ? t("daySome", { date: label, minutes })
                                : t("dayNone", { date: label })}
                            {isToday ? ` (${t("legendToday")})` : ""}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-hidden>
            <li className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-[6px] bg-surface text-surface-foreground">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {t("legendCounted")}
            </li>
            <li className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-[6px] border border-border">
                <span className="size-1.5 rounded-full bg-secondary" />
              </span>
              {t("legendSome")}
            </li>
            <li className="flex items-center gap-2">
              <span className="size-6 rounded-[6px] outline-2 outline-primary" />
              {t("legendToday")}
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Past sessions */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl">{t("sessions")}</h2>
          {sessions.length > 0 && <p className="text-sm text-muted-foreground">{t("lastN", { count: sessions.length })}</p>}
        </div>
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-4">
              <p className="text-muted-foreground">{t("noSessions")}</p>
              <Button asChild>
                <Link href="/home">{t("start")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
            {sessions.map((s) => {
              const exam = isExamCode(s.exam) ? EXAMS[s.exam].label : s.exam.toUpperCase();
              const detail = s.mode === "mock" ? (s.mock_sets?.name ?? "") : s.parts.map((p) => `Part ${p}`).join(" + ");
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold text-primary">
                      {exam} · {tModes(s.mode)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatDayTime(new Date(s.started_at), locale, TIME_ZONE)}
                      {detail && ` · ${detail}`}
                    </span>
                  </div>
                  {s.mode === "mock" && (
                    <Badge variant={s.completed ? "surface" : "outline"}>{s.completed ? t("completed") : t("notFinished")}</Badge>
                  )}
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {t("minutesShort", { m: Math.floor(s.duration_seconds / 60) })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
