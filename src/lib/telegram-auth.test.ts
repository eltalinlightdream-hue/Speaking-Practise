import test from "node:test";
import assert from "node:assert/strict";
import {
  confirmData,
  hashSecret,
  isStartCommand,
  isValidCode,
  parseConfirmData,
  parseStartCode,
  randomToken,
  safeEqual,
  safeNext,
  telegramEmail,
  webhookSecret,
} from "./telegram-auth.ts";

const CODE = "abcDEF123_-abcDEF123_-ab";

test("random tokens are valid start codes and differ", () => {
  const a = randomToken();
  const b = randomToken();
  assert.ok(isValidCode(a));
  assert.ok(isValidCode(b));
  assert.notEqual(a, b);
});

test("codes: only URL-safe characters, 20 to 64 long", () => {
  assert.ok(isValidCode(CODE));
  assert.equal(isValidCode("short"), false);
  assert.equal(isValidCode("x".repeat(65)), false);
  assert.equal(isValidCode("abc def ghi jkl mno pqr"), false);
  assert.equal(isValidCode(undefined), false);
});

test("/start with a code gives the code", () => {
  assert.equal(parseStartCode(`/start ${CODE}`), CODE);
  assert.equal(parseStartCode(`/start@speaking_easy_with_bot ${CODE}`), CODE);
});

test("/start without a code, or other text, gives null", () => {
  assert.equal(parseStartCode("/start"), null);
  assert.equal(parseStartCode("hello"), null);
  assert.equal(parseStartCode(`/start bad code`), null);
  assert.equal(parseStartCode(undefined), null);
  assert.ok(isStartCommand("/start"));
  assert.ok(isStartCommand(`/start ${CODE}`));
  assert.equal(isStartCommand("/started"), false);
});

test("confirm button data round-trips", () => {
  assert.equal(parseConfirmData(confirmData(CODE)), CODE);
  assert.ok(confirmData(CODE).length <= 64, "Telegram allows 64 bytes of button data");
  assert.equal(parseConfirmData("no:" + CODE), null);
  assert.equal(parseConfirmData("ok:bad"), null);
  assert.equal(parseConfirmData(undefined), null);
});

test("secret hash and webhook secret are stable hex", () => {
  assert.equal(hashSecret("s"), hashSecret("s"));
  assert.notEqual(hashSecret("s"), hashSecret("t"));
  const w = webhookSecret("123:TOKEN");
  assert.match(w, /^[0-9a-f]{64}$/);
  assert.equal(w, webhookSecret("123:TOKEN"));
  assert.notEqual(w, webhookSecret("123:OTHER"));
});

test("safeEqual", () => {
  assert.ok(safeEqual("abc", "abc"));
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
});

test("next: only our own paths", () => {
  assert.equal(safeNext("/progress"), "/progress");
  assert.equal(safeNext("//evil.com"), "/home");
  assert.equal(safeNext("/\\evil.com"), "/home");
  assert.equal(safeNext("https://evil.com"), "/home");
  assert.equal(safeNext(undefined), "/home");
});

test("made-up email on the reserved .invalid domain", () => {
  assert.equal(telegramEmail(42), "telegram-42@users.invalid");
});
