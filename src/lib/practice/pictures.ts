// Pictures of a topic (CEFR Part 1.2 and Part 2), stored in topics.images as
// [{ "url": "/content/cefr/...webp", "alt": "What the picture shows" }].
// Pure helpers, shared by the practice pages and the admin form.

import type { Picture } from "./types";

/** A picture address: a file of this site ("/content/...") or an https link. */
export function isPictureUrl(url: string) {
  return (url.startsWith("/") && !url.startsWith("//")) || /^https:\/\/[^\s]+$/i.test(url);
}

/** Pictures from the database. Anything that is not a {url, alt} with a usable address is dropped. */
export function readPictures(value: unknown): Picture[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (!v || typeof v !== "object") return [];
    const { url, alt } = v as { url?: unknown; alt?: unknown };
    if (typeof url !== "string" || !isPictureUrl(url.trim())) return [];
    return [{ url: url.trim(), alt: typeof alt === "string" ? alt.trim() : "" }];
  });
}

/** Admin form text: one picture per line, "address | description". */
export function parsePictureLines(text: string): { pictures: Picture[]; bad: string[] } {
  const pictures: Picture[] = [];
  const bad: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [url, ...rest] = line.split("|");
    const clean = url.trim();
    if (!isPictureUrl(clean)) bad.push(line.trim());
    else pictures.push({ url: clean, alt: rest.join("|").trim() });
  }
  return { pictures, bad };
}

export function pictureLines(pictures: Picture[]) {
  return pictures.map((p) => (p.alt ? `${p.url} | ${p.alt}` : p.url)).join("\n");
}
