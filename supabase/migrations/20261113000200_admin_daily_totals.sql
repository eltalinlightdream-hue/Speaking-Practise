-- Step 5: data for the admin weekly report and student pages.
--
-- One row per student per Tashkent day: practice seconds, number of sessions
-- and finished mock tests. Adding up in the database keeps the pages fast
-- (no need to send every session to the website).
--
-- Runs as the caller (security invoker), so row level security still applies,
-- and it returns nothing at all unless the caller is an admin or the owner.

create or replace function public.admin_daily_totals(p_from date, p_to date)
returns table (user_id uuid, day date, seconds integer, sessions integer, mocks_completed integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.user_id,
         s.day_tashkent as day,
         sum(s.duration_seconds)::integer as seconds,
         count(*)::integer as sessions,
         (count(*) filter (where s.mode = 'mock' and s.completed))::integer as mocks_completed
  from public.practice_sessions s
  where (select private.is_admin())
    and s.day_tashkent between p_from and p_to
  group by s.user_id, s.day_tashkent
$$;

revoke all on function public.admin_daily_totals(date, date) from public, anon;
grant execute on function public.admin_daily_totals(date, date) to authenticated;
