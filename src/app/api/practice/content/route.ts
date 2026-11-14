import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { EXAMS, isExamCode } from "@/config/exams";
import { loadPool } from "@/lib/practice/pool";
import type { PoolTopic } from "@/lib/practice/general-plan";

// The question pools of one exam, for practising without internet.
// The General Training page downloads this now and then and keeps it on the phone.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const exam = new URL(request.url).searchParams.get("exam") ?? "";
  if (!isExamCode(exam)) return NextResponse.json({ error: "bad exam" }, { status: 400 });

  const parts: Record<number, PoolTopic[]> = {};
  await Promise.all(
    EXAMS[exam].parts.map(async (p) => {
      parts[p.part] = await loadPool(exam, p.part);
    }),
  );
  return NextResponse.json({ exam, savedAt: Date.now(), parts }, { headers: { "Cache-Control": "private, no-store" } });
}
