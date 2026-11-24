import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isExamCode } from "@/config/exams";

// Receives practice time that the phone kept while there was no internet
// (or while a save failed). For each session:
//   1. start_offline_session() creates it with the real start time, if needed;
//   2. practice_session_progress() saves the seconds with the usual limits.
// Both are safe to repeat. Answers which sessions are done ("saved") and
// which can never be saved ("drop"), so the phone can forget them.

const UUID = /^[0-9a-f-]{36}$/i;

type Item = {
  id?: unknown;
  seconds?: unknown;
  finished?: unknown;
  completed?: unknown;
  start?: {
    mode?: unknown;
    exam?: unknown;
    parts?: unknown;
    recordingType?: unknown;
    mockSetId?: unknown;
    startedAt?: unknown;
  };
};

export async function POST(request: Request) {
  let items: Item[];
  try {
    const body = (await request.json()) as { items?: Item[] };
    items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.json({ error: "signed out" }, { status: 401 });

  const saved: Record<string, number> = {};
  const drop: string[] = [];

  for (const item of items) {
    const id = typeof item.id === "string" && UUID.test(item.id) ? item.id : null;
    if (!id) continue;
    const seconds = Math.max(0, Math.floor(Number(item.seconds) || 0));
    const finished = item.finished === true;
    const completed = finished && item.completed === true;

    const s = item.start;
    if (s) {
      const exam = typeof s.exam === "string" && isExamCode(s.exam) ? s.exam : null;
      const mode = s.mode === "mock" ? "mock" : s.mode === "general" ? "general" : null;
      const startedAt = typeof s.startedAt === "string" && !Number.isNaN(Date.parse(s.startedAt)) ? s.startedAt : null;
      if (!exam || !mode || !startedAt) {
        drop.push(id);
        continue;
      }
      const { error } = await supabase.rpc("start_offline_session", {
        p_id: id,
        p_mode: mode,
        p_exam: exam,
        p_parts: Array.isArray(s.parts) ? s.parts.filter((p) => Number.isInteger(p)).slice(0, 5) : [],
        p_recording_type: ["none", "audio", "video"].includes(String(s.recordingType)) ? String(s.recordingType) : "none",
        p_mock_set_id: typeof s.mockSetId === "string" && UUID.test(s.mockSetId) ? s.mockSetId : null,
        p_started_at: startedAt,
      });
      if (error) {
        // Bad data (too old, unknown set...) will never work: forget it. Anything else: try later.
        if (["22023", "P0002"].includes(error.code)) drop.push(id);
        continue;
      }
    }

    const { data, error } = await supabase.rpc("practice_session_progress", {
      p_session_id: id,
      p_active_seconds: seconds,
      p_finished: finished,
      p_completed: completed,
    });
    if (error) {
      if (error.code === "P0002") drop.push(id);
      continue;
    }
    saved[id] = data as number;
  }

  return NextResponse.json({ saved, drop });
}
