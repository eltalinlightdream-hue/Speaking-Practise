-- Step 3: practice sessions (time tracking).
--
-- Students never write this table directly. They go through two functions:
--   start_practice_session(...)            creates a row and returns its id
--   practice_session_progress(id, s, done)  saves active seconds (every ~30 s,
--                                           and once more when the session ends)
-- The saved time can never be more than the real time since the session
-- started, so practice minutes cannot be faked from the browser.
--
-- day_tashkent is the Tashkent calendar day on which the session STARTED.
-- A session that crosses midnight counts for the day it started.

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('general', 'mock')),
  exam public.exam_code not null,
  parts smallint[] not null default '{}',
  mock_set_id uuid references public.mock_sets (id) on delete set null,
  recording_type text not null default 'none' check (recording_type in ('none', 'audio', 'video')),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  completed boolean not null default false,
  day_tashkent date not null default ((now() at time zone 'Asia/Tashkent')::date)
);

create index if not exists practice_sessions_user_day_idx on public.practice_sessions (user_id, day_tashkent);
create index if not exists practice_sessions_day_idx on public.practice_sessions (day_tashkent);
create index if not exists practice_sessions_mock_set_id_idx on public.practice_sessions (mock_set_id);

alter table public.practice_sessions enable row level security;

drop policy if exists "practice_sessions read own or admin" on public.practice_sessions;
create policy "practice_sessions read own or admin" on public.practice_sessions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

revoke all on public.practice_sessions from anon;
revoke insert, update, delete on public.practice_sessions from authenticated;
grant select on public.practice_sessions to authenticated;

-- Longest a single session can count (protects against a tab left open for days).
create or replace function private.max_session_seconds()
returns integer language sql immutable as $$ select 3 * 60 * 60 $$;

create or replace function public.start_practice_session(
  p_mode text,
  p_exam public.exam_code,
  p_parts smallint[],
  p_recording_type text,
  p_mock_set_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_mode not in ('general', 'mock') then
    raise exception 'invalid mode' using errcode = '22023';
  end if;
  if coalesce(p_recording_type, 'none') not in ('none', 'audio', 'video') then
    raise exception 'invalid recording type' using errcode = '22023';
  end if;

  insert into public.practice_sessions (user_id, mode, exam, parts, recording_type, mock_set_id)
  values ((select auth.uid()), p_mode, p_exam, coalesce(p_parts, '{}'), coalesce(p_recording_type, 'none'), p_mock_set_id)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.practice_session_progress(
  p_session_id uuid,
  p_active_seconds integer,
  p_finished boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.practice_sessions%rowtype;
  v_wall integer;
  v_seconds integer;
begin
  select * into v_row from public.practice_sessions
  where id = p_session_id and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  -- A finished session is closed; later calls change nothing.
  if v_row.ended_at is not null then
    return v_row.duration_seconds;
  end if;

  v_wall := ceil(extract(epoch from (now() - v_row.started_at)))::integer + 5;
  v_seconds := least(greatest(coalesce(p_active_seconds, 0), 0), v_wall, private.max_session_seconds());
  -- Never go backwards (a late, smaller report must not erase time).
  v_seconds := greatest(v_seconds, v_row.duration_seconds);

  update public.practice_sessions set
    duration_seconds = v_seconds,
    last_seen_at = now(),
    ended_at = case when p_finished then now() else null end,
    completed = p_finished
  where id = v_row.id;

  return v_seconds;
end;
$$;

revoke all on function private.max_session_seconds() from public, anon;
grant execute on function private.max_session_seconds() to authenticated;
revoke all on function public.start_practice_session(text, public.exam_code, smallint[], text, uuid) from public, anon;
revoke all on function public.practice_session_progress(uuid, integer, boolean) from public, anon;
grant execute on function public.start_practice_session(text, public.exam_code, smallint[], text, uuid) to authenticated;
grant execute on function public.practice_session_progress(uuid, integer, boolean) to authenticated;
