import test from "node:test";
import assert from "node:assert/strict";
import { addMonths, isDay, isMonth, monthGrid, weekDays, weekStart } from "./calendar.ts";

test("November 2026 starts on a Sunday, so the first week has 6 empty cells", () => {
  const weeks = monthGrid("2026-11");
  assert.deepEqual(weeks[0], [null, null, null, null, null, null, "2026-11-01"]);
  assert.equal(weeks.flat().filter(Boolean).length, 30);
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks.at(-1)?.[0], "2026-11-30"); // Monday
});

test("February in a leap year has 29 days", () => {
  assert.equal(monthGrid("2028-02").flat().filter(Boolean).length, 29);
});

test("addMonths crosses years", () => {
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2027-01", -1), "2026-12");
});

test("isMonth", () => {
  assert.ok(isMonth("2026-11"));
  assert.ok(!isMonth("2026-13"));
  assert.ok(!isMonth("26-11"));
  assert.ok(!isMonth(undefined));
});

test("weekStart: weeks start on Monday", () => {
  assert.equal(weekStart("2026-11-13"), "2026-11-09"); // Friday -> Monday
  assert.equal(weekStart("2026-11-09"), "2026-11-09"); // Monday stays
  assert.equal(weekStart("2026-11-15"), "2026-11-09"); // Sunday belongs to the week before
  assert.equal(weekStart("2027-01-01"), "2026-12-28"); // across the year end
});

test("weekDays lists Monday to Sunday", () => {
  assert.deepEqual(weekDays("2026-11-09"), [
    "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15",
  ]);
});

test("isDay", () => {
  assert.ok(isDay("2026-11-13"));
  assert.ok(!isDay("2026-11-1"));
  assert.ok(!isDay("hello"));
});
