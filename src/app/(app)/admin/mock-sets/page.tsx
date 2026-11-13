import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EXAMS, EXAM_CODES, isExamCode } from "@/config/exams";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  mock_set_topics: { part: number; sort_order: number; topics: { title: string } }[];
};

export default async function MockSetsPage({ searchParams }: PageProps<"/admin/mock-sets">) {
  const sp = await searchParams;
  const exam = isExamCode(sp.exam) ? sp.exam : "ielts";
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mock_sets")
    .select("id, name, active, sort_order, mock_set_topics(part, sort_order, topics(title))")
    .eq("exam", exam)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  const sets = (data ?? []) as unknown as Row[];
  const parts = EXAMS[exam].parts.map((p) => p.part);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl">{t("mocks.title")}</h1>
          <p className="text-muted-foreground">
            {t("stats.activeOf", { active: sets.filter((s) => s.active).length, total: sets.length })}
          </p>
        </div>
        <Button asChild>
          <Link href={`/admin/mock-sets/new?exam=${exam}`}>
            <Plus aria-hidden />
            {t("mocks.newSet")}
          </Link>
        </Button>
      </div>

      <div role="tablist" aria-label={t("content.exam")} className="inline-flex self-start rounded-button border border-border bg-card p-1">
        {EXAM_CODES.map((e) => (
          <Link
            key={e}
            role="tab"
            aria-selected={e === exam}
            href={`/admin/mock-sets?exam=${e}`}
            className={
              e === exam
                ? "min-h-9 rounded-[8px] bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"
                : "min-h-9 rounded-[8px] px-4 py-1.5 text-sm font-semibold text-primary hover:bg-muted"
            }
          >
            {EXAMS[e].label}
          </Link>
        ))}
      </div>

      {sets.length === 0 ? (
        <p className="text-muted-foreground">{t("mocks.empty")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {sets.map((s) => {
            const missing = parts.filter((p) => !s.mock_set_topics.some((mt) => mt.part === p));
            return (
              <li key={s.id} className="min-w-0">
                <Link
                  href={`/admin/mock-sets/${s.id}`}
                  className="flex h-full min-w-0 flex-col gap-2 rounded-card border border-border bg-card p-4 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <span className={s.active ? "flex-1 font-semibold text-primary" : "flex-1 font-semibold text-muted-foreground line-through"}>
                      {s.name}
                    </span>
                    {!s.active && <Badge variant="destructive">{t("mocks.disabled")}</Badge>}
                    {missing.map((p) => (
                      <Badge key={p} variant="warning">
                        {t("mocks.missingPart", { part: p })}
                      </Badge>
                    ))}
                    <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                  <ul className="flex flex-col gap-1 text-sm">
                    {[...s.mock_set_topics]
                      .sort((a, b) => a.part - b.part || a.sort_order - b.sort_order)
                      .map((mt, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="w-14 shrink-0 font-semibold text-primary">{t("stats.part", { part: mt.part })}</span>
                          <span className="min-w-0 break-words text-foreground">{mt.topics.title}</span>
                        </li>
                      ))}
                  </ul>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
