-- Step 4: mock test history (which full mock sets a student has finished).
--
-- Rotation rule: a student never gets the same mock set twice until every
-- active set has been done. When the last set of a cycle is finished, the
-- next mock starts a new cycle and all sets become available again.
--
-- One row = one FINISHED mock set in one cycle. A mock that was left halfway
-- writes nothing here, so it can still come up again.
--
-- Students never write this table. The row is added inside
-- practice_session_progress() when a mock session finishes to the very end,
-- so the rotation cannot be faked from the browser.

create table if not exists public.mock_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  exam public.exam_code not null,
  mock_set_id uuid not null references public.mock_sets (id) on delete cascade,
  session_id uuid references public.practice_sessions (id) on delete set null,
  cycle integer not null default 1 check (cycle >= 1),
  completed_at timestamptz not null default now()
);

-- The same set can be finished once per cycle.
create unique index if not exists mock_history_user_exam_cycle_set_key
  on public.mock_history (user_id, exam, cycle, mock_set_id);
create index if not exists mock_history_user_exam_idx on public.mock_history (user_id, exam);
create index if not exists mock_history_mock_set_id_idx on public.mock_history (mock_set_id);

alter table public.mock_history enable row level security;

drop policy if exists "mock_history read own or admin" on public.mock_history;
create policy "mock_history read own or admin" on public.mock_history
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

revoke all on public.mock_history from anon;
revoke insert, update, delete on public.mock_history from authenticated;
grant select on public.mock_history to authenticated;

-- ---------------------------------------------------------------------------
-- practice_session_progress now separates two different things:
--
--   p_finished   the session is over (closes it, sets ended_at).
--                Pressing "End session" halfway also finishes it.
--   p_completed  the student reached the END of the exam. Only this counts
--                for the mock rotation.
--
-- The old three-argument version is replaced.
-- ---------------------------------------------------------------------------
drop function if exists public.practice_session_progress(uuid, integer, boolean);

create or replace function public.practice_session_progress(
  p_session_id uuid,
  p_active_seconds integer,
  p_finished boolean default false,
  p_completed boolean default false
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
  v_completed boolean;
  v_cycle integer;
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
  v_completed := v_row.completed or (coalesce(p_finished, false) and coalesce(p_completed, false));

  update public.practice_sessions set
    duration_seconds = v_seconds,
    last_seen_at = now(),
    ended_at = case when p_finished then now() else null end,
    completed = v_completed
  where id = v_row.id;

  -- A mock test that was finished to the end goes into the history, so the
  -- same set is not offered again until the cycle is over.
  if v_completed and v_row.mode = 'mock' and v_row.mock_set_id is not null then
    select coalesce(max(h.cycle), 1) into v_cycle
    from public.mock_history h
    where h.user_id = v_row.user_id and h.exam = v_row.exam;

    -- Already done in this cycle? Then this is the first set of the next one.
    if exists (
      select 1 from public.mock_history h
      where h.user_id = v_row.user_id and h.exam = v_row.exam
        and h.cycle = v_cycle and h.mock_set_id = v_row.mock_set_id
    ) then
      v_cycle := v_cycle + 1;
    end if;

    insert into public.mock_history (user_id, exam, mock_set_id, session_id, cycle)
    values (v_row.user_id, v_row.exam, v_row.mock_set_id, v_row.id, v_cycle)
    on conflict do nothing;
  end if;

  return v_seconds;
end;
$$;

revoke all on function public.practice_session_progress(uuid, integer, boolean, boolean) from public, anon;
grant execute on function public.practice_session_progress(uuid, integer, boolean, boolean) to authenticated;
