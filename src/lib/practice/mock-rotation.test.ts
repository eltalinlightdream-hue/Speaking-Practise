// Tests for the mock test rotation: never the same set twice in one cycle.

import test from "node:test";
import assert from "node:assert/strict";
import { chooseNextMock, type MockSetRef } from "./mock-rotation.ts";

const sets: MockSetRef[] = [
  { id: "a", name: "SPEAKING-1" },
  { id: "b", name: "SPEAKING-2" },
  { id: "c", name: "SPEAKING-3" },
];

// Always picks the first of the remaining sets, so the tests are predictable.
const firstOne = () => 0;

test("the first mock is cycle 1, number 1", () => {
  const next = chooseNextMock(sets, [], firstOne);
  assert.deepEqual(next, { set: sets[0], cycle: 1, number: 1, total: 3 });
});

test("a finished set does not come again in the same cycle", () => {
  const history = [{ mock_set_id: "a", cycle: 1 }];
  const next = chooseNextMock(sets, history, firstOne);
  assert.equal(next?.set.id, "b");
  assert.equal(next?.cycle, 1);
  assert.equal(next?.number, 2);
});

test("when every set is done, a new cycle starts with all of them again", () => {
  const history = [
    { mock_set_id: "a", cycle: 1 },
    { mock_set_id: "b", cycle: 1 },
    { mock_set_id: "c", cycle: 1 },
  ];
  const next = chooseNextMock(sets, history, firstOne);
  assert.deepEqual(next, { set: sets[0], cycle: 2, number: 1, total: 3 });
});

test("only the newest cycle decides what is left", () => {
  const history = [
    { mock_set_id: "a", cycle: 1 },
    { mock_set_id: "b", cycle: 1 },
    { mock_set_id: "c", cycle: 1 },
    { mock_set_id: "b", cycle: 2 },
  ];
  const next = chooseNextMock(sets, history, firstOne);
  assert.equal(next?.set.id, "a");
  assert.equal(next?.cycle, 2);
  assert.equal(next?.number, 2);
});

test("a set that was removed from the list is ignored", () => {
  const history = [{ mock_set_id: "gone", cycle: 1 }];
  const next = chooseNextMock(sets, history, firstOne);
  assert.deepEqual(next, { set: sets[0], cycle: 1, number: 1, total: 3 });
});

test("no active sets means no mock test", () => {
  assert.equal(chooseNextMock([], [], firstOne), null);
});

test("a whole cycle hands out every set exactly once", () => {
  const history: { mock_set_id: string; cycle: number }[] = [];
  const seen: string[] = [];
  for (let i = 0; i < 3; i++) {
    const next = chooseNextMock(sets, history, Math.random);
    assert.ok(next);
    assert.equal(next.cycle, 1);
    assert.equal(next.number, i + 1);
    seen.push(next.set.id);
    history.push({ mock_set_id: next.set.id, cycle: next.cycle });
  }
  assert.deepEqual([...seen].sort(), ["a", "b", "c"]);
  // The fourth one opens cycle 2.
  assert.equal(chooseNextMock(sets, history, Math.random)?.cycle, 2);
});
