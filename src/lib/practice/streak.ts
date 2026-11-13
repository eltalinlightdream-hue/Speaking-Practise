// The one place that decides what a "practice day" and a "streak" are.
// Used by the home page, the progress page and the tests.
//
// Rules agreed with the owner:
//   * A day counts when the student practised 900 seconds (15 minutes) in
//     total on that day, every day of the week.
//   * Days are Tashkent days (Asia/Tashkent, UTC+5, no daylight saving).
//   * A session belongs to the Tashkent day on which it STARTED, so a session
//     that runs past midnight counts for the day it started
//     (practice_sessions.day_tashkent is set when the session starts).
//   * A missed day resets the streak to 0.

export const DAY_GOAL_SECONDS = 900;
export const TIME_ZONE = "Asia/Tashkent";

/** A Tashkent calendar day, written as YYYY-MM-DD. */
export type Day = string;

/** One practice session as the streak code needs it. */
export type SessionDay = { day_tashkent: Day; duration_seconds: number | null };

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Tashkent day a moment falls on. */
export function tashkentDay(date: Date = new Date()): Day {
  return dayFormat.format(date);
}

/** Move a day forward (or back, with a negative number) by whole days. */
export function addDays(day: Day, amount: number): Day {
  // Noon UTC is safely inside the day in every time zone, so adding whole
  // days can never slip into the day before or after.
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Day, to: Day): number {
  const ms = Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Total practice seconds per day. */
export function secondsByDay(sessions: readonly SessionDay[]): Map<Day, number> {
  const totals = new Map<Day, number>();
  for (const s of sessions) {
    if (!s.day_tashkent) continue;
    totals.set(s.day_tashkent, (totals.get(s.day_tashkent) ?? 0) + Math.max(0, s.duration_seconds ?? 0));
  }
  return totals;
}

/** The days that reached the 15 minute goal. */
export function countedDays(sessions: readonly SessionDay[], goalSeconds = DAY_GOAL_SECONDS): Set<Day> {
  const counted = new Set<Day>();
  for (const [day, seconds] of secondsByDay(sessions)) {
    if (seconds >= goalSeconds) counted.add(day);
  }
  return counted;
}

export type Streaks = { current: number; longest: number };

/**
 * Current and longest streak.
 *
 * The current streak ends today, or yesterday when today has not been
 * practised yet (the day is not over, so the streak is not broken).
 */
export function streaksFrom(counted: ReadonlySet<Day>, today: Day): Streaks {
  const days = [...counted].sort();

  let longest = 0;
  let run = 0;
  let previous: Day | null = null;
  for (const day of days) {
    run = previous !== null && daysBetween(previous, day) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = day;
  }

  let current = 0;
  let cursor = counted.has(today) ? today : counted.has(addDays(today, -1)) ? addDays(today, -1) : null;
  while (cursor && counted.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return { current, longest };
}

export type PracticeSummary = Streaks & {
  secondsToday: number;
  minutesToday: number;
  counted: Set<Day>;
  secondsByDay: Map<Day, number>;
  today: Day;
};

/** Everything the home and progress pages show, from one list of sessions. */
export function summarise(sessions: readonly SessionDay[], now: Date = new Date()): PracticeSummary {
  const today = tashkentDay(now);
  const byDay = secondsByDay(sessions);
  const counted = countedDays(sessions);
  const secondsToday = byDay.get(today) ?? 0;
  return {
    ...streaksFrom(counted, today),
    secondsToday,
    minutesToday: Math.floor(secondsToday / 60),
    counted,
    secondsByDay: byDay,
    today,
  };
}
