import { getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EXAMS, EXAM_CODES } from "@/config/exams";
import { ImportForm } from "./import-form";

export default async function ImportExportPage() {
  const t = await getTranslations("admin");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t("io.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("io.exportTitle")}</CardTitle>
          <CardDescription className="text-base">{t("io.exportLead")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {/* Plain links: the browser downloads the file. */}
          <Button asChild>
            <a href="/admin/export" download>
              <Download aria-hidden />
              {t("io.download")}
            </a>
          </Button>
          {EXAM_CODES.map((e) => (
            <Button key={e} asChild variant="outline">
              <a href={`/admin/export?exam=${e}`} download>
                <Download aria-hidden />
                {EXAMS[e].label}
              </a>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("io.importTitle")}</CardTitle>
          <CardDescription className="text-base">{t("io.importLead")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
