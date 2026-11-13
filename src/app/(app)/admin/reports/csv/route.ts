import { NextResponse } from "next/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { loadWeeklyReport } from "@/lib/admin/queries";
import { reportCsv } from "@/lib/admin/report";
import { readReportParams } from "../params";

// The weekly report as a CSV file. Admins only (the database checks again).
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !isAdmin(profile)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const { monday, group } = readReportParams(Object.fromEntries(url.searchParams));
  const { groups, report } = await loadWeeklyReport(monday, group);
  const names = new Map(groups.map((g) => [g.id, g.name]));
  const csv = reportCsv(report, (id) => (id ? (names.get(id) ?? "") : ""));

  const groupPart = group ? `_${(names.get(group) ?? "group").replace(/[^\p{L}\p{N}]+/gu, "-")}` : "";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="speaking-easy_week_${monday}${encodeURIComponent(groupPart)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
