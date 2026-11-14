import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EXAMS, isExamCode, partConfig } from "@/config/exams";
import { getTopic, listTopicTitles } from "@/lib/content/queries";
import { AddQuestions } from "../content/add-questions";
import { AddPicker } from "./add-picker";
import { NEW_TOPIC } from "./new-topic";
import { NewTopicInline } from "./new-topic-inline";

// Choose exam, part and topic (or create a new topic here), then add questions.
export default async function AddQuestionsPage({ searchParams }: PageProps<"/admin/add">) {
  const sp = await searchParams;
  const exam = isExamCode(sp.exam) ? sp.exam : "ielts";
  const partNum = Number(sp.part);
  const part = EXAMS[exam].parts.some((p) => p.part === partNum) ? partNum : 1;
  const topicId = typeof sp.topic === "string" ? sp.topic : "";

  const t = await getTranslations("admin");
  const cfg = partConfig(exam, part);
  const isCue = cfg?.kind === "cue-card";
  const creating = topicId === NEW_TOPIC && !isCue;
  const topics = await listTopicTitles(exam, part);
  const selected = topicId && topics.some((x) => x.id === topicId) ? await getTopic(topicId) : null;
  // Part 3 topics can point at a Part 2 cue card.
  const linkOptions = creating && cfg?.linkedToPart ? (await listTopicTitles(exam, cfg.linkedToPart)).map(({ id, title }) => ({ id, title })) : null;
  const justCreated = sp.created === "1" && selected;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl">{t("add.title")}</h1>
        <p className="text-muted-foreground">{t("add.lead")}</p>
      </div>

      <AddPicker exam={exam} part={part} topic={creating ? NEW_TOPIC : (selected?.id ?? "")} topics={topics} canCreate={!isCue} />

      {isCue && <p className="text-muted-foreground">{t("add.notCueCard")}</p>}

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle>{t("add.newTopicTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {EXAMS[exam].label} · {t("stats.part", { part })}. {t("add.newTopicLead")}
            </p>
          </CardHeader>
          <CardContent>
            <NewTopicInline exam={exam} part={part} linkOptions={linkOptions} cancelHref={`/admin/add?exam=${exam}&part=${part}`} />
          </CardContent>
        </Card>
      )}

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
          <CardContent className="flex flex-col gap-4">
            {justCreated && (
              <p role="status" className="flex items-center gap-2 rounded-button bg-surface px-3 py-2 text-sm font-semibold text-surface-foreground">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                {t("add.created")}
              </p>
            )}
            <AddQuestions topicId={selected.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
