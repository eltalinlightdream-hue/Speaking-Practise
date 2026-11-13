import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DAY_GOAL_SECONDS, addDays, weekDays } from "./week";

export type WeeklyDay = { date: string; seconds: number; sessions: number; goalMet: boolean };

export type WeeklyReport = {
  student: { id: string; name: string; email: string | null; group: string | null };
  weekStart: string;
  weekEnd: string;
  days: WeeklyDay[];
  totalSeconds: number;
  goalDays: number;
  sessions: number;
  generalSessions: number;
  mockSessions: number;
  mockCompleted: number;
  /** Sessions per part number, e.g. { 1: 4, 2: 1, 3: 3 } */
  parts: Record<number, number>;
};

type SessionRow = { day_tashkent: string; duration_seconds: number; mode: "general" | "mock"; parts: number[]; completed: boolean };

/**
 * Load one person's practice for the week starting on `monday`.
 * Runs as the signed-in user, so row level security decides what is visible:
 * students see only themselves, admins see everyone. Returns null if the
 * profile is not visible.
 */
export async function loadWeeklyReport(userId: string, monday: string): Promise<WeeklyReport | null> {
  const supabase = await createClient();
  const sunday = addDays(monday, 6);

  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, lesson_groups(name)").eq("id", userId).maybeSingle(),
    supabase
      .from("practice_sessions")
      .select("day_tashkent, duration_seconds, mode, parts, completed")
      .eq("user_id", userId)
      .gte("day_tashkent", monday)
      .lte("day_tashkent", sunday),
  ]);
  if (!profile) return null;
  if (error) throw new Error(error.message);

  const sessions = (rows ?? []) as SessionRow[];
  const group = (profile as { lesson_groups: { name: string } | { name: string }[] | null }).lesson_groups;
  const groupName = Array.isArray(group) ? (group[0]?.name ?? null) : (group?.name ?? null);

  const days = weekDays(monday).map((date) => {
    const mine = sessions.filter((s) => s.day_tashkent === date);
    const seconds = mine.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    return { date, seconds, sessions: mine.length, goalMet: seconds >= DAY_GOAL_SECONDS };
  });

  const parts: Record<number, number> = {};
  for (const s of sessions) for (const p of s.parts ?? []) parts[p] = (parts[p] ?? 0) + 1;

  return {
    student: {
      id: profile.id as string,
      name: (profile.full_name as string | null) ?? (profile.email as string | null) ?? "—",
      email: profile.email as string | null,
      group: groupName,
    },
    weekStart: monday,
    weekEnd: sunday,
    days,
    totalSeconds: days.reduce((sum, d) => sum + d.seconds, 0),
    goalDays: days.filter((d) => d.goalMet).length,
    sessions: sessions.length,
    generalSessions: sessions.filter((s) => s.mode === "general").length,
    mockSessions: sessions.filter((s) => s.mode === "mock").length,
    mockCompleted: sessions.filter((s) => s.mode === "mock" && s.completed).length,
    parts,
  };
}
