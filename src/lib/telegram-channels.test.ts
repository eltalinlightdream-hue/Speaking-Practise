import test from "node:test";
import assert from "node:assert/strict";
import { checkChannels, isMemberStatus } from "./telegram-channels.ts";

test("member statuses", () => {
  assert.equal(isMemberStatus("creator"), true);
  assert.equal(isMemberStatus("administrator"), true);
  assert.equal(isMemberStatus("member"), true);
  assert.equal(isMemberStatus("restricted", true), true);
  assert.equal(isMemberStatus("restricted", false), false);
  assert.equal(isMemberStatus("left"), false);
  assert.equal(isMemberStatus("kicked"), false);
  assert.equal(isMemberStatus(undefined), false);
});

const channels = [
  { username: "a", name: "A" },
  { username: "b", name: "B" },
  { username: "c", name: "C" },
  { username: "d", name: "D" },
];

test("checkChannels sorts joined, missing and unchecked", async () => {
  const answers: Record<string, unknown> = {
    a: { ok: true, result: { status: "member" } },
    b: { ok: true, result: { status: "left" } },
    c: { ok: false, description: "Bad Request: member list is inaccessible" },
    d: { ok: false, description: "Bad Request: user not found" },
  };
  const fakeFetch = (async (url: string) => {
    const chat = decodeURIComponent(new URL(url).searchParams.get("chat_id") ?? "").slice(1);
    assert.equal(new URL(url).searchParams.get("user_id"), "42");
    return { json: async () => answers[chat] } as Response;
  }) as typeof fetch;
  const warn = console.warn;
  console.warn = () => {};
  try {
    const result = await checkChannels(42, channels, "TOKEN", fakeFetch);
    assert.deepEqual(result, { missing: ["b", "d"], unchecked: ["c"] });
  } finally {
    console.warn = warn;
  }
});

test("network errors are unchecked, not missing", async () => {
  const fakeFetch = (async () => {
    throw new Error("offline");
  }) as typeof fetch;
  const warn = console.warn;
  console.warn = () => {};
  try {
    const result = await checkChannels(1, channels.slice(0, 1), "TOKEN", fakeFetch);
    assert.deepEqual(result, { missing: [], unchecked: ["a"] });
  } finally {
    console.warn = warn;
  }
});
