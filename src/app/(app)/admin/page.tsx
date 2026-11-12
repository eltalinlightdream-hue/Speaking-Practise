import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, FileJson, Layers, ListPlus, ListTree } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EXAMS, EXAM_CODES } from "@/config/exams";
import { contentStats } from "@/lib/content/queries";

export default async function AdminOverviewPage() {
  const t = await getTranslations("admin");
  const stats = await contentStats();

  const links = [
    { href: "/admin/content", label: t("nav.content"), icon: ListTree },
    { href: "/admin/add", label: t("nav.add"), icon: ListPlus },
    { href: "/admin/mock-sets", label: t("nav.mockSets"), icon: Layers },
    { href: "/admin/import-export", label: t("nav.importExport"), icon: FileJson },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("lead")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {EXAM_CODES.map((exam) => {
          const topics = stats.topics.filter((x) => x.exam === exam);
          const questions = stats.questions.filter((x) => x.topics.exam === exam);
          const mocks = stats.mocks.filter((x) => x.exam === exam);
          return (
            <Card key={exam}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  {EXAMS[exam].label}
                  {EXAMS[exam].placeholder && <Badge variant="outline">{t("content.placeholder")}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <dl className="grid grid-cols-3 gap-3">
                  {[
                    { label: t("stats.topics"), value: topics.filter((x) => x.active).length, total: topics.length },
                    { label: t("stats.questions"), value: questions.filter((x) => x.active).length, total: questions.length },
                    { label: t("stats.mockSets"), value: mocks.filter((x) => x.active).length, total: mocks.length },
                  ].map((s) => (
                    <div key={s.label} className="rounded-button bg-muted p-3">
                      <dt className="text-sm text-muted-foreground">{s.label}</dt>
                      <dd className="text-2xl font-semibold text-primary tabular-nums">{s.value}</dd>
                      {s.total !== s.value && (
                        <dd className="text-xs text-muted-foreground">{t("stats.activeOf", { active: s.value, total: s.total })}</dd>
                      )}
                    </div>
                  ))}
                </dl>
                <ul className="flex flex-wrap gap-2">
                  {EXAMS[exam].parts.map(({ part }) => {
                    const n = topics.filter((x) => x.part === part && x.active).length;
                    return (
                      <li key={part}>
                        <Link href={`/admin/content?exam=${exam}&part=${part}`}>
                          <Badge variant="surface" className="hover:bg-surface/80">
                            {t("stats.part", { part })}: {n}
                          </Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-14 items-center gap-3 rounded-card border border-border bg-card px-4 font-semibold text-primary transition-colors hover:bg-muted"
          >
            <Icon className="size-5" aria-hidden />
            <span className="flex-1">{label}</span>
            <ArrowRight className="size-5" aria-hidden />
          </Link>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{t("comingNext")}</p>
    </div>
  );
}
