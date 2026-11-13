import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/coming-soon";
import { EXAMS, isExamCode } from "@/config/exams";

// Mock tests are built in Step 4.
export default async function MockTestPage({ params }: PageProps<"/practice/[exam]/mock">) {
  const { exam } = await params;
  if (!isExamCode(exam)) notFound();
  const t = await getTranslations("practice");
  const tHome = await getTranslations("home");
  return (
    <div className="flex flex-col gap-4">
      <Link href="/home" className="inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary">
        <ChevronLeft className="size-5" aria-hidden />
        {t("back")}
      </Link>
      <ComingSoon title={t("mockTitle", { exam: EXAMS[exam].label })} lead={t("mockSoon")} />
      <Button asChild className="self-start">
        <Link href={`/practice/${exam}/general`}>{tHome("generalTraining")}</Link>
      </Button>
    </div>
  );
}
