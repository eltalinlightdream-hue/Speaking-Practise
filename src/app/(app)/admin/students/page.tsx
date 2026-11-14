import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BadgeCheck, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { loadDailyTotals, loadGroups } from "@/lib/admin/queries";
import { buildWeeklyReport } from "@/lib/admin/report";
import { weekStart } from "@/lib/practice/calendar";
import { addDays, tashkentDay } from "@/lib/practice/streak";
import { formatDay } from "@/lib/format-date";
import { GroupFilter } from "@/components/group-filter";
import { requireAdmin } from "@/lib/auth";
import { groupIdsFor, readGroupFilter, selectedTeacher } from "@/lib/groups";
import { StudentMenuGroups, StudentRowMenu } from "./student-row-menu";

const LIMIT = 200;

type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  lesson_group_id: string | null;
  role: "student" | "admin" | "owner";
  kept: boolean;
};

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  const viewer = await requireAdmin();
  const t = await getTranslations("admin.students");
  const tr = await getTranslations("admin.reports");
  const tRoles = await getTranslations("roles");
  const locale = await getLocale();
  const sp = await searchParams;
  // Keep only letters, numbers, spaces, dots, @ and dashes: safe inside the filter below.
  const q = (typeof sp.q === "string" ? sp.q : "").replace(/[^\p{L}\p{N}\s.@ʻʼ'-]/gu, "").trim().slice(0, 60);
  const viewerIsOwner = viewer.role === "owner";
  const filter = readGroupFilter(sp);
  const group = filter.group;

  const supabase = await createClient();
  const today = tashkentDay();
  const [groups, totals] = await Promise.all([loadGroups(), loadDailyTotals(addDays(today, -400), today)]);
  const ids = groupIdsFor(groups, filter);
  const teacher = selectedTeacher(groups, filter);

  let query = supabase.from("profiles").select("id, full_name, email, lesson_group_id, role, kept", { count: "exact" });
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  if (ids) query = query.in("lesson_group_id", ids);
  const profiles = await query.order("full_name", { nullsFirst: false }).limit(LIMIT);
  if (profiles.error) throw new Error(profiles.error.message);
  const rows = (profiles.data ?? []) as Row[];
  const total = profiles.count ?? rows.length;

  const report = buildWeeklyReport(rows, groups, totals, weekStart(today));
  const stats = new Map(report.students.map((s) => [s.id, s]));
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? tr("noGroup");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("lead")}</p>
      </div>

      <form method="get" action="/admin/students" className="flex gap-2" role="search">
        {group && <input type="hidden" name="group" value={group} />}
        {!group && teacher && <input type="hidden" name="teacher" value={teacher} />}
        <label htmlFor="q" className="sr-only">
          {t("search")}
        </label>
        <Input id="q" name="q" type="search" defaultValue={q} placeholder={t("search")} className="flex-1" />
        <Button type="submit" variant="outline" size="icon" aria-label={t("searchButton")} title={t("searchButton")}>
          <Search aria-hidden />
        </Button>
      </form>

      <GroupFilter groups={groups.filter((g) => g.active || g.id === group)} value={filter} path="/admin/students" params={q ? { q } : {}} />

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {t("count", { count: total })}
          {total > rows.length && ` · ${t("limited", { count: rows.length })}`}
        </p>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <StudentMenuGroups groups={groups}>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
            {rows.map((r) => {
              const s = stats.get(r.id);
              return (
                <li key={r.id} className="flex items-center hover:bg-muted">
                  <Link href={`/admin/students/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-1 pl-4">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 truncate font-semibold text-primary">{r.full_name || r.email}</span>
                        {r.role !== "student" && <Badge variant="outline">{tRoles(r.role)}</Badge>}
                        {r.kept && (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                            <BadgeCheck className="size-4" aria-hidden />
                            {t("keptTitle")}
                          </span>
                        )}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {groupName(r.lesson_group_id)} · {t("thisWeek")}: {tr("minutesValue", { m: Math.floor((s?.weekSeconds ?? 0) / 60) })} ·{" "}
                        {tr("streak")}: {tr("streakValue", { n: s?.currentStreak ?? 0 })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {tr("lastActive")}: {s?.lastActive ? formatDay(s.lastActive, locale) : tr("never")}
                      </span>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                  <div className="pr-2">
                    <StudentRowMenu
                      userId={r.id}
                      displayName={r.full_name || r.email || "—"}
                      fullName={r.full_name ?? ""}
                      groupId={r.lesson_group_id}
                      canEdit={r.role === "student" || viewerIsOwner || r.id === viewer.id}
                      canDelete={r.id !== viewer.id && r.role !== "owner" && (r.role === "student" || viewerIsOwner)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          </StudentMenuGroups>
        )}
      </div>
    </div>
  );
}
