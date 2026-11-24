import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EXAMS, EXAM_CODES } from "@/config/exams";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DAY_GOAL_SECONDS, addDays, summarise, tashkentDay } from "@/lib/practice/streak";

export default async function HomePage() {
  const profile = await requireProfile();
  const t = await getTranslations("home");
  const tAdmin = await getTranslations("admin.content");
  const firstName = (profile.full_name ?? "").split(" ")[0];

  const supabase = await createClient();
  // Enough days back for any streak; the streak rules live in one shared place.
  const { data: rows } = await supabase
    .from("practice_sessions")
    .select("day_tashkent, duration_seconds")
    .eq("user_id", profile.id)
    .gte("day_tashkent", addDays(tashkentDay(), -400));
  const { secondsToday, minutesToday, current } = summarise(rows ?? []);

  const exams = EXAM_CODES.map((code) => ({
    code,
    title: t(code),
    text: code === "ielts" ? t("ieltsText") : t("cefrText"),
    placeholder: EXAMS[code].placeholder,
  }));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl sm:text-3xl">{t("greeting", { name: firstName })}</h1>
        <Link
          href="/progress"
          className="rounded-card transition-colors [&>div]:hover:bg-muted"
          title={t("seeProgress")}
        >
        <Card>
          <CardContent className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Flame className="size-6" aria-hidden />
            </span>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-semibold">{t("streak", { count: current })}</p>
                <p className="text-sm text-muted-foreground tabular-nums">{t("today", { minutes: minutesToday })}</p>
              </div>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={15}
                aria-valuenow={Math.min(15, minutesToday)}
                aria-label={t("today", { minutes: minutesToday })}
              >
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (secondsToday / DAY_GOAL_SECONDS) * 100)}%` }} />
              </div>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">{t("seeProgress")}</span>
          </CardContent>
        </Card>
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">{t("chooseExam")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {exams.map((exam) => (
            <Card key={exam.code}>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-2xl font-semibold text-primary">{exam.title}</h3>
                    <p className="text-sm text-muted-foreground">{exam.text}</p>
                  </div>
                  {exam.placeholder && <Badge variant="outline">{tAdmin("placeholder")}</Badge>}
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    { href: `/practice/${exam.code}/general`, label: t("generalTraining") },
                    { href: `/practice/${exam.code}/mock`, label: t("mockTest") },
                  ].map((m) => (
                    <Link
                      key={m.href}
                      href={m.href}
                      className="flex min-h-12 items-center justify-between rounded-button border border-border bg-card px-4 font-semibold text-primary transition-colors hover:bg-surface"
                    >
                      {m.label}
                      <ChevronRight className="size-5" aria-hidden />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
