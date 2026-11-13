import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EXAMS, type ExamCode } from "@/config/exams";
import { createClient } from "@/lib/supabase/server";
import { MockSetEditor } from "../mock-set-editor";
import { loadPartOptions } from "../load-options";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MockSetPage({ params }: PageProps<"/admin/mock-sets/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const { data } = await supabase
    .from("mock_sets")
    .select("id, exam, name, active, sort_order, mock_set_topics(topic_id, part, sort_order)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const set = data as {
    id: string;
    exam: ExamCode;
    name: string;
    active: boolean;
    sort_order: number;
    mock_set_topics: { topic_id: string; part: number; sort_order: number }[];
  };
  const parts: Record<number, string[]> = {};
  for (const mt of [...set.mock_set_topics].sort((a, b) => a.sort_order - b.sort_order)) {
    (parts[mt.part] ??= []).push(mt.topic_id);
  }
  const options = await loadPartOptions(set.exam);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/admin/mock-sets?exam=${set.exam}`} className="inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary">
        <ChevronLeft className="size-5" aria-hidden />
        {t("mocks.back")}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{EXAMS[set.exam].label}</Badge>
        {!set.active && <Badge variant="destructive">{t("mocks.disabled")}</Badge>}
      </div>
      <h1 className="-mt-4 text-2xl">{set.name}</h1>
      <Card>
        <CardContent>
          <MockSetEditor
            key={set.id}
            options={options}
            initial={{ id: set.id, exam: set.exam, name: set.name, active: set.active, sort_order: set.sort_order, parts }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
