-- Offline practice.
--
-- A student without internet can still practise. The phone keeps the session
-- (its own id, start time, active seconds) and sends it when the internet is
-- back. This function creates that session row with the real start time.
-- After it, the normal practice_session_progress() saves the seconds, so the
-- usual rules still apply: never more than the real time since the start,
-- at most 3 hours, mock history only for a mock finished to the end.
--
-- Calling it again with the same id is safe (it changes nothing), because the
-- phone retries until it gets an answer. Sessions older than 7 days are refused.

create or replace function public.start_offline_session(
  p_id uuid,
  p_mode text,
  p_exam public.exam_code,
  p_parts smallint[],
  p_recording_type text,
  p_mock_set_id uuid,
  p_started_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
  v_start timestamptz;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'missing id' using errcode = '22023';
  end if;

  select s.user_id into v_owner from public.practice_sessions s where s.id = p_id;
  if found then
    if v_owner <> v_uid then
      raise exception 'session not found' using errcode = 'P0002';
    end if;
    return p_id;
  end if;

  if p_mode not in ('general', 'mock') then
    raise exception 'invalid mode' using errcode = '22023';
  end if;
  if coalesce(p_recording_type, 'none') not in ('none', 'audio', 'video') then
    raise exception 'invalid recording type' using errcode = '22023';
  end if;
  if p_started_at is null or p_started_at > now() + interval '5 minutes' or p_started_at < now() - interval '7 days' then
    raise exception 'start time out of range' using errcode = '22023';
  end if;
  if p_mode = 'mock' and (p_mock_set_id is null or not exists (select 1 from public.mock_sets m where m.id = p_mock_set_id)) then
    raise exception 'mock set not found' using errcode = 'P0002';
  end if;

  v_start := least(p_started_at, now());
  insert into public.practice_sessions
    (id, user_id, mode, exam, parts, recording_type, mock_set_id, started_at, last_seen_at, day_tashkent)
  values
    (p_id, v_uid, p_mode, p_exam, coalesce(p_parts, '{}'), coalesce(p_recording_type, 'none'),
     case when p_mode = 'mock' then p_mock_set_id end, v_start, now(), (v_start at time zone 'Asia/Tashkent')::date);
  return p_id;
end;
$$;

revoke all on function public.start_offline_session(uuid, text, public.exam_code, smallint[], text, uuid, timestamptz) from public, anon;
grant execute on function public.start_offline_session(uuid, text, public.exam_code, smallint[], text, uuid, timestamptz) to authenticated;
