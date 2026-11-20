// Builds content/examiner/ielts-examiner-lines.docx (the ElevenLabs recording sheet)
// from src/config/examiner-script.json. Needs the "docx" npm package (npm i --no-save docx).
// Usage: node scripts/examiner/make_lines_docx.cjs src/config/examiner-script.json content/examiner/ielts-examiner-lines.docx

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  HeadingLevel, AlignmentType, LevelFormat, BorderStyle, Footer, PageNumber,
} = require("docx");

const [, , scriptPath, outPath] = process.argv;
const data = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const byId = Object.fromEntries(data.lines.map((l) => [l.id, l]));

const sections = [
  { title: "Opening", ids: ["open-01", "open-02", "open-03a", "open-03b", "open-03c", "open-04", "open-05", "open-06", "open-07", "open-08", "open-09", "open-10"] },
  { title: "Part 1 — Frame 1 (where you live)", ids: ["f1-00", "f1-01", "f1-02", "f1-03"] },
  { title: "Part 1 — Frame 2 (work or study)", ids: ["f2-00", "f2-01", "f2-w1", "f2-w2", "f2-w3", "f2-s1", "f2-s2", "f2-s3"] },
  { title: "Part 1 — change of topic", ids: ["p1-next"] },
  { title: "Part 2", ids: ["p2-01", "p2-02", "p2-03", "p2-04", "p2-05", "p2-06", "p2-07", "thanks", "p2-08"] },
  { title: "Part 3 and closing", ids: ["p3-02", "close-01"] },
];
const listed = sections.flatMap((s) => s.ids);
if (listed.length !== data.lines.length || listed.some((id) => !byId[id])) throw new Error("section ids do not match the script");

const FONT = "Arial";
const W = [500, 1800, 4626, 2100]; // sums to 9026 (A4 minus 1" margins)
const border = { style: BorderStyle.SINGLE, size: 4, color: "C9CFC6" };
const borders = { top: border, bottom: border, left: border, right: border };
const pad = { top: 90, bottom: 90, left: 110, right: 110 };

function cell(children, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    margins: pad,
    shading: opts.fill ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill } : undefined,
    children,
  });
}
const p = (text, run = {}, para = {}) => new Paragraph({ ...para, children: [new TextRun({ text, font: FONT, ...run })] });

let n = 0;
function sectionTable(ids) {
  const header = new TableRow({
    tableHeader: true,
    children: ["#", "File name", "Line to paste into ElevenLabs", "When it plays"].map((h, i) =>
      cell([p(h, { bold: true, color: "FFFFFF", size: 20 })], W[i], { fill: "404E3B" }),
    ),
  });
  const rows = ids.map((id) => {
    n += 1;
    const l = byId[id];
    return new TableRow({
      cantSplit: true,
      children: [
        cell([p(String(n), { size: 20 })], W[0]),
        cell([p(`${id}.mp3`, { size: 20, font: "Courier New", bold: true })], W[1]),
        cell([p(l.text, { size: 24 })], W[2]),
        cell([p(l.when, { size: 18, color: "4A5A47" })], W[3]),
      ],
    });
  });
  return new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: W, rows: [header, ...rows] });
}

const bullet = (text, boldPart) =>
  new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 60 },
    children: boldPart
      ? [new TextRun({ text: boldPart, bold: true, font: FONT }), new TextRun({ text, font: FONT })]
      : [new TextRun({ text, font: FONT })],
  });

const chars = data.lines.reduce((s, l) => s + l.text.length, 0);

const body = [
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: "IELTS Examiner Lines", font: FONT })] }),
  p(`Recording sheet for the mock tests · Examiner: ${data.examinerName} · ${data.lines.length} lines · about ${chars.toLocaleString("en-US")} characters`, { color: "4A5A47", size: 22 }, { spacing: { after: 240 } }),

  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "ElevenLabs settings", font: FONT })] }),
  bullet(" Daniel (British, calm, formal). Backup: George.", "Voice:"),
  bullet(" Eleven Multilingual v2", "Model:"),
  bullet(" Speed 0.95 · Stability 60% · Similarity 75% · Style exaggeration 0% · Speaker boost on", "Settings:"),
  bullet(" MP3, 44.1 kHz, 128 kbps", "Output:"),
  bullet(" Keep the same voice and settings for every line.", "Important:"),

  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "How to record", font: FONT })] }),
  bullet("Make one clip per line. Paste the whole line, including the full stop or question mark."),
  bullet("Name each downloaded file exactly as in the “File name” column, for example open-05.mp3."),
  bullet("Listen to each clip. If a short line (like “Thank you.”) sounds cut off or strange, generate it again."),
  bullet("Lines open-03a, open-03b and open-03c are three separate clips (the app picks one by the time of day)."),
  bullet("When all 36 clips are ready, put them in one Google Drive folder and share the link, or upload them to the GitHub branch."),
  bullet("ElevenLabs free plan: it asks for a credit line and non-commercial use. Please check their current terms."),

  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "The lines", font: FONT })] }),
];
for (const s of sections) {
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: s.title, font: FONT })] }));
  body.push(sectionTable(s.ids));
}

// Option B: record everything in two long takes; the import script cuts them at the 2-second pauses.
const BREAK = ' <break time="2s" />';
const SPLIT = listed.indexOf("p1-next");
const takes = [
  { file: "examiner-a.mp3", ids: listed.slice(0, SPLIT) },
  { file: "examiner-b.mp3", ids: listed.slice(SPLIT) },
];
const mono = (text) => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text, font: "Courier New", size: 19 })] });
body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text: "Option B: two long recordings", font: FONT })] }));
body.push(p("Instead of 36 separate clips, you can make two long recordings. The break tags make ElevenLabs pause for 2 seconds between lines, and the app's import script cuts the recordings at those pauses."));
body.push(bullet("Copy each block below exactly, in this order, into ElevenLabs (same voice and settings as above)."));
body.push(bullet("Save the results as examiner-a.mp3 and examiner-b.mp3."));
body.push(bullet("Listen once. If the voice speeds up or skips a pause, split that block into smaller pieces, keep the order, and name them examiner-a1.mp3, examiner-a2.mp3, and so on."));
for (const t of takes) {
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: `${t.file} (${t.ids.length} lines)`, font: FONT })] }));
  t.ids.forEach((id, i) => body.push(mono(byId[id].text + (i < t.ids.length - 1 ? BREAK : ""))));
}

const doc = new Document({
  creator: "Speaking Easy with Practise",
  title: "IELTS Examiner Lines",
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 44, bold: true, color: "404E3B" }, paragraph: { spacing: { before: 0, after: 80 }, keepNext: true } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 30, bold: true, color: "404E3B" }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 24, bold: true, color: "1F2A1C" }, paragraph: { spacing: { before: 280, after: 100 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ font: FONT, size: 18, color: "6C8480", children: ["Speaking Easy with Practise · page ", PageNumber.CURRENT] })] })] }),
    },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  console.log("wrote", outPath, buf.length, "bytes");
});
