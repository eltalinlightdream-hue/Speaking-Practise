import "server-only";
import { createClient } from "@/lib/supabase/server";
import { summarise, type PracticeSummary } from "./streak";
import { isMonth, monthOf } from "./calendar";

const RECENT = 20;

export type SessionRow = {
  id: string;
  mode: "general" | "mock";
  exam: string;
  parts: number[];
  started_at: string;
  duration_seconds: number;
  completed: boolean;
  ended_at: string | null;
  mock_sets: { name: string } | null;
};

export type ProgressData = { summary: PracticeSummary; sessions: SessionRow[]; month: string; thisMonth: string };

/**
 * Everything the progress view shows for one user. Row level security lets a
 * student read only their own sessions, and admins read everyone's.
 */
export async function loadProgress(userId: string, monthParam: unknown): Promise<ProgressData> {
  const supabase = await createClient();
  const [days, recent] = await Promise.all([
    supabase.from("practice_sessions").select("day_tashkent, duration_seconds").eq("user_id", userId),
    supabase
      .from("practice_sessions")
      .select("id, mode, exam, parts, started_at, duration_seconds, completed, ended_at, mock_sets(name)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(RECENT),
  ]);
  if (days.error) throw new Error(days.error.message);
  if (recent.error) throw new Error(recent.error.message);

  const summary = summarise(days.data ?? []);
  // Which month the calendar shows (never later than this month).
  const thisMonth = monthOf(summary.today);
  const month = isMonth(monthParam) && monthParam <= thisMonth ? monthParam : thisMonth;
  return { summary, sessions: (recent.data ?? []) as unknown as SessionRow[], month, thisMonth };
}
