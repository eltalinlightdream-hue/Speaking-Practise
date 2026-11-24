-- Lesson groups per teacher, and admins can edit a student's name and group.
--
-- Three teachers share the website. Each teacher has groups on even days and
-- on odd days at 08:00, 10:00, 13:00, 15:00 and 17:00 (30 groups in total).
-- teacher / day_pattern / start_time let the app show the groups sorted and
-- translated ("Juft kunlar" / "Even days"); name stays unique and readable.
--
-- The old example groups are disabled (not deleted), so students who were in
-- them keep their history and are asked to choose a new group in Settings.

alter table public.lesson_groups
  add column if not exists teacher text check (teacher is null or char_length(btrim(teacher)) between 1 and 60),
  add column if not exists day_pattern text check (day_pattern is null or day_pattern in ('even', 'odd')),
  add column if not exists start_time time,
  add column if not exists sort_order integer not null default 0;

update public.lesson_groups set active = false where teacher is null;

insert into public.lesson_groups (name, teacher, day_pattern, start_time, sort_order, active)
select
  t.teacher || ' · ' || case d.pattern when 'even' then 'Even days' else 'Odd days' end || ' · ' || to_char(s.at, 'HH24:MI'),
  t.teacher, d.pattern, s.at, t.n * 100 + d.n * 10 + s.n, true
from (values (1, 'Abduraimov Erkinjon'), (2, 'Hojiakbar'), (3, 'Murodjon')) as t (n, teacher)
cross join (values (1, 'even'), (2, 'odd')) as d (n, pattern)
cross join (values (1, time '08:00'), (2, time '10:00'), (3, time '13:00'), (4, time '15:00'), (5, time '17:00')) as s (n, at)
on conflict (name) do update set
  teacher = excluded.teacher,
  day_pattern = excluded.day_pattern,
  start_time = excluded.start_time,
  sort_order = excluded.sort_order,
  active = true;

-- ---------------------------------------------------------------------------
-- Admins change a student's name and group. Same rule as deleting:
-- admins edit students; only the owner edits admins (and the owner).
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_profile(p_user_id uuid, p_full_name text, p_lesson_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller public.app_role := private.current_app_role();
  v_target public.app_role;
  v_name text;
begin
  if v_caller is null or v_caller not in ('admin', 'owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select role into v_target from public.profiles where id = p_user_id;
  if v_target is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if v_target <> 'student' and v_caller <> 'owner' and p_user_id <> (select auth.uid()) then
    raise exception 'only the owner can edit admins' using errcode = '42501';
  end if;

  v_name := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  if char_length(v_name) not between 2 and 100 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if p_lesson_group_id is not null and not exists (select 1 from public.lesson_groups g where g.id = p_lesson_group_id) then
    raise exception 'group not found' using errcode = 'P0002';
  end if;

  update public.profiles set full_name = v_name, lesson_group_id = p_lesson_group_id where id = p_user_id;
end;
$$;

revoke all on function public.admin_update_profile(uuid, text, uuid) from public, anon;
grant execute on function public.admin_update_profile(uuid, text, uuid) to authenticated;
