import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Saves practice time. Called every ~30 seconds during a session, and with
// navigator.sendBeacon when the page is closed, so it accepts a plain POST body.
// The database function caps the time at the real time since the session started.
export async function POST(request: Request) {
  let body: { sessionId?: unknown; seconds?: unknown; finished?: unknown };
  try {
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const seconds = Math.max(0, Math.floor(Number(body.seconds) || 0));
  const finished = body.finished === true;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: "bad session" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("practice_session_progress", {
    p_session_id: sessionId,
    p_active_seconds: seconds,
    p_finished: finished,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ savedSeconds: data });
}
