// Tests for the reminder rules. Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { decide, learnedTime, parseTime, tashkentMinutes, type ReminderInput, type ReminderSession } from "./plan.ts";

/** A moment given in Tashkent time (UTC+5). */
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:00`);

function session(day: string, startHHMM: string, minutes: number, open = false): ReminderSession {
  const start = at(day, startHHMM);
  const end = new Date(start.getTime() + minutes * 60_000);
  return {
    day_tashkent: day,
    duration_seconds: minutes * 60,
    started_at: start.toISOString(),
    last_seen_at: end.toISOString(),
    ended_at: open ? null : end.toISOString(),
  };
}

const base = (over: Partial<ReminderInput> = {}): ReminderInput => ({
  reminderTime: null,
  createdAt: "2026-10-01T00:00:00Z",
  sessions: [],
  log: [],
  ...over,
});

test("times", () => {
  assert.equal(parseTime("18:30:00"), 18 * 60 + 30);
  assert.equal(parseTime(null), null);
  assert.equal(tashkentMinutes(at("2026-11-26", "07:05")), 7 * 60 + 5);
});

test("quiet hours and the default 18:00", () => {
  assert.equal(decide(base(), at("2026-11-26", "07:59")), null);
  assert.equal(decide(base(), at("2026-11-26", "17:59")), null);
  assert.equal(decide(base(), at("2026-11-26", "18:00"))?.kind, "daily");
  assert.equal(decide(base(), at("2026-11-26", "22:00")), null);
});

test("nothing once today counts, or while practising", () => {
  assert.equal(decide(base({ sessions: [session("2026-11-26", "10:00", 15)] }), at("2026-11-26", "18:00")), null);
  const open = session("2026-11-26", "17:58", 1, true);
  assert.equal(decide(base({ sessions: [open] }), at("2026-11-26", "18:00")), null);
});

test("only once a day", () => {
  const log = [{ day_tashkent: "2026-11-26", kind: "daily" as const }];
  assert.equal(decide(base({ log }), at("2026-11-26", "19:00")), null);
  assert.equal(decide(base({ log }), at("2026-11-27", "18:00"))?.kind, "daily");
});

test("own time wins; learned time is 30 min before the usual start", () => {
  assert.equal(decide(base({ reminderTime: "09:00:00" }), at("2026-11-26", "08:59")), null);
  assert.equal(decide(base({ reminderTime: "09:00:00" }), at("2026-11-26", "09:00"))?.kind, "daily");

  const usual = [session("2026-11-20", "20:10", 16), session("2026-11-21", "20:05", 16), session("2026-11-22", "19:50", 16)];
  assert.equal(learnedTime(usual, at("2026-11-26", "12:00")), 19 * 60 + 30); // median 20:05 - 30 = 19:35 -> 19:30
  assert.equal(decide(base({ sessions: usual }), at("2026-11-26", "19:15")), null);
  assert.equal(decide(base({ sessions: usual }), at("2026-11-26", "19:30"))?.kind, "daily");
  assert.equal(learnedTime(usual.slice(0, 2), at("2026-11-26", "12:00")), null); // fewer than 3 days
});

test("variants: almost, keep, start, comeback", () => {
  const today = "2026-11-26";
  assert.equal(decide(base({ sessions: [session(today, "10:00", 6)] }), at(today, "18:00"))?.variant, "almost");
  assert.equal(decide(base({ sessions: [session("2026-11-25", "10:00", 15)] }), at(today, "18:00"))?.variant, "keep");
  assert.equal(decide(base({ sessions: [session("2026-11-24", "10:00", 3)] }), at(today, "18:00"))?.variant, "start");
  assert.equal(decide(base({ sessions: [session("2026-11-10", "10:00", 3)] }), at(today, "18:00"))?.variant, "comeback");
});

test("minutes left", () => {
  const d = decide(base({ sessions: [session("2026-11-26", "10:00", 6)] }), at("2026-11-26", "18:00"));
  assert.equal(d?.minutesLeft, 9);
});

test("streak warning at 21:00 for a streak of 2+, once", () => {
  const streak = [session("2026-11-24", "10:00", 15), session("2026-11-25", "10:00", 15)];
  const daily = [{ day_tashkent: "2026-11-26", kind: "daily" as const }];
  assert.equal(decide(base({ sessions: streak, log: daily }), at("2026-11-26", "20:59")), null);
  const d = decide(base({ sessions: streak, log: daily }), at("2026-11-26", "21:00"));
  assert.equal(d?.kind, "streak");
  assert.equal(d?.streak, 2);
  const both = [...daily, { day_tashkent: "2026-11-26", kind: "streak" as const }];
  assert.equal(decide(base({ sessions: streak, log: both }), at("2026-11-26", "21:30")), null);
  // A 1-day streak gets no warning.
  assert.equal(decide(base({ sessions: streak.slice(1), log: daily }), at("2026-11-26", "21:00")), null);
});

test("after two ignored weeks: one goodbye", () => {
  const log = Array.from({ length: 10 }, (_, i) => ({ day_tashkent: `2026-11-${String(15 + i).padStart(2, "0")}`, kind: "daily" as const }));
  assert.equal(decide(base({ log }), at("2026-11-26", "18:00"))?.kind, "stop");
  // Practised once in that time: keep reminding.
  assert.equal(decide(base({ log, sessions: [session("2026-11-20", "10:00", 2)] }), at("2026-11-26", "18:00"))?.kind, "daily");
});
