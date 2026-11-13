// Month grid for the progress calendar. Weeks start on Monday.

import { addDays, type Day } from "./streak.ts";

/** "YYYY-MM" for a day. */
export function monthOf(day: Day): string {
  return day.slice(0, 7);
}

/** Move a "YYYY-MM" month by whole months. */
export function addMonths(month: string, amount: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + amount, 1));
  return d.toISOString().slice(0, 7);
}

export function isMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** The weeks of a month: 7 cells each, null for days outside the month. */
export function monthGrid(month: string): (Day | null)[][] {
  const first = `${month}-01`;
  // getUTCDay: 0 = Sunday … 6 = Saturday. Turn it into Monday = 0.
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (Day | null)[] = Array.from({ length: offset }, () => null);
  for (let day = first; monthOf(day) === month; day = addDays(day, 1)) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Day | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The Monday of the week a day is in (weeks run Monday to Sunday). */
export function weekStart(day: Day): Day {
  const offset = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -offset);
}

/** The 7 days of the week that starts on `monday`. */
export function weekDays(monday: Day): Day[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function isDay(v: unknown): v is Day {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
}
