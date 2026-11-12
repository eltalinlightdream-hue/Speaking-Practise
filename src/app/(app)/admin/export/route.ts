import { NextResponse } from "next/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isExamCode } from "@/config/exams";

// Download all content as one JSON file (admins only).
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !isAdmin(profile)) return new NextResponse("Forbidden", { status: 403 });

  const exam = new URL(request.url).searchParams.get("exam");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_content", isExamCode(exam) ? { p_exam: exam } : {});
  if (error) return new NextResponse(error.message, { status: 500 });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="speaking-easy-content-${isExamCode(exam) ? `${exam}-` : ""}${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
