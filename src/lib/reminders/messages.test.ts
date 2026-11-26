// Every reminder text must have all its {placeholders} filled. Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { buildReminder, OFF_CALLBACK } from "./messages.ts";
import type { ReminderDecision } from "./plan.ts";

const cases: ReminderDecision[] = [
  { kind: "daily", variant: "keep", streak: 4, minutesLeft: 15 },
  { kind: "daily", variant: "almost", streak: 0, minutesLeft: 6 },
  { kind: "daily", variant: "start", streak: 0, minutesLeft: 15 },
  { kind: "daily", variant: "comeback", streak: 0, minutesLeft: 15 },
  { kind: "streak", variant: null, streak: 7, minutesLeft: 9 },
  { kind: "stop", variant: null, streak: 0, minutesLeft: 15 },
];

test("all versions, both languages: no {placeholder} left, name and buttons present", () => {
  for (const language of ["uz", "en"]) {
    for (const d of cases) {
      for (let i = 0; i < 10; i++) {
        const m = buildReminder(d, { fullName: "Aziza Karimova", language }, "https://x.test", () => i / 10);
        assert.doesNotMatch(m.text, /[{}]/, m.text);
        assert.match(m.text, /Aziza/);
        const buttons = m.reply_markup.inline_keyboard.flat();
        if (d.kind === "stop") assert.equal(buttons.length, 1);
        else assert.ok(buttons.some((b) => "callback_data" in b && b.callback_data === OFF_CALLBACK));
      }
    }
  }
});

test("no name: a friendly word instead", () => {
  const m = buildReminder(cases[2], { fullName: null, language: "en" }, "https://x.test", () => 0);
  assert.match(m.text, /friend/);
});
