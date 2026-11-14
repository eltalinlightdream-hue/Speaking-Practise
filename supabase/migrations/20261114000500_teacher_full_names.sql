-- Teachers' full names in the lesson groups, surname first like
-- "Abduraimov Erkinjon": "Hojiakbar" -> "Odilov Hojiakbar",
-- "Murodjon" -> "Maʼmurjonov Murodjon". The readable name is rebuilt the same
-- way as in 20261114000200 ("Teacher · Even days · 08:00"). Students keep
-- their group (only the text changes, the ids stay).

update public.lesson_groups g
set
  teacher = v.full_name,
  name = v.full_name || ' · ' || case g.day_pattern when 'even' then 'Even days' else 'Odd days' end || ' · ' || to_char(g.start_time, 'HH24:MI')
from (values ('Hojiakbar', 'Odilov Hojiakbar'), ('Murodjon', 'Maʼmurjonov Murodjon')) as v (old_name, full_name)
where g.teacher = v.old_name
  and g.day_pattern is not null
  and g.start_time is not null;
