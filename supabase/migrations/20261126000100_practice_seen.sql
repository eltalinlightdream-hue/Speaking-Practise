-- General Training memory: what each student has already been asked.
--
-- Students said General Training repeated questions. The picker was fairly
-- random but had no memory, so the same question or cue card could come back
-- in the next session. Now the session builder (src/lib/practice/general-plan.ts)
-- picks unseen items first, then the ones seen longest ago.
--
-- One row = one thing a student was shown, with the last time it was shown:
--   item_key 't:<topic id>'                 a topic or cue card
--   item_key 'q<part>:<question text, lower case>'  a question (by text, so the
--                                            same question in two topics is one item)
-- At most one row per item, so a student has a few hundred rows at most.
--
-- Not a security matter (it only changes the order of questions), so students
-- write their own rows directly (RLS: own rows only).

create table if not exists public.practice_seen (
  user_id uuid not null references public.profiles (id) on delete cascade,
  exam public.exam_code not null,
  item_key text not null check (length(item_key) between 3 and 600),
  seen_at timestamptz not null default now(),
  primary key (user_id, exam, item_key)
);

alter table public.practice_seen enable row level security;

drop policy if exists "practice_seen read own" on public.practice_seen;
create policy "practice_seen read own" on public.practice_seen
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "practice_seen insert own" on public.practice_seen;
create policy "practice_seen insert own" on public.practice_seen
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "practice_seen update own" on public.practice_seen;
create policy "practice_seen update own" on public.practice_seen
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.practice_seen from anon;
revoke all on public.practice_seen from authenticated;
grant select, insert, update on public.practice_seen to authenticated;
