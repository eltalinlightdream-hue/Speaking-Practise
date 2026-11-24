import test from "node:test";
import assert from "node:assert/strict";
import { buildWeeklyReport, reportCsv, type DailyTotal } from "./report.ts";

const groups = [
  { id: "g1", name: "Morning A" },
  { id: "g2", name: "Evening B" },
];
const students = [
  { id: "u1", full_name: "Aziza Karimova", email: "a@example.com", lesson_group_id: "g1" },
  { id: "u2", full_name: "Bekzod", email: "b@example.com", lesson_group_id: "g1" },
  { id: "u3", full_name: null, email: "c@example.com", lesson_group_id: null },
];
const t = (user_id: string, day: string, seconds: number, mocks = 0): DailyTotal => ({ user_id, day, seconds, sessions: 1, mocks_completed: mocks });

// Friday 13 Nov 2026, 15:00 in Tashkent. The week is Mon 9 – Sun 15 Nov.
const now = new Date("2026-11-13T10:00:00Z");

test("sums the week per student and per group", () => {
  const totals = [
    t("u1", "2026-11-09", 900),
    t("u1", "2026-11-10", 1200, 1),
    t("u1", "2026-11-08", 5000), // Sunday before: not in this week
    t("u2", "2026-11-12", 300),
  ];
  const r = buildWeeklyReport(students, groups, totals, "2026-11-09", now);

  const u1 = r.students.find((s) => s.id === "u1")!;
  assert.equal(u1.weekSeconds, 2100);
  assert.equal(u1.countedDays, 2);
  assert.equal(u1.mocksCompleted, 1);
  assert.equal(u1.lastActive, "2026-11-10");

  const g1 = r.groups.find((g) => g.groupId === "g1")!;
  assert.deepEqual([g1.students, g1.active, g1.weekSeconds, g1.countedDays], [2, 2, 2400, 2]);
  const g2 = r.groups.find((g) => g.groupId === "g2")!;
  assert.deepEqual([g2.students, g2.active], [0, 0]);

  // A student without a group gets a row of its own.
  const none = r.groups.find((g) => g.groupId === null)!;
  assert.equal(none.students, 1);
  assert.equal(r.total.students, 3);
  assert.equal(r.total.active, 2);
});

test("most practice first; a student without a name shows the email", () => {
  const r = buildWeeklyReport(students, groups, [t("u2", "2026-11-12", 600)], "2026-11-09", now);
  assert.equal(r.students[0].id, "u2");
  assert.equal(r.students.find((s) => s.id === "u3")!.name, "c@example.com");
});

test("current streak uses the shared streak rules", () => {
  const totals = [t("u1", "2026-11-11", 900), t("u1", "2026-11-12", 900)];
  const r = buildWeeklyReport(students, groups, totals, "2026-11-09", now);
  // Today (13th) not done yet, so the streak still counts 11th + 12th.
  assert.equal(r.students.find((s) => s.id === "u1")!.currentStreak, 2);
});

test("CSV: header, quoting and safe cells", () => {
  const evil = [{ id: "u9", full_name: '=HYPERLINK("x")', email: "e@example.com", lesson_group_id: "g1" }];
  const r = buildWeeklyReport(evil, groups, [t("u9", "2026-11-10", 1500)], "2026-11-09", now);
  const csv = reportCsv(r, (id) => groups.find((g) => g.id === id)?.name ?? "");
  const lines = csv.replace("﻿", "").trim().split("\r\n");
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('"Name","Email","Group"'));
  assert.ok(lines[1].startsWith(`"'=HYPERLINK(""x"")","e@example.com","Morning A","25","1"`));
});
