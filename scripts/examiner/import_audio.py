#!/usr/bin/env python3
"""Cut the examiner recording(s) into one clip per line.

The owner records all lines from src/config/examiner-script.json in ElevenLabs,
in the same order, with a 2-second pause between lines (the "Option B" text in
content/examiner/ielts-examiner-lines.docx). This script finds those pauses,
checks that there is exactly one piece per line, and writes
public/audio/examiner/<id>.mp3 for each line.

Usage (from the repository root; needs ffmpeg):
    python3 -I scripts/examiner/import_audio.py recording.mp3 [more.mp3 ...]

Several files are joined in the order given (examiner-a.mp3 examiner-b.mp3,
or a1/a2/... pieces). Nothing is written unless every line is found.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "src" / "config" / "examiner-script.json"
OUT_DIR = ROOT / "public" / "audio" / "examiner"

NOISE_DB = -40       # quieter than this counts as silence
MIN_PAUSE = 1.3      # seconds; pauses between lines are ~2 s, pauses inside a line are < 1 s
PAD_BEFORE = 0.12    # seconds of the recording's own silence kept before each line
PAD_AFTER = 0.20     # ... and after
CPS_RANGE = (12, 45) # plausible characters per second for a spoken line


def run(cmd: list[str]) -> str:
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit(f"Command failed: {' '.join(cmd)}\n{p.stderr[-2000:]}")
    return p.stderr + p.stdout


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(out.strip())


def speech_segments(path: Path) -> list[tuple[float, float]]:
    """Speech parts of one file, split at pauses of MIN_PAUSE seconds or more."""
    log = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
               "-af", f"silencedetect=noise={NOISE_DB}dB:d={MIN_PAUSE}", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    total = duration(path)
    segs: list[tuple[float, float]] = []
    t = 0.0
    for i, s in enumerate(starts):
        e = ends[i] if i < len(ends) else total
        if s > t + 0.05:
            segs.append((t, s))
        t = e
    if total > t + 0.05:
        segs.append((t, total))
    return segs


def main() -> None:
    files = [Path(a) for a in sys.argv[1:]]
    if not files:
        sys.exit(__doc__)
    for f in files:
        if not f.is_file():
            sys.exit(f"Not found: {f}")
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is not installed.")

    lines = json.loads(SCRIPT.read_text(encoding="utf-8"))["lines"]

    pieces: list[tuple[Path, float, float, float]] = []  # file, start, end, file duration
    for f in files:
        total = duration(f)
        pieces += [(f, s, e, total) for s, e in speech_segments(f)]

    def table(n: int) -> str:
        rows = []
        for i in range(max(n, len(lines))):
            seg = f"{pieces[i][0].name} {pieces[i][1]:7.2f}-{pieces[i][2]:7.2f} ({pieces[i][2] - pieces[i][1]:4.2f}s)" if i < len(pieces) else "-"
            line = f"{lines[i]['id']:9s} {lines[i]['text'][:55]}" if i < len(lines) else "(no line)"
            rows.append(f"{i + 1:3d}  {seg:42s}  {line}")
        return "\n".join(rows)

    if len(pieces) != len(lines):
        sys.exit(
            f"Found {len(pieces)} spoken pieces but the script has {len(lines)} lines.\n"
            "Check that every line is recorded once, in order, with a ~2 s pause between lines.\n\n"
            + table(len(pieces))
        )

    warnings = []
    for (f, s, e, _), line in zip(pieces, lines):
        cps = len(line["text"]) / max(e - s, 0.01)
        if not CPS_RANGE[0] <= cps <= CPS_RANGE[1]:
            warnings.append(f"  {line['id']}: {e - s:.2f}s for {len(line['text'])} characters ({cps:.0f}/s) - listen to this one")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for (f, s, e, total), line in zip(pieces, lines):
            a = max(0.0, s - PAD_BEFORE)
            b = min(total, e + PAD_AFTER)
            length = b - a
            fade_out = max(0.0, length - 0.01)
            wav = Path(tmp) / f"{line['id']}.wav"
            # Cut, fade the edges, then even out loudness so all clips sound the same.
            run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{a:.3f}", "-t", f"{length:.3f}", "-i", str(f),
                 "-af", f"afade=t=in:d=0.01,afade=t=out:st={fade_out:.3f}:d=0.01,loudnorm=I=-16:TP=-1.5:LRA=11",
                 "-ar", "44100", "-ac", "1", str(wav)])
            run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav),
                 "-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1", "-map_metadata", "-1", str(OUT_DIR / f"{line['id']}.mp3")])

    print(table(len(pieces)))
    size = sum(p.stat().st_size for p in OUT_DIR.glob("*.mp3"))
    print(f"\nWrote {len(lines)} clips to {OUT_DIR.relative_to(ROOT)} ({size / 1024:.0f} KB).")
    if warnings:
        print("\nCheck these (very fast or very slow for their text):\n" + "\n".join(warnings))


if __name__ == "__main__":
    main()
