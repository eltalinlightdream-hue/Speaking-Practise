// Week helpers. Weeks run Monday to Sunday on the Tashkent calendar.
// Dates are plain "YYYY-MM-DD" strings, the same as practice_sessions.day_tashkent.

import { formatDayRange } from "@/lib/format-date";

export const DAY_GOAL_SECONDS = 900; // 15 minutes counts the day

/** Today's date in Tashkent as YYYY-MM-DD. */
export function tashkentToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(now);
}

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week that contains `date`. */
export function mondayOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((day + 6) % 7));
}

/** Monday of the requested week, or of this week when the value is missing/invalid/in the future. */
export function resolveWeek(value: unknown, today = tashkentToday()): string {
  const current = mondayOf(today);
  if (!isIsoDate(value)) return current;
  const monday = mondayOf(value);
  return monday > current ? current : monday;
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function intlLocale(locale: string) {
  return locale === "uz" ? "uz-Latn-UZ" : "en-GB";
}

/** e.g. "9–15 November 2026" / "9–15-noyabr 2026" */
export function formatWeekRange(monday: string, locale: string): string {
  return formatDayRange(monday, addDays(monday, 6), locale);
}

export function formatDay(date: string, locale: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { ...opts, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** "1 h 5 min" / "12 min" style, with translated units. */
export function formatDuration(seconds: number, units: { h: string; min: string }): string {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} ${units.h} ${m % 60} ${units.min}` : `${m} ${units.min}`;
}
