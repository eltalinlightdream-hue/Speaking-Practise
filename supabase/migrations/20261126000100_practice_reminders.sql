-- Daily practice reminders through the Telegram bot (like Duolingo).
--
-- Every 15 minutes the database calls the site (/api/cron/reminders, see the
-- next migration). The site decides who gets a reminder now
-- (src/lib/reminders/plan.ts) and sends it through the bot.
--
-- profiles.reminders_enabled  on for everyone by default; the student can turn it
--                             off in Settings or with the "turn off" button in a message.
-- profiles.reminder_time      null = automatic (30 min before the time they
--                             usually practise, 18:00 until we know), or a fixed time.
-- reminder_log                one row per reminder per day per kind, so nobody
--                             gets the same reminder twice (the row is written
--                             BEFORE sending; a second run sees it and skips).

alter table public.profiles
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists reminder_time time
    check (reminder_time is null or reminder_time between time '08:00' and time '21:00');

-- Students may change these two on their own row (RLS already limits rows to their own).
grant update (reminders_enabled, reminder_time) on public.profiles to authenticated;

create table if not exists public.reminder_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_tashkent date not null,
  kind text not null check (kind in ('daily', 'streak', 'stop')),
  variant text,
  delivered boolean not null default false,
  sent_at timestamptz not null default now(),
  unique (user_id, day_tashkent, kind)
);

create index if not exists reminder_log_day_idx on public.reminder_log (day_tashkent);

alter table public.reminder_log enable row level security;

drop policy if exists "reminder_log admin read" on public.reminder_log;
create policy "reminder_log admin read" on public.reminder_log
  for select to authenticated
  using ((select private.is_admin()));

revoke all on public.reminder_log from anon;
revoke insert, update, delete on public.reminder_log from authenticated;
grant select on public.reminder_log to authenticated;

-- Who can get a reminder: students with reminders on and a Telegram account.
-- With p_user: just that account, whatever its role or setting (for a test send).
-- Server only (service role): it returns Telegram ids.
create or replace function public.reminder_targets(p_user uuid default null)
returns table (
  user_id uuid,
  telegram_id bigint,
  full_name text,
  language text,
  reminder_time time,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.tg, r.full_name, r.language, r.reminder_time, r.created_at
  from (
    select p.id, private.telegram_id_of(p.id) as tg, p.full_name, p.language, p.reminder_time, p.created_at
    from public.profiles p
    where (p_user is null and p.role = 'student' and p.reminders_enabled)
       or p.id = p_user
  ) r
  where r.tg is not null;
$$;

-- The "turn off reminders" button in a Telegram message.
-- Server only (service role): called by the bot webhook with the Telegram user id.
create or replace function public.reminders_off_by_telegram(p_telegram_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.profiles p set reminders_enabled = false
  where p.id in (
    select u.id from auth.users u
    where u.raw_user_meta_data ->> 'telegram_id' = p_telegram_id::text
       or u.email = 'telegram-' || p_telegram_id::text || '@users.invalid'
  );
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.reminder_targets(uuid) from public, anon, authenticated;
revoke all on function public.reminders_off_by_telegram(bigint) from public, anon, authenticated;
grant execute on function public.reminder_targets(uuid) to service_role;
grant execute on function public.reminders_off_by_telegram(bigint) to service_role;
