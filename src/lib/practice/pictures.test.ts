import { test } from "node:test";
import assert from "node:assert/strict";
import { isPictureUrl, parsePictureLines, pictureLines, readPictures } from "./pictures.ts";

test("picture addresses: own files or https links only", () => {
  assert.ok(isPictureUrl("/content/cefr/2026-09/t01-part2.webp"));
  assert.ok(isPictureUrl("https://example.com/a.jpg"));
  assert.ok(!isPictureUrl("//evil.example/a.jpg"));
  assert.ok(!isPictureUrl("http://example.com/a.jpg"));
  assert.ok(!isPictureUrl("javascript:alert(1)"));
  assert.ok(!isPictureUrl("picture.jpg"));
});

test("readPictures keeps good {url, alt} items and drops the rest", () => {
  assert.deepEqual(readPictures(null), []);
  assert.deepEqual(readPictures("x"), []);
  assert.deepEqual(
    readPictures([{ url: " /a.webp ", alt: " A " }, { url: "/b.webp" }, { url: "javascript:x", alt: "bad" }, 3, null]),
    [
      { url: "/a.webp", alt: "A" },
      { url: "/b.webp", alt: "" },
    ],
  );
});

test("admin lines: 'address | description', blank lines skipped, bad lines reported", () => {
  const { pictures, bad } = parsePictureLines("/a.webp | Friends eating\n\n  /b.webp|A | B  \nnot a link");
  assert.deepEqual(pictures, [
    { url: "/a.webp", alt: "Friends eating" },
    { url: "/b.webp", alt: "A | B" },
  ]);
  assert.deepEqual(bad, ["not a link"]);
  assert.equal(pictureLines(pictures), "/a.webp | Friends eating\n/b.webp | A | B");
  assert.equal(pictureLines([{ url: "/c.webp", alt: "" }]), "/c.webp");
});
