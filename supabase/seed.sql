-- Example lesson groups. Safe to run more than once.
insert into public.lesson_groups (name) values
  ('IELTS Morning A'),
  ('IELTS Evening B'),
  ('CEFR Group 1'),
  ('Individual')
on conflict (name) do nothing;
