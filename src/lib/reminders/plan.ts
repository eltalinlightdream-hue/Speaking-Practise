// Who gets a practice reminder right now, and which one. Pure code (no
// database, no Telegram), so it is easy to test: src/lib/reminders/plan.test.ts.
//
// Rules agreed with the owner (2026-11-26), Tashkent time:
//   * Never before 08:00 or from 22:00 on.
//   * Nothing once today already counts (15 minutes), or while a session is running.
//   * "daily":  once a day at the student's reminder time: their own choice, or
//               30 min before the time they usually start practising (needs 3
//               days of practice in the last 21), or 18:00.
//               Variant: "almost" (5+ minutes today), "keep" (has a streak),
//               "start" (practised in the last 3 days) or "comeback".
//   * "streak": at 21:00 when a streak of 2+ days ends tonight. When this one is
//               due, the daily reminder is not sent after 21:00 (one message is enough).
//   * "stop":   reminders were sent on 10+ of the last 14 days and the student did
//               not practise at all in that time: one last friendly message, then
//               reminders turn off (Duolingo does the same, so people don't block the bot).

import { DAY_GOAL_SECONDS, TIME_ZONE, addDays, summarise, tashkentDay, type Day } from "../practice/streak.ts";

export type ReminderKind = "daily" | "streak" | "stop";
export type DailyVariant = "almost" | "keep" | "start" | "comeback";

export type ReminderSession = {
  day_tashkent: Day;
  duration_seconds: number | null;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
};

export type ReminderInput = {
  /** "HH:MM" or "HH:MM:SS" chosen by the student, or null for automatic. */
  reminderTime: string | null;
  createdAt: string;
  sessions: readonly ReminderSession[];
  /** Reminders already sent (the last 14 days are enough). */
  log: readonly { day_tashkent: Day; kind: ReminderKind }[];
};

export type ReminderDecision = {
  kind: ReminderKind;
  variant: DailyVariant | null;
  streak: number;
  minutesLeft: number;
};

export const DEFAULT_TIME = 18 * 60; // 18:00
export const EARLIEST = 8 * 60; // 08:00
export const LATEST_DAILY = 20 * 60 + 30; // 20:30 for an automatic time
export const STREAK_WARNING = 21 * 60; // 21:00
export const QUIET_FROM = 22 * 60; // 22:00

const minuteFormat = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Minutes since Tashkent midnight. */
export function tashkentMinutes(date: Date): number {
  const [h, m] = minuteFormat.format(date).split(":").map(Number);
  return h * 60 + m;
}

/** "18:30" or "18:30:00" -> 1110; anything else -> null. */
export function parseTime(time: string | null | undefined): number | null {
  const m = /^(\d{2}):(\d{2})/.exec(time ?? "");
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes >= 0 && minutes < 24 * 60 ? minutes : null;
}

/**
 * 30 minutes before the usual start time (the median over the last 21 days,
 * one start per day: the first), rounded down to 15 minutes, kept between
 * 08:00 and 20:30. Null when there are fewer than 3 practice days.
 */
export function learnedTime(sessions: readonly ReminderSession[], now: Date): number | null {
  const from = addDays(tashkentDay(now), -21);
  const firstStart = new Map<Day, number>();
  for (const s of sessions) {
    if (s.day_tashkent < from || (s.duration_seconds ?? 0) < 60) continue;
    const minute = tashkentMinutes(new Date(s.started_at));
    const prev = firstStart.get(s.day_tashkent);
    if (prev === undefined || minute < prev) firstStart.set(s.day_tashkent, minute);
  }
  const starts = [...firstStart.values()].sort((a, b) => a - b);
  if (starts.length < 3) return null;
  const median = starts[Math.floor(starts.length / 2)];
  const target = Math.floor((median - 30) / 15) * 15;
  return Math.min(Math.max(target, EARLIEST), LATEST_DAILY);
}

/** The minute of the day the daily reminder is due. */
export function reminderMinute(input: ReminderInput, now: Date): number {
  return parseTime(input.reminderTime) ?? learnedTime(input.sessions, now) ?? DEFAULT_TIME;
}

/** True while a session is open and was seen in the last 3 minutes. */
function practisingNow(sessions: readonly ReminderSession[], now: Date): boolean {
  return sessions.some((s) => !s.ended_at && now.getTime() - new Date(s.last_seen_at).getTime() < 3 * 60 * 1000);
}

export function decide(input: ReminderInput, now: Date = new Date()): ReminderDecision | null {
  const minute = tashkentMinutes(now);
  if (minute < EARLIEST || minute >= QUIET_FROM) return null;
  if (practisingNow(input.sessions, now)) return null;

  const summary = summarise(input.sessions, now);
  if (summary.secondsToday >= DAY_GOAL_SECONDS) return null;

  const today = summary.today;
  const sentToday = new Set(input.log.filter((l) => l.day_tashkent === today).map((l) => l.kind));
  const minutesLeft = Math.max(1, Math.ceil((DAY_GOAL_SECONDS - summary.secondsToday) / 60));
  const streak = summary.current;
  const due = reminderMinute(input, now);
  const make = (kind: ReminderKind, variant: DailyVariant | null = null): ReminderDecision => ({ kind, variant, streak, minutesLeft });

  // 1. Streak in danger (the strongest reminder).
  const streakWarning = streak >= 2;
  if (streakWarning && minute >= STREAK_WARNING) {
    return sentToday.has("streak") ? null : make("streak");
  }

  if (minute < due || sentToday.has("daily")) return null;

  // 2. Ignored for two weeks: say goodbye instead of another reminder.
  const since = addDays(today, -14);
  const remindedDays = new Set(input.log.filter((l) => l.kind === "daily" && l.day_tashkent >= since).map((l) => l.day_tashkent));
  const practisedRecently = input.sessions.some((s) => s.day_tashkent >= since && (s.duration_seconds ?? 0) > 0);
  if (remindedDays.size >= 10 && !practisedRecently) return make("stop");

  // 3. The daily reminder.
  const recent = addDays(today, -3);
  const variant: DailyVariant =
    summary.secondsToday >= 5 * 60
      ? "almost"
      : streak >= 1
        ? "keep"
        : input.sessions.some((s) => s.day_tashkent >= recent && (s.duration_seconds ?? 0) > 0)
          ? "start"
          : "comeback";
  return make("daily", variant);
}
