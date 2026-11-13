import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { isExamCode } from "@/config/exams";
import { GeneralTraining } from "./general-training";

export default async function GeneralTrainingPage({ params }: PageProps<"/practice/[exam]/general">) {
  const { exam } = await params;
  if (!isExamCode(exam)) notFound();
  const t = await getTranslations("practice");
  return (
    <div className="flex flex-col gap-4">
      <Link href="/home" className="inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary">
        <ChevronLeft className="size-5" aria-hidden />
        {t("back")}
      </Link>
      <GeneralTraining exam={exam} />
    </div>
  );
}
