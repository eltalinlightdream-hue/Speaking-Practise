import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EXAMS, partConfig } from "@/config/exams";
import { getTopic, getTopicQuestions } from "@/lib/content/queries";
import { createClient } from "@/lib/supabase/server";
import { TopicForm } from "../topic-form";
import { QuestionList } from "../question-list";
import { AddQuestions } from "../add-questions";
import { loadLinkOptions } from "../link-options";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TopicPage({ params }: PageProps<"/admin/content/[topicId]">) {
  const { topicId } = await params;
  if (!UUID.test(topicId)) notFound();
  const topic = await getTopic(topicId);
  if (!topic) notFound();

  const t = await getTranslations("admin");
  const supabase = await createClient();
  const [questions, linkOptions, usage] = await Promise.all([
    getTopicQuestions(topic.id),
    loadLinkOptions(),
    supabase.from("mock_set_topics").select("mock_set_id", { count: "exact", head: true }).eq("topic_id", topic.id),
  ]);

  const cfg = partConfig(topic.exam, topic.part);
  const isCue = cfg?.kind === "cue-card";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/admin/content?exam=${topic.exam}&part=${topic.part}`}
        className="inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary"
      >
        <ChevronLeft className="size-5" aria-hidden />
        {t("topic.back")}
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{EXAMS[topic.exam].label}</Badge>
          <Badge variant="outline">{t("stats.part", { part: topic.part })}</Badge>
          {!topic.active && <Badge variant="destructive">{t("topic.disabled")}</Badge>}
          {topic.is_placeholder && <Badge variant="warning">{t("content.placeholder")}</Badge>}
        </div>
        <h1 className="text-2xl">{topic.title}</h1>
        <p className="text-sm text-muted-foreground">{t("topic.usedInMocks", { count: usage.count ?? 0 })}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>{t("topic.details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TopicForm
              linkOptions={linkOptions}
              initial={{
                id: topic.id,
                exam: topic.exam,
                part: topic.part,
                title: topic.title,
                is_core: topic.is_core,
                active: topic.active,
                cue_bullets: topic.cue_bullets,
                cue_explain: topic.cue_explain,
                related_topic_id: topic.related_topic_id,
              }}
            />
          </CardContent>
        </Card>

        {isCue ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("topic.cuePreview")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div lang="en" className="rounded-card bg-surface/40 p-5">
                <p className="text-lg font-semibold text-primary">{topic.title}</p>
                <p className="mt-3 font-semibold">{t("topic.youShouldSay")}</p>
                <ul className="mt-1 list-disc pl-6">
                  {topic.cue_bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                {topic.cue_explain && <p className="mt-1">{topic.cue_explain}</p>}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("add.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <AddQuestions topicId={topic.id} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {!isCue && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl">
            {t("topic.questions")} ({questions.filter((q) => q.active).length})
          </h2>
          <QuestionList questions={questions} />
        </section>
      )}
    </div>
  );
}
