import { getLocale } from "next-intl/server";
import { getCurrentProfile, isAdmin, isSetupComplete } from "@/lib/auth";
import { buildWeeklyPdf, reportFileName } from "@/lib/report/pdf";
import { reportLabels } from "@/lib/report/labels";
import { loadWeeklyReport } from "@/lib/report/weekly";
import { resolveWeek } from "@/lib/report/week";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /progress/report?week=YYYY-MM-DD[&user=<id>]
 * Downloads a one-page weekly PDF report. Students get their own report.
 * Admins and the owner may add ?user= to download any student's report
 * (the database checks this again with row level security).
 */
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !isSetupComplete(profile)) return new Response("Not signed in", { status: 401 });

  const params = new URL(request.url).searchParams;
  const requested = params.get("user");
  const userId = requested && UUID.test(requested) ? requested : profile.id;
  if (userId !== profile.id && !isAdmin(profile)) return new Response("Forbidden", { status: 403 });

  const monday = resolveWeek(params.get("week"));
  const report = await loadWeeklyReport(userId, monday);
  if (!report) return new Response("Not found", { status: 404 });

  const pdf = await buildWeeklyPdf(report, await reportLabels(), await getLocale());
  return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${reportFileName(report)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
