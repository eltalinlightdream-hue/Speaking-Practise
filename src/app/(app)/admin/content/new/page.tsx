import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EXAMS, isExamCode } from "@/config/exams";
import { TopicForm } from "../topic-form";
import { loadLinkOptions } from "../link-options";

export default async function NewTopicPage({ searchParams }: PageProps<"/admin/content/new">) {
  const sp = await searchParams;
  const exam = isExamCode(sp.exam) ? sp.exam : "ielts";
  const partNum = Number(sp.part);
  const part = EXAMS[exam].parts.some((p) => p.part === partNum) ? partNum : 1;
  const t = await getTranslations("admin");
  const linkOptions = await loadLinkOptions();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/content" className="inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary">
        <ChevronLeft className="size-5" aria-hidden />
        {t("topic.back")}
      </Link>
      <h1 className="text-2xl">{t("topic.newTitle")}</h1>
      <Card>
        <CardContent>
          <TopicForm
            linkOptions={linkOptions}
            initial={{
              exam,
              part,
              title: "",
              is_core: false,
              active: true,
              cue_bullets: [],
              cue_explain: null,
              related_topic_id: null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
