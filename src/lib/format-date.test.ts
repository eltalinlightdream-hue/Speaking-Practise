import test from "node:test";
import assert from "node:assert/strict";
import { formatDay, formatDayRange, formatDayTime } from "./format-date.ts";

test("Uzbek and English dates in Tashkent time", () => {
  const d = new Date("2026-11-13T09:05:00Z"); // 14:05 in Tashkent
  assert.equal(formatDayTime(d, "uz", "Asia/Tashkent"), "13-noy, 14:05");
  assert.equal(formatDayTime(d, "en", "Asia/Tashkent"), "13 Nov, 14:05");
});

test("late evening UTC is already the next day in Tashkent", () => {
  assert.equal(formatDayTime(new Date("2026-12-31T19:30:00Z"), "uz", "Asia/Tashkent"), "1-yan, 00:30");
});

test("formatDayRange", () => {
  assert.equal(formatDayRange("2026-11-09", "2026-11-15", "uz"), "9–15-noyabr 2026");
  assert.equal(formatDayRange("2026-11-09", "2026-11-15", "en"), "9–15 November 2026");
  assert.equal(formatDayRange("2026-11-30", "2026-12-06", "en"), "30 November – 6 December 2026");
  assert.equal(formatDayRange("2026-12-28", "2027-01-03", "uz"), "28-dekabr 2026 – 3-yanvar 2027");
});

test("formatDay", () => {
  assert.equal(formatDay("2026-11-13", "uz"), "13-noyabr 2026");
  assert.equal(formatDay("2026-01-02", "en"), "2 January 2026");
});
