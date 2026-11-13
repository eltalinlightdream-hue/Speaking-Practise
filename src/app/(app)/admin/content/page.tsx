import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXAMS, EXAM_CODES, isExamCode } from "@/config/exams";
import { listTopics } from "@/lib/content/queries";

export default async function ContentPage({ searchParams }: PageProps<"/admin/content">) {
  const sp = await searchParams;
  const exam = isExamCode(sp.exam) ? sp.exam : "ielts";
  const part = Number(sp.part) || undefined;
  const search = typeof sp.q === "string" ? sp.q.trim() : "";
  const includeDisabled = sp.all === "1";

  const t = await getTranslations("admin");
  const topics = await listTopics({ exam, part, search, includeDisabled });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">{t("content.title")}</h1>
        <Button asChild>
          <Link href={`/admin/content/new?exam=${exam}&part=${part ?? 1}`}>
            <Plus aria-hidden />
            {t("content.newTopic")}
          </Link>
        </Button>
      </div>

      <form className="grid gap-3 rounded-card border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_2fr_auto]" method="get">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-exam">{t("content.exam")}</Label>
          <NativeSelect id="f-exam" name="exam" defaultValue={exam}>
            {EXAM_CODES.map((e) => (
              <option key={e} value={e}>
                {EXAMS[e].label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-part">{t("content.part")}</Label>
          <NativeSelect id="f-part" name="part" defaultValue={part ? String(part) : ""}>
            <option value="">{t("content.allParts")}</option>
            {EXAMS[exam].parts.map((p) => (
              <option key={p.part} value={p.part}>
                {t("stats.part", { part: p.part })}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-q">{t("content.search")}</Label>
          <Input id="f-q" name="q" defaultValue={search} type="search" />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex min-h-6 items-center gap-2 text-sm">
            <input type="checkbox" name="all" value="1" defaultChecked={includeDisabled} className="size-4 accent-primary" />
            {t("content.showDisabled")}
          </label>
          <Button type="submit" variant="secondary">
            <Search aria-hidden />
            {t("content.filter")}
          </Button>
        </div>
      </form>

      {topics.length === 0 ? (
        <p className="text-muted-foreground">{t("content.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
          {topics.map((topic) => {
            const isCue = topic.part === 2 && topic.exam === "ielts";
            return (
              <li key={topic.id}>
                <Link
                  href={`/admin/content/${topic.id}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
                >
                  <Badge variant="outline" className="shrink-0">
                    {t("stats.part", { part: topic.part })}
                  </Badge>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className={topic.active ? "font-semibold text-primary" : "font-semibold text-muted-foreground line-through"}>
                      {topic.title}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {isCue || topic.cue_bullets.length > 0
                        ? t("content.cueCard")
                        : t("content.questionsCount", { count: topic.question_count })}
                      {topic.related_title ? ` · ${t("content.linkedTo", { title: topic.related_title })}` : ""}
                    </span>
                  </div>
                  {!topic.active && <Badge variant="destructive">{t("topic.disabled")}</Badge>}
                  {topic.is_placeholder && <Badge variant="warning">{t("content.placeholder")}</Badge>}
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
