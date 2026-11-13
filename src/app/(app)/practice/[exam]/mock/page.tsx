import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EXAMS, isExamCode } from "@/config/exams";
import { requireProfile } from "@/lib/auth";
import { findNextMock } from "@/lib/practice/mock";
import { MockTest } from "./mock-test";

export default async function MockTestPage({ params }: PageProps<"/practice/[exam]/mock">) {
  const { exam } = await params;
  if (!isExamCode(exam)) notFound();
  const profile = await requireProfile();
  const t = await getTranslations("practice");
  const next = await findNextMock(profile.id, exam);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/home" className="inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary">
        <ChevronLeft className="size-5" aria-hidden />
        {t("back")}
      </Link>
      {next ? (
        <MockTest exam={exam} next={next} />
      ) : (
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl">{t("mockTitle", { exam: EXAMS[exam].label })}</h1>
          <Card>
            <CardContent className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-surface-foreground">
                <FileQuestion className="size-5" aria-hidden />
              </span>
              <p className="text-muted-foreground">{t("mock.none")}</p>
            </CardContent>
          </Card>
          <Button asChild className="self-start">
            <Link href={`/practice/${exam}/general`}>{t("mock.tryGeneral")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
