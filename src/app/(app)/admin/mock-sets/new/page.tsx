import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EXAMS, isExamCode } from "@/config/exams";
import { createClient } from "@/lib/supabase/server";
import { MockSetEditor } from "../mock-set-editor";
import { loadPartOptions } from "../load-options";

export default async function NewMockSetPage({ searchParams }: PageProps<"/admin/mock-sets/new">) {
  const sp = await searchParams;
  const exam = isExamCode(sp.exam) ? sp.exam : "ielts";
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const [options, last] = await Promise.all([
    loadPartOptions(exam),
    supabase.from("mock_sets").select("sort_order").eq("exam", exam).order("sort_order", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/admin/mock-sets?exam=${exam}`} className="inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary">
        <ChevronLeft className="size-5" aria-hidden />
        {t("mocks.back")}
      </Link>
      <h1 className="text-2xl">
        {t("mocks.newSet")} · {EXAMS[exam].label}
      </h1>
      <Card>
        <CardContent>
          <MockSetEditor
            options={options}
            initial={{ exam, name: "", active: true, sort_order: (last.data?.sort_order ?? 0) + 1, parts: {} }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
