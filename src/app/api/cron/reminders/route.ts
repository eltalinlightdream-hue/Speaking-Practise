import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeEqual } from "@/lib/telegram-auth";
import { telegramApi } from "@/lib/telegram-bot";
import { addDays, summarise, tashkentDay } from "@/lib/practice/streak";
import { decide, type ReminderDecision, type ReminderKind, type ReminderSession } from "@/lib/reminders/plan";
import { buildReminder } from "@/lib/reminders/messages";

// Called every 15 minutes by the database (pg_cron + pg_net, migration
// 20261126000200). Header: "Authorization: Bearer <CRON_SECRET>".
//
//   POST /api/cron/reminders              send the reminders that are due now
//   POST /api/cron/reminders?dry=1        only list who would get what (sends nothing)
//   POST /api/cron/reminders?user=<id>&kind=daily|streak|stop
//                                         test: send that reminder to one account now
//                                         (ignores the time rules; not saved in the log)

export const maxDuration = 120;

const UUID = /^[0-9a-f-]{36}$/i;
const PAGE = 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Target = {
  user_id: string;
  telegram_id: number | string;
  full_name: string | null;
  language: string | null;
  reminder_time: string | null;
  created_at: string;
};
type SessionRow = ReminderSession & { user_id: string };
type LogRow = { user_id: string; day_tashkent: string; kind: ReminderKind };
type SendAnswer = { ok: boolean; error_code?: number; description?: string; parameters?: { retry_after?: number } };

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !given || !safeEqual(given, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin || !process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const site = url.origin;
  const dry = url.searchParams.get("dry") === "1";
  const testUser = url.searchParams.get("user");
  const testKind = url.searchParams.get("kind") as ReminderKind | null;
  if (testUser && !UUID.test(testUser)) return NextResponse.json({ ok: false, error: "bad user" }, { status: 400 });
  if (testKind && !["daily", "streak", "stop"].includes(testKind)) {
    return NextResponse.json({ ok: false, error: "bad kind" }, { status: 400 });
  }

  const now = new Date();
  const today = tashkentDay(now);

  const targetsRes = await admin.rpc("reminder_targets", { p_user: testUser ?? null });
  if (targetsRes.error) return NextResponse.json({ ok: false, error: targetsRes.error.message }, { status: 500 });
  const targets = (targetsRes.data ?? []) as Target[];
  const ids = targets.map((t) => t.user_id);

  // Practice history (long enough for long streaks) and the last 14 days of reminders.
  const sessions: SessionRow[] = [];
  const logs: LogRow[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from("practice_sessions")
        .select("user_id, day_tashkent, duration_seconds, started_at, last_seen_at, ended_at")
        .in("user_id", chunk)
        .gte("day_tashkent", addDays(today, -400))
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      sessions.push(...((data ?? []) as SessionRow[]));
      if ((data ?? []).length < PAGE) break;
    }
    const { data: logData, error: logError } = await admin
      .from("reminder_log")
      .select("user_id, day_tashkent, kind")
      .in("user_id", chunk)
      .gte("day_tashkent", addDays(today, -15))
      .limit(PAGE * 5);
    if (logError) return NextResponse.json({ ok: false, error: logError.message }, { status: 500 });
    logs.push(...((logData ?? []) as LogRow[]));
  }

  const result = { due: 0, sent: 0, failed: 0, skipped: 0, preview: [] as { user_id: string; kind: string; variant: string; text: string }[] };

  for (const t of targets) {
    const mySessions = sessions.filter((s) => s.user_id === t.user_id);
    let decision: ReminderDecision | null;
    if (testUser && testKind) {
      const summary = summarise(mySessions, now);
      decision = {
        kind: testKind,
        variant: testKind === "daily" ? (summary.current >= 1 ? "keep" : "start") : null,
        streak: Math.max(summary.current, testKind === "streak" ? 2 : 0),
        minutesLeft: Math.max(1, Math.ceil((900 - summary.secondsToday) / 60)),
      };
    } else {
      decision = decide(
        {
          reminderTime: t.reminder_time,
          createdAt: t.created_at,
          sessions: mySessions,
          log: logs.filter((l) => l.user_id === t.user_id),
        },
        now,
      );
    }
    if (!decision) continue;
    result.due++;

    const message = buildReminder(decision, { fullName: t.full_name, language: t.language }, site);
    if (dry) {
      result.preview.push({ user_id: t.user_id, kind: decision.kind, variant: message.variant, text: message.text });
      continue;
    }

    // Claim today's slot first, so two runs at the same time never send twice.
    let logId: number | null = null;
    if (!testKind) {
      const claim = await admin
        .from("reminder_log")
        .upsert(
          { user_id: t.user_id, day_tashkent: today, kind: decision.kind, variant: message.variant },
          { onConflict: "user_id,day_tashkent,kind", ignoreDuplicates: true },
        )
        .select("id");
      if (claim.error || !claim.data?.length) {
        result.skipped++;
        continue;
      }
      logId = (claim.data[0] as { id: number }).id;
    }

    const body = { chat_id: Number(t.telegram_id), text: message.text, reply_markup: message.reply_markup, link_preview_options: { is_disabled: true } };
    let answer = (await telegramApi("sendMessage", body)) as SendAnswer;
    if (!answer.ok && answer.error_code === 429) {
      await sleep(Math.min(answer.parameters?.retry_after ?? 1, 30) * 1000);
      answer = (await telegramApi("sendMessage", body)) as SendAnswer;
    }

    if (answer.ok) {
      result.sent++;
      if (logId !== null) await admin.from("reminder_log").update({ delivered: true }).eq("id", logId);
      // The goodbye message turns reminders off.
      if (decision.kind === "stop" && !testKind) await admin.from("profiles").update({ reminders_enabled: false }).eq("id", t.user_id);
    } else {
      result.failed++;
      // 403 = the student blocked the bot: stop trying until they turn reminders on again.
      if (answer.error_code === 403 && !testKind) await admin.from("profiles").update({ reminders_enabled: false }).eq("id", t.user_id);
      console.warn("reminder not delivered:", answer.error_code, answer.description);
    }
    await sleep(50);
  }

  return NextResponse.json({ ok: true, at: now.toISOString(), targets: targets.length, ...result, preview: dry ? result.preview : undefined });
}
