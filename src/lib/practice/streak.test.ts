// Tests for the streak rules. Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import {
  DAY_GOAL_SECONDS,
  addDays,
  countedDays,
  daysBetween,
  secondsByDay,
  streaksFrom,
  summarise,
  tashkentDay,
} from "./streak.ts";

// Tashkent is UTC+5 all year (no daylight saving).
const utc = (iso: string) => new Date(iso);

test("tashkentDay: the Tashkent day, not the UTC day", () => {
  // 19:00 UTC is already the next day in Tashkent (00:00).
  assert.equal(tashkentDay(utc("2026-11-13T18:59:00Z")), "2026-11-13");
  assert.equal(tashkentDay(utc("2026-11-13T19:00:00Z")), "2026-11-14");
  // And early UTC morning is still the same Tashkent day.
  assert.equal(tashkentDay(utc("2026-11-14T03:00:00Z")), "2026-11-14");
});

test("tashkentDay: just before and just after Tashkent midnight", () => {
  // 23:59 Tashkent = 18:59 UTC.
  assert.equal(tashkentDay(utc("2026-03-07T18:59:59Z")), "2026-03-07");
  // 00:00 Tashkent = 19:00 UTC the day before.
  assert.equal(tashkentDay(utc("2026-03-07T19:00:00Z")), "2026-03-08");
});

test("tashkentDay: works across month and year ends", () => {
  assert.equal(tashkentDay(utc("2026-12-31T19:30:00Z")), "2027-01-01");
  assert.equal(tashkentDay(utc("2026-01-31T19:30:00Z")), "2026-02-01");
});

test("addDays and daysBetween", () => {
  assert.equal(addDays("2026-11-13", 1), "2026-11-14");
  assert.equal(addDays("2026-11-01", -1), "2026-10-31");
  assert.equal(addDays("2027-01-01", -1), "2026-12-31");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29"); // leap year
  assert.equal(daysBetween("2026-11-13", "2026-11-14"), 1);
  assert.equal(daysBetween("2026-11-14", "2026-11-13"), -1);
  assert.equal(daysBetween("2026-02-27", "2026-03-01"), 2);
});

test("a session that crosses midnight counts for the day it started", () => {
  // The session started at 23:50 Tashkent on the 13th and ran for 20 minutes,
  // so it ended on the 14th. day_tashkent is the START day.
  const sessions = [{ day_tashkent: "2026-11-13", duration_seconds: 1200 }];
  const byDay = secondsByDay(sessions);
  assert.equal(byDay.get("2026-11-13"), 1200);
  assert.equal(byDay.get("2026-11-14"), undefined);

  const counted = countedDays(sessions);
  assert.deepEqual([...counted], ["2026-11-13"]);
  // It does not give the next day a streak of its own.
  assert.equal(streaksFrom(counted, "2026-11-14").current, 1);
  assert.equal(streaksFrom(counted, "2026-11-15").current, 0);
});

test("a day needs 900 seconds in total, from any number of sessions", () => {
  assert.equal(DAY_GOAL_SECONDS, 900);
  const nearly = [{ day_tashkent: "2026-11-13", duration_seconds: 899 }];
  assert.equal(countedDays(nearly).size, 0);

  const exactly = [{ day_tashkent: "2026-11-13", duration_seconds: 900 }];
  assert.equal(countedDays(exactly).size, 1);

  const several = [
    { day_tashkent: "2026-11-13", duration_seconds: 400 },
    { day_tashkent: "2026-11-13", duration_seconds: 300 },
    { day_tashkent: "2026-11-13", duration_seconds: 200 },
  ];
  assert.deepEqual([...countedDays(several)], ["2026-11-13"]);
});

test("first day: one counted day is a streak of 1", () => {
  const counted = countedDays([{ day_tashkent: "2026-11-13", duration_seconds: 900 }]);
  assert.deepEqual(streaksFrom(counted, "2026-11-13"), { current: 1, longest: 1 });
});

test("first day: no practice at all is a streak of 0", () => {
  assert.deepEqual(streaksFrom(countedDays([]), "2026-11-13"), { current: 0, longest: 0 });
  // Practised today, but not enough yet.
  const short = countedDays([{ day_tashkent: "2026-11-13", duration_seconds: 500 }]);
  assert.deepEqual(streaksFrom(short, "2026-11-13"), { current: 0, longest: 0 });
});

test("today not practised yet: yesterday keeps the streak alive", () => {
  const counted = new Set(["2026-11-11", "2026-11-12"]);
  // The day is not over, so the streak still stands.
  assert.deepEqual(streaksFrom(counted, "2026-11-13"), { current: 2, longest: 2 });
  // One whole day was missed: back to 0.
  assert.deepEqual(streaksFrom(counted, "2026-11-14"), { current: 0, longest: 2 });
});

test("a missed day resets the streak and the longest one is kept", () => {
  const counted = new Set([
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
    "2026-11-04", // 4 days
    // 5 November missed
    "2026-11-06",
    "2026-11-07", // 2 days, ending today
  ]);
  assert.deepEqual(streaksFrom(counted, "2026-11-07"), { current: 2, longest: 4 });
});

test("a streak counts over month and year ends", () => {
  const counted = new Set(["2026-12-30", "2026-12-31", "2027-01-01"]);
  assert.deepEqual(streaksFrom(counted, "2027-01-01"), { current: 3, longest: 3 });
});

test("summarise: minutes today use the Tashkent day", () => {
  const sessions = [
    { day_tashkent: "2026-11-13", duration_seconds: 600 },
    { day_tashkent: "2026-11-14", duration_seconds: 960 },
  ];
  // 15:00 UTC on the 13th is still the 13th in Tashkent (20:00).
  const onThe13th = summarise(sessions, utc("2026-11-13T15:00:00Z"));
  assert.equal(onThe13th.today, "2026-11-13");
  assert.equal(onThe13th.secondsToday, 600);
  assert.equal(onThe13th.minutesToday, 10);
  assert.equal(onThe13th.current, 0); // 600 s is not a counted day

  // 19:30 UTC on the 13th is already the 14th in Tashkent (00:30).
  const afterMidnight = summarise(sessions, utc("2026-11-13T19:30:00Z"));
  assert.equal(afterMidnight.today, "2026-11-14");
  assert.equal(afterMidnight.secondsToday, 960);
  assert.equal(afterMidnight.minutesToday, 16);
  assert.deepEqual([afterMidnight.current, afterMidnight.longest], [1, 1]);
});

test("missing or odd numbers do not break the sums", () => {
  const sessions = [
    { day_tashkent: "2026-11-13", duration_seconds: null },
    { day_tashkent: "2026-11-13", duration_seconds: 900 },
  ];
  assert.equal(secondsByDay(sessions).get("2026-11-13"), 900);
});
