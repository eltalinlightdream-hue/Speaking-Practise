// Weekly report for teachers and admins. Pure functions (easy to test):
// the page loads the data, this file does the sums.

import { DAY_GOAL_SECONDS, summarise, type Day } from "../practice/streak.ts";
import { weekDays } from "../practice/calendar.ts";

/** One student's total for one Tashkent day (from admin_daily_totals). */
export type DailyTotal = { user_id: string; day: Day; seconds: number; sessions: number; mocks_completed: number };

export type StudentRef = { id: string; full_name: string | null; email: string | null; lesson_group_id: string | null };
export type GroupRef = { id: string; name: string };

export type StudentWeek = {
  id: string;
  name: string;
  email: string | null;
  groupId: string | null;
  /** Seconds practised in the week. */
  weekSeconds: number;
  /** Days in the week that reached 15 minutes. */
  countedDays: number;
  sessions: number;
  mocksCompleted: number;
  /** Streak as of today (not as of the week). */
  currentStreak: number;
  /** Last day with any practice (any week), or null. */
  lastActive: Day | null;
};

export type GroupWeek = {
  groupId: string | null;
  name: string | null;
  students: number;
  /** Students with at least one session in the week. */
  active: number;
  weekSeconds: number;
  countedDays: number;
  mocksCompleted: number;
};

export type WeeklyReport = { days: Day[]; students: StudentWeek[]; groups: GroupWeek[]; total: GroupWeek };

/**
 * @param totals daily totals covering the week AND enough days before today
 *               for the current streak (the page loads about 400 days).
 */
export function buildWeeklyReport(
  students: readonly StudentRef[],
  groups: readonly GroupRef[],
  totals: readonly DailyTotal[],
  monday: Day,
  now: Date = new Date(),
): WeeklyReport {
  const days = weekDays(monday);
  const inWeek = new Set(days);

  const byUser = new Map<string, DailyTotal[]>();
  for (const t of totals) {
    const list = byUser.get(t.user_id);
    if (list) list.push(t);
    else byUser.set(t.user_id, [t]);
  }

  const rows: StudentWeek[] = students.map((s) => {
    const own = byUser.get(s.id) ?? [];
    const week = own.filter((t) => inWeek.has(t.day));
    const summary = summarise(own.map((t) => ({ day_tashkent: t.day, duration_seconds: t.seconds })), now);
    return {
      id: s.id,
      name: s.full_name?.trim() || s.email || "—",
      email: s.email,
      groupId: s.lesson_group_id,
      weekSeconds: week.reduce((sum, t) => sum + t.seconds, 0),
      countedDays: week.filter((t) => t.seconds >= DAY_GOAL_SECONDS).length,
      sessions: week.reduce((sum, t) => sum + t.sessions, 0),
      mocksCompleted: week.reduce((sum, t) => sum + t.mocks_completed, 0),
      currentStreak: summary.current,
      lastActive: own.reduce<Day | null>((last, t) => (t.seconds > 0 && (!last || t.day > last) ? t.day : last), null),
    };
  });

  // Most practice first, then by name.
  rows.sort((a, b) => b.weekSeconds - a.weekSeconds || a.name.localeCompare(b.name));

  const sum = (list: StudentWeek[], groupId: string | null, name: string | null): GroupWeek => ({
    groupId,
    name,
    students: list.length,
    active: list.filter((r) => r.sessions > 0).length,
    weekSeconds: list.reduce((s, r) => s + r.weekSeconds, 0),
    countedDays: list.reduce((s, r) => s + r.countedDays, 0),
    mocksCompleted: list.reduce((s, r) => s + r.mocksCompleted, 0),
  });

  const known = new Set(groups.map((g) => g.id));
  const groupRows = groups.map((g) => sum(rows.filter((r) => r.groupId === g.id), g.id, g.name));
  const noGroup = rows.filter((r) => !r.groupId || !known.has(r.groupId));
  if (noGroup.length) groupRows.push(sum(noGroup, null, null));

  return { days, students: rows, groups: groupRows, total: sum(rows, null, null) };
}

/** CSV text for a spreadsheet (Excel and Google Sheets open it). */
export function reportCsv(report: WeeklyReport, groupName: (id: string | null) => string): string {
  const header = ["Name", "Email", "Group", "Minutes this week", "Days with 15+ min", "Sessions", "Mock tests finished", "Current streak (days)", "Last active"];
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    // Quote every cell; a leading = + - @ is made safe for spreadsheets.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = report.students.map((r) =>
    [r.name, r.email, groupName(r.groupId), Math.floor(r.weekSeconds / 60), r.countedDays, r.sessions, r.mocksCompleted, r.currentStreak, r.lastActive]
      .map(cell)
      .join(","),
  );
  // The BOM makes Excel read Uzbek letters (oʻ, gʻ) correctly.
  return "﻿" + [header.map(cell).join(","), ...lines].join("\r\n") + "\r\n";
}
