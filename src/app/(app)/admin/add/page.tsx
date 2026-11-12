import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/input";
import { EXAMS, EXAM_CODES, isExamCode, partConfig } from "@/config/exams";
import { getTopic, listTopicTitles } from "@/lib/content/queries";
import { AddQuestions } from "../content/add-questions";

// Choose exam, part and topic (a simple GET form), then add questions.
export default async function AddQuestionsPage({ searchParams }: PageProps<"/admin/add">) {
  const sp = await searchParams;
  const exam = isExamCode(sp.exam) ? sp.exam : "ielts";
  const partNum = Number(sp.part);
  const part = EXAMS[exam].parts.some((p) => p.part === partNum) ? partNum : 1;
  const topicId = typeof sp.topic === "string" ? sp.topic : "";

  const t = await getTranslations("admin");
  const topics = await listTopicTitles(exam, part);
  const selected = topicId && topics.some((x) => x.id === topicId) ? await getTopic(topicId) : null;
  const isCue = partConfig(exam, part)?.kind === "cue-card";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl">{t("add.title")}</h1>
        <p className="text-muted-foreground">{t("add.lead")}</p>
      </div>

      <form method="get" className="grid gap-3 rounded-card border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="a-exam">{t("content.exam")}</Label>
          <NativeSelect id="a-exam" name="exam" defaultValue={exam}>
            {EXAM_CODES.map((e) => (
              <option key={e} value={e}>
                {EXAMS[e].label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="a-part">{t("content.part")}</Label>
          <NativeSelect id="a-part" name="part" defaultValue={String(part)}>
            {EXAMS[exam].parts.map((p) => (
              <option key={p.part} value={p.part}>
                {t("stats.part", { part: p.part })}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="a-topic">{t("add.chooseTopic")}</Label>
          <NativeSelect id="a-topic" name="topic" defaultValue={selected?.id ?? ""}>
            <option value="">{t("add.pickTopic")}</option>
            {topics.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
                {x.active ? "" : ` (${t("topic.disabled")})`}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary">
          {t("add.open")}
        </Button>
      </form>

      {isCue && <p className="text-muted-foreground">{t("add.notCueCard")}</p>}

      {selected && !isCue && (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>{selected.title}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/content/${selected.id}`}>
                <ExternalLink aria-hidden />
                {t("mocks.edit")}
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <AddQuestions topicId={selected.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
