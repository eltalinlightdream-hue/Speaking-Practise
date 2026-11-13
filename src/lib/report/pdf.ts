import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { DAY_GOAL_SECONDS, formatDay, formatDuration, formatWeekRange } from "./week";
import type { WeeklyReport } from "./weekly";

// Same colours as the "Jade pebble morning" tokens in src/app/globals.css.
// (A PDF cannot read CSS variables, so they are repeated here once.)
const C = {
  primary: rgb(0x40 / 255, 0x4e / 255, 0x3b / 255), // Forest
  accent: rgb(0x7b / 255, 0x96 / 255, 0x69 / 255), // Sage
  surface: rgb(0xba / 255, 0xc8 / 255, 0xb1 / 255), // Mist
  border: rgb(0xe6 / 255, 0xe6 / 255, 0xe6 / 255), // Pebble
  muted: rgb(0xf0 / 255, 0xf2 / 255, 0xec / 255),
  text: rgb(0x1f / 255, 0x2a / 255, 0x1c / 255), // Ink
  mutedText: rgb(0x4b / 255, 0x59 / 255, 0x47 / 255),
  white: rgb(1, 1, 1),
};

/** Every text in the PDF, already translated. */
export type ReportLabels = {
  brand: string;
  title: string;
  student: string;
  group: string;
  week: string;
  generated: string;
  totalTime: string;
  goalDays: string;
  sessions: string;
  mockTests: string;
  daily: string;
  day: string;
  time: string;
  sessionsCol: string;
  goal: string;
  goalYes: string;
  goalNo: string;
  breakdown: string;
  general: string;
  mock: string;
  mockCompleted: string;
  part: (n: number) => string;
  partsNone: string;
  note: string;
  units: { h: string; min: string };
};

// Inter covers Uzbek letters such as oʻ and gʻ. Files live in src/assets/fonts
// (next.config.ts makes sure they are shipped with the server code).
async function loadFonts() {
  const dir = path.join(process.cwd(), "src/assets/fonts");
  const [regular, bold] = await Promise.all([readFile(path.join(dir, "Inter-Regular.ttf")), readFile(path.join(dir, "Inter-Bold.ttf"))]);
  return { regular, bold };
}

export async function buildWeeklyPdf(r: WeeklyReport, L: ReportLabels, locale: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const files = await loadFonts();
  const font = await doc.embedFont(files.regular, { subset: true });
  const bold = await doc.embedFont(files.bold, { subset: true });

  doc.setTitle(`${L.title} — ${r.student.name}`);
  doc.setAuthor(L.brand);
  doc.setCreator(L.brand);

  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const M = 44; // page margin
  const inner = width - M * 2;

  const text = (p: PDFPage, s: string, x: number, y: number, size: number, f: PDFFont = font, color = C.text) =>
    p.drawText(s, { x, y, size, font: f, color });
  const textRight = (p: PDFPage, s: string, right: number, y: number, size: number, f: PDFFont = font, color = C.text) =>
    p.drawText(s, { x: right - f.widthOfTextAtSize(s, size), y, size, font: f, color });
  const fit = (s: string, f: PDFFont, size: number, max: number) => {
    if (f.widthOfTextAtSize(s, size) <= max) return s;
    let out = s;
    while (out.length > 1 && f.widthOfTextAtSize(`${out}…`, size) > max) out = out.slice(0, -1);
    return `${out}…`;
  };
  /** Largest size (down to `min`) at which the text fits in `max`. */
  const sizeToFit = (s: string, f: PDFFont, size: number, max: number, min = 10) => {
    while (size > min && f.widthOfTextAtSize(s, size) > max) size -= 0.5;
    return size;
  };
  /** Split text into lines no wider than `max`. */
  const wrap = (s: string, f: PDFFont, size: number, max: number) => {
    const lines: string[] = [];
    let line = "";
    for (const word of s.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && f.widthOfTextAtSize(next, size) > max) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);

  // ---- Header band ----
  const bandH = 96;
  page.drawRectangle({ x: 0, y: height - bandH, width, height: bandH, color: C.primary });
  text(page, L.brand, M, height - 38, 13, bold, C.white);
  text(page, L.title, M, height - 70, 24, bold, C.white);
  textRight(page, formatWeekRange(r.weekStart, locale), width - M, height - 66, 12, font, C.white);

  // ---- Who and when ----
  let y = height - bandH - 34;
  const info: [string, string][] = [
    [L.student, r.student.name],
    [L.group, r.student.group ?? "—"],
    [L.week, formatWeekRange(r.weekStart, locale)],
    [L.generated, formatDay(new Date().toISOString().slice(0, 10), locale, { day: "numeric", month: "long", year: "numeric" })],
  ];
  for (const [label, value] of info) {
    text(page, label, M, y, 10, font, C.mutedText);
    text(page, fit(value, bold, 11, inner - 110), M + 110, y, 11, bold);
    y -= 18;
  }

  // ---- Summary tiles ----
  y -= 12;
  const tiles: [string, string][] = [
    [L.totalTime, formatDuration(r.totalSeconds, L.units)],
    [L.goalDays, `${r.goalDays} / 7`],
    [L.sessions, String(r.sessions)],
    [L.mockTests, String(r.mockSessions)],
  ];
  const gap = 10;
  const tileW = (inner - gap * 3) / 4;
  const tileH = 64;
  tiles.forEach(([label, value], i) => {
    const x = M + i * (tileW + gap);
    page.drawRectangle({ x, y: y - tileH, width: tileW, height: tileH, color: C.muted, borderColor: C.border, borderWidth: 1 });
    text(page, fit(label, font, 9, tileW - 20), x + 10, y - 20, 9, font, C.mutedText);
    const size = sizeToFit(value, bold, 18, tileW - 20);
    text(page, fit(value, bold, size, tileW - 20), x + 10, y - 46, size, bold, C.primary);
  });
  y -= tileH + 34;

  // ---- Daily table ----
  text(page, L.daily, M, y, 14, bold, C.primary);
  y -= 22;
  const col = { day: M + 8, time: M + 160, bar: M + 222, sessions: M + inner - 150, goal: M + inner - 8 };
  const barW = col.sessions - col.bar - 64;
  page.drawRectangle({ x: M, y: y - 8, width: inner, height: 24, color: C.primary });
  text(page, L.day, col.day, y, 9, bold, C.white);
  text(page, L.time, col.time, y, 9, bold, C.white);
  textRight(page, fit(L.sessionsCol, bold, 9, 70), col.sessions, y, 9, bold, C.white);
  textRight(page, fit(L.goal, bold, 9, 100), col.goal, y, 9, bold, C.white);
  y -= 30;

  const maxSeconds = Math.max(DAY_GOAL_SECONDS, ...r.days.map((d) => d.seconds));
  r.days.forEach((d, i) => {
    const rowH = 30;
    if (i % 2 === 1) page.drawRectangle({ x: M, y: y - 10, width: inner, height: rowH, color: C.muted });
    const dayName = cap(formatDay(d.date, locale, { weekday: "long" }));
    const dateText = formatDay(d.date, locale, { day: "numeric", month: "short" });
    text(page, fit(dayName, bold, 10, 92), col.day, y + 2, 10, bold);
    text(page, dateText, col.day + 96, y + 2, 10, font, C.mutedText);
    text(page, formatDuration(d.seconds, L.units), col.time, y + 2, 10);
    // Bar: grey track, sage fill, a dark mark at the 15-minute goal.
    page.drawRectangle({ x: col.bar, y: y + 1, width: barW, height: 8, color: C.border });
    if (d.seconds > 0) page.drawRectangle({ x: col.bar, y: y + 1, width: Math.max(2, (d.seconds / maxSeconds) * barW), height: 8, color: C.accent });
    const goalX = col.bar + (DAY_GOAL_SECONDS / maxSeconds) * barW;
    page.drawRectangle({ x: goalX - 0.75, y: y - 2, width: 1.5, height: 14, color: C.primary });
    textRight(page, String(d.sessions), col.sessions, y + 2, 10);
    // Meaning is in the words, not only the colour.
    textRight(page, d.goalMet ? `✓ ${L.goalYes}` : L.goalNo, col.goal, y + 2, 10, d.goalMet ? bold : font, d.goalMet ? C.primary : C.mutedText);
    y -= rowH;
  });
  page.drawLine({ start: { x: M, y: y + 18 }, end: { x: M + inner, y: y + 18 }, thickness: 1, color: C.border });
  y -= 18;

  // ---- Breakdown ----
  text(page, L.breakdown, M, y, 14, bold, C.primary);
  y -= 22;
  const partNumbers = Object.keys(r.parts).map(Number).sort((a, b) => a - b);
  const lines: [string, string][] = [
    [L.general, String(r.generalSessions)],
    [L.mock, String(r.mockSessions)],
    [L.mockCompleted, String(r.mockCompleted)],
    ...(partNumbers.length ? partNumbers.map((p) => [L.part(p), String(r.parts[p])] as [string, string]) : [[L.partsNone, "—"] as [string, string]]),
  ];
  for (const [label, value] of lines) {
    text(page, label, M + 8, y, 10);
    textRight(page, value, M + 260, y, 10, bold);
    page.drawLine({ start: { x: M, y: y - 7 }, end: { x: M + 268, y: y - 7 }, thickness: 0.5, color: C.border });
    y -= 20;
  }

  // ---- Footer note ----
  const noteLines = wrap(L.note, font, 9, inner).slice(0, 3);
  const noteH = 22 + noteLines.length * 12;
  page.drawRectangle({ x: 0, y: 0, width, height: noteH, color: C.surface });
  noteLines.forEach((line, i) => text(page, line, M, noteH - 20 - i * 12, 9, font, C.primary));

  return doc.save();
}

/** File name like "speaking-easy-week-2026-11-09-erkinjon-abduraimov.pdf" */
export function reportFileName(r: WeeklyReport): string {
  const slug =
    r.student.name
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .slice(0, 40) || "student";
  return `speaking-easy-week-${r.weekStart}-${slug}.pdf`;
}
