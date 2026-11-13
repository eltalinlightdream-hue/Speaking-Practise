import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, tashkentDay, type Day } from "@/lib/practice/streak";
import { buildWeeklyReport, type DailyTotal, type GroupRef, type StudentRef } from "./report";

/** How far back to look for the current streak. */
const STREAK_DAYS = 400;

export async function loadGroups(): Promise<(GroupRef & { active: boolean })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lesson_groups").select("id, name, active").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Students only (admins and the owner are not in the reports). */
export async function loadStudents(groupId?: string | null): Promise<StudentRef[]> {
  const supabase = await createClient();
  let q = supabase.from("profiles").select("id, full_name, email, lesson_group_id").eq("role", "student");
  if (groupId) q = q.eq("lesson_group_id", groupId);
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

export async function loadWeeklyReport(monday: Day, groupId: string | null) {
  const today = tashkentDay();
  const sunday = addDays(monday, 6);
  const from = addDays(monday < today ? monday : today, -STREAK_DAYS);
  const to = sunday > today ? sunday : today;
  const [groups, students, totals] = await Promise.all([loadGroups(), loadStudents(groupId), loadDailyTotals(from, to)]);
  // Every group (also disabled ones), so no student lands under "No group" by mistake.
  const shownGroups = groupId ? groups.filter((g) => g.id === groupId) : groups;
  return { groups, report: buildWeeklyReport(students, shownGroups, totals, monday) };
}
