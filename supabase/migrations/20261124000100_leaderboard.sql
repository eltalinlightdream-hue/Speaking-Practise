-- Leaderboard: who practised the most today / this week (Asia/Tashkent time).
--
-- Students can only read their OWN practice_sessions (RLS). This function runs
-- as its owner so it can add up everyone's time, but it returns only a short
-- display name ("Aziza K."), the total seconds and the rank. No emails, no ids
-- of other people, no session details.
--
-- Only role 'student' is ranked (admins and the owner testing the app are left out).
-- Week = Monday to Sunday, Tashkent time.
-- Returns the top p_limit rows, plus the caller's own row if they are not in it.

create or replace function public.leaderboard(p_period text default 'day', p_limit integer default 20)
returns table (place bigint, display_name text, seconds bigint, is_me boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_from date;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_period = 'day' then
    v_from := v_today;
  elsif p_period = 'week' then
    v_from := date_trunc('week', v_today)::date; -- Monday
  else
    raise exception 'invalid period' using errcode = '22023';
  end if;

  return query
  with totals as (
    select s.user_id, sum(s.duration_seconds)::bigint as secs
    from public.practice_sessions s
    join public.profiles p on p.id = s.user_id
    where s.day_tashkent between v_from and v_today
      and p.role = 'student'
    group by s.user_id
    having sum(s.duration_seconds) >= 60
  ),
  ranked as (
    select t.user_id, t.secs,
      rank() over (order by t.secs desc) as place,
      row_number() over (order by t.secs desc, t.user_id) as rn
    from totals t
  )
  select
    r.place,
    nullif(btrim(
      split_part(btrim(p.full_name), ' ', 1) || ' ' ||
      case when split_part(btrim(p.full_name), ' ', 2) <> ''
        then left(split_part(btrim(p.full_name), ' ', 2), 1) || '.'
        else '' end
    ), '') as display_name,
    r.secs as seconds,
    r.user_id = (select auth.uid()) as is_me
  from ranked r
  join public.profiles p on p.id = r.user_id
  where r.rn <= v_limit or r.user_id = (select auth.uid())
  order by r.rn;
end;
$$;

revoke all on function public.leaderboard(text, integer) from public, anon;
grant execute on function public.leaderboard(text, integer) to authenticated;
