import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressView } from "@/components/progress/progress-view";
import { WeeklyReportDownload } from "@/components/report/weekly-report-download";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadProgress } from "@/lib/practice/progress-data";
import { weekDays, weekStart } from "@/lib/practice/calendar";
import { formatDay } from "@/lib/format-date";
import { DeleteUser, KeptToggle, RoleSwitch } from "../student-actions";

type Target = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "student" | "admin" | "owner";
  kept: boolean;
  created_at: string;
  lesson_groups: { name: string } | null;
};

export default async function StudentPage({ params, searchParams }: PageProps<"/admin/students/[id]">) {
  const viewer = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await getTranslations("admin.students");
  const tr = await getTranslations("admin.reports");
  const tRoles = await getTranslations("roles");
  const ts = await getTranslations("settings");
  const locale = await getLocale();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, kept, created_at, lesson_groups(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const target = data as unknown as Target;
  const name = target.full_name || target.email || "—";

  const progress = await loadProgress(target.id, (await searchParams).month);
  const weekSeconds = weekDays(weekStart(progress.summary.today)).reduce((sum, d) => sum + (progress.summary.secondsByDay.get(d) ?? 0), 0);

  const isSelf = target.id === viewer.id;
  const viewerIsOwner = viewer.role === "owner";
  const deleteNote =
    target.role === "owner" ? t("cannotDeleteOwner") : target.role === "admin" && !viewerIsOwner ? t("cannotDeleteAdmin") : null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/students" className="inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary">
        <ChevronLeft className="size-5" aria-hidden />
        {t("back")}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 break-words text-2xl">{name}</h1>
        <Badge>{tRoles(target.role)}</Badge>
      </div>

      <Card>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              { label: t("email"), value: target.email ?? "—" },
              { label: t("group"), value: target.lesson_groups?.name ?? tr("noGroup") },
              { label: t("joined"), value: formatDay(target.created_at.slice(0, 10), locale) },
              { label: t("thisWeek"), value: tr("minutesValue", { m: Math.floor(weekSeconds / 60) }) },
            ].map((row) => (
              <div key={row.label} className="flex min-w-0 flex-col">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="break-all font-semibold">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <ProgressView data={progress} basePath={`/admin/students/${target.id}`} showStart={false} />
      <WeeklyReportDownload userId={target.id} />

      {!isSelf && (
        <Card>
          <CardHeader>
            <CardTitle>{ts("accountTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-primary">{t("keptTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("keptHelp")}</p>
              <KeptToggle userId={target.id} kept={target.kept} />
            </div>

            {viewerIsOwner && target.role !== "owner" && (
              <div className="flex flex-col gap-2 border-t border-border pt-5">
                <h3 className="font-semibold text-primary">{t("role")}</h3>
                <p className="text-sm text-muted-foreground">{t("roleHelp")}</p>
                <RoleSwitch userId={target.id} role={target.role as "student" | "admin"} />
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-border pt-5">
              <h3 className="font-semibold text-primary">{t("deleteTitle")}</h3>
              {deleteNote ? (
                <p className="text-sm text-muted-foreground">{deleteNote}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{t("deleteLead")}</p>
                  <DeleteUser userId={target.id} name={name} />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
