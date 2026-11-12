import { getTranslations } from "next-intl/server";
import { ChevronRight, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireProfile } from "@/lib/auth";

export default async function HomePage() {
  const profile = await requireProfile();
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const firstName = (profile.full_name ?? "").split(" ")[0];
  // Practice time is tracked from Step 3; until then today's minutes are 0.
  const minutesToday = 0;

  const exams = [
    { key: "ielts", title: t("ielts"), text: t("ieltsText") },
    { key: "cefr", title: t("cefr"), text: t("cefrText") },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl sm:text-3xl">{t("greeting", { name: firstName })}</h1>
        <Card>
          <CardContent className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Flame className="size-6" aria-hidden />
            </span>
            <div className="flex flex-1 flex-col gap-2">
              <p className="font-semibold">{t("today", { minutes: minutesToday })}</p>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={15}
                aria-valuenow={minutesToday}
              >
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (minutesToday / 15) * 100)}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">{t("chooseExam")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {exams.map((exam) => (
            <Card key={exam.key}>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-2xl font-semibold text-primary">{exam.title}</h3>
                    <p className="text-sm text-muted-foreground">{exam.text}</p>
                  </div>
                  <Badge variant="outline">{tc("comingSoon")}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {[t("generalTraining"), t("mockTest")].map((mode) => (
                    <div
                      key={mode}
                      aria-disabled="true"
                      className="flex min-h-12 items-center justify-between rounded-button border border-border bg-muted px-4 font-semibold text-muted-foreground"
                    >
                      {mode}
                      <ChevronRight className="size-5" aria-hidden />
                    </div>
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
