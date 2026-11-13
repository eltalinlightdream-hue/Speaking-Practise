import test from "node:test";
import assert from "node:assert/strict";
import { formatDayTime } from "./format-date.ts";

test("Uzbek and English dates in Tashkent time", () => {
  const d = new Date("2026-11-13T09:05:00Z"); // 14:05 in Tashkent
  assert.equal(formatDayTime(d, "uz", "Asia/Tashkent"), "13-noy, 14:05");
  assert.equal(formatDayTime(d, "en", "Asia/Tashkent"), "13 Nov, 14:05");
});

test("late evening UTC is already the next day in Tashkent", () => {
  assert.equal(formatDayTime(new Date("2026-12-31T19:30:00Z"), "uz", "Asia/Tashkent"), "1-yan, 00:30");
});
