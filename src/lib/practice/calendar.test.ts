import test from "node:test";
import assert from "node:assert/strict";
import { addMonths, isMonth, monthGrid } from "./calendar.ts";

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
