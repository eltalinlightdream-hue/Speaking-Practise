import "server-only";
import { getTranslations } from "next-intl/server";
import type { ReportLabels } from "./pdf";

/** The PDF texts in the reader's language (uz or en, from the NEXT_LOCALE cookie). */
export async function reportLabels(): Promise<ReportLabels> {
  const t = await getTranslations("report");
  return {
    brand: t("brand"),
    title: t("title"),
    student: t("student"),
    group: t("group"),
    week: t("week"),
    generated: t("generated"),
    totalTime: t("totalTime"),
    goalDays: t("goalDays"),
    sessions: t("sessions"),
    mockTests: t("mockTests"),
    daily: t("daily"),
    day: t("day"),
    time: t("time"),
    sessionsCol: t("sessionsCol"),
    goal: t("goal"),
    goalYes: t("goalYes"),
    goalNo: t("goalNo"),
    breakdown: t("breakdown"),
    general: t("general"),
    mock: t("mock"),
    mockCompleted: t("mockCompleted"),
    part: (n) => t("part", { n }),
    partsNone: t("partsNone"),
    note: t("note"),
    units: { h: t("unitH"), min: t("unitMin") },
  };
}
