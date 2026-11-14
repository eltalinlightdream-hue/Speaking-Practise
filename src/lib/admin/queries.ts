import "server-only";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { GROUP_COLUMNS, groupIdsFor, groupLabel, type GroupFilterValue, type LessonGroup } from "@/lib/groups";
import { addDays, tashkentDay, type Day } from "@/lib/practice/streak";
import { buildWeeklyReport, type DailyTotal, type GroupRef, type StudentRef } from "./report";

/** How far back to look for the current streak. */
const STREAK_DAYS = 400;

/** Every group (also disabled ones), sorted, with `name` in the page language. */
export async function loadGroups(): Promise<(GroupRef & LessonGroup)[]> {
  const supabase = await createClient();
  const t = await getTranslations("groups");
  const { data, error } = await supabase.from("lesson_groups").select(GROUP_COLUMNS).order("sort_order").order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as LessonGroup[]).map((g) => ({ ...g, name: groupLabel(g, (p) => t(p)) }));
}

/** Students only (admins and the owner are not in the reports); `groupIds` null = all groups. */
export async function loadStudents(groupIds: string[] | null = null): Promise<StudentRef[]> {
  const supabase = await createClient();
  let q = supabase.from("profiles").select("id, full_name, email, lesson_group_id").eq("role", "student");
  if (groupIds) q = q.in("lesson_group_id", groupIds);
  const { data, error } = await q.order("full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Daily totals from `from` to `to` (admins only; the database checks). */
export async function loadDailyTotals(from: Day, to: Day): Promise<DailyTotal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_daily_totals", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyTotal[];
}

/** The week's report for all groups, one teacher's groups, or one group. */
export async function loadWeeklyReport(monday: Day, filter: GroupFilterValue) {
  const today = tashkentDay();
  const sunday = addDays(monday, 6);
  const from = addDays(monday < today ? monday : today, -STREAK_DAYS);
  const to = sunday > today ? sunday : today;
  const [groups, totals] = await Promise.all([loadGroups(), loadDailyTotals(from, to)]);
  const ids = groupIdsFor(groups, filter);
  const students = await loadStudents(ids);
  // Every group (also disabled ones), so no student lands under "No group" by mistake.
  const shownGroups = ids ? groups.filter((g) => ids.includes(g.id)) : groups;
  return { groups, report: buildWeeklyReport(students, shownGroups, totals, monday) };
}
