// Which mock test comes next.
//
// Rule agreed with the owner: a student never gets the same mock set twice
// until every active set has been done. When the last one is finished, a new
// cycle starts and all sets are available again.
//
// A mock that was left halfway is not in the history, so it can come again.
// Pure functions, so they are easy to test.

export type MockSetRef = { id: string; name: string };
export type MockHistoryRow = { mock_set_id: string; cycle: number };

export type NextMock = {
  set: MockSetRef;
  /** Which round through all the sets this is (1, 2, 3 …). */
  cycle: number;
  /** This mock is number `number` of `total` in the cycle. */
  number: number;
  total: number;
};

/** The sets still open in the current cycle (all of them when a new cycle starts). */
export function remainingInCycle(sets: readonly MockSetRef[], history: readonly MockHistoryRow[]) {
  const ids = new Set(sets.map((s) => s.id));
  // Sets that no longer exist (or were disabled) do not hold a cycle open.
  const known = history.filter((h) => ids.has(h.mock_set_id));
  let cycle = known.reduce((max, h) => Math.max(max, h.cycle), 1);
  let done = new Set(known.filter((h) => h.cycle === cycle).map((h) => h.mock_set_id));

  // Every set done: start the next cycle with a clean sheet.
  if (sets.length > 0 && done.size >= sets.length) {
    cycle += 1;
    done = new Set();
  }
  return { cycle, doneCount: done.size, remaining: sets.filter((s) => !done.has(s.id)) };
}

export function chooseNextMock(
  sets: readonly MockSetRef[],
  history: readonly MockHistoryRow[],
  rand: () => number = Math.random,
): NextMock | null {
  if (sets.length === 0) return null;
  const { cycle, doneCount, remaining } = remainingInCycle(sets, history);
  const set = remaining[Math.floor(rand() * remaining.length)] ?? remaining[0];
  return { set, cycle, number: doneCount + 1, total: sets.length };
}
