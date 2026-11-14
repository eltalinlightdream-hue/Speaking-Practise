import { test } from "node:test";
import assert from "node:assert/strict";
import { groupFilterParams, groupIdsFor, readGroupFilter, selectedTeacher } from "./groups.ts";

const G1 = "11111111-1111-1111-1111-111111111111";
const G2 = "22222222-2222-2222-2222-222222222222";
const G3 = "33333333-3333-3333-3333-333333333333";
const OLD = "44444444-4444-4444-4444-444444444444";
const groups = [
  { id: G1, teacher: "Abduraimov Erkinjon" },
  { id: G2, teacher: "Abduraimov Erkinjon" },
  { id: G3, teacher: "Odilov Hojiakbar" },
  { id: OLD, teacher: null },
];

test("readGroupFilter keeps a valid group and drops the teacher then", () => {
  assert.deepEqual(readGroupFilter({ group: G1, teacher: "X" }), { group: G1, teacher: null });
  assert.deepEqual(readGroupFilter({ group: "nope", teacher: "  Odilov   Hojiakbar " }), { group: null, teacher: "Odilov Hojiakbar" });
  assert.deepEqual(readGroupFilter({ teacher: ["a", "b"] }), { group: null, teacher: null });
  assert.deepEqual(readGroupFilter({}), { group: null, teacher: null });
});

test("selectedTeacher comes from the group, or from a known teacher", () => {
  assert.equal(selectedTeacher(groups, { group: G3, teacher: null }), "Odilov Hojiakbar");
  assert.equal(selectedTeacher(groups, { group: OLD, teacher: null }), null);
  assert.equal(selectedTeacher(groups, { group: null, teacher: "Abduraimov Erkinjon" }), "Abduraimov Erkinjon");
  assert.equal(selectedTeacher(groups, { group: null, teacher: "Somebody" }), null);
});

test("groupIdsFor: one group, all of a teacher's groups, or everything", () => {
  assert.deepEqual(groupIdsFor(groups, { group: G2, teacher: null }), [G2]);
  assert.deepEqual(groupIdsFor(groups, { group: null, teacher: "Abduraimov Erkinjon" }), [G1, G2]);
  assert.equal(groupIdsFor(groups, { group: null, teacher: "Somebody" }), null);
  assert.equal(groupIdsFor(groups, { group: null, teacher: null }), null);
});

test("groupFilterParams", () => {
  assert.deepEqual(groupFilterParams({ group: G1, teacher: null }), { group: G1 });
  assert.deepEqual(groupFilterParams({ group: null, teacher: "T" }), { teacher: "T" });
  assert.deepEqual(groupFilterParams({ group: null, teacher: null }), {});
});
