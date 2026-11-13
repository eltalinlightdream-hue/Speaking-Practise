import test from "node:test";
import assert from "node:assert/strict";
import { telegramEmail, telegramHash, verifyTelegramLogin } from "./telegram-auth.ts";

const TOKEN = "123456:TEST-token-for-unit-tests";
const NOW = 1_800_000_000;

function signed(fields: Record<string, string>) {
  return { ...fields, hash: telegramHash(fields, TOKEN) };
}

const base = { id: "42", first_name: "Aziza", last_name: "Karimova", username: "aziza", auth_date: String(NOW - 10) };

test("a correctly signed, fresh answer is accepted", () => {
  const user = verifyTelegramLogin(signed(base), TOKEN, NOW);
  assert.deepEqual(user, { id: 42, first_name: "Aziza", last_name: "Karimova", username: "aziza", photo_url: undefined, auth_date: NOW - 10 });
});

test("our own ?next= is ignored by the check", () => {
  assert.ok(verifyTelegramLogin({ ...signed(base), next: "/home" }, TOKEN, NOW));
});

test("a changed field is rejected", () => {
  assert.equal(verifyTelegramLogin({ ...signed(base), id: "43" }, TOKEN, NOW), null);
  assert.equal(verifyTelegramLogin({ ...signed(base), first_name: "Someone" }, TOKEN, NOW), null);
});

test("a hash made with another bot's token is rejected", () => {
  const other = { ...base, hash: telegramHash(base, "999:other") };
  assert.equal(verifyTelegramLogin(other, TOKEN, NOW), null);
});

test("an old answer is rejected", () => {
  const old = signed({ ...base, auth_date: String(NOW - 2 * 60 * 60) });
  assert.equal(verifyTelegramLogin(old, TOKEN, NOW), null);
});

test("missing or broken fields are rejected", () => {
  assert.equal(verifyTelegramLogin({ ...signed(base), hash: "abc" }, TOKEN, NOW), null);
  const noId: Record<string, string> = { ...base };
  delete noId.id;
  assert.equal(verifyTelegramLogin(signed(noId), TOKEN, NOW), null);
  assert.equal(verifyTelegramLogin(signed(base), "", NOW), null);
});

test("made-up email for Supabase", () => {
  assert.equal(telegramEmail(42), "telegram-42@users.invalid");
});
