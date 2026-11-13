-- Step 2: question content, mock sets and question audio storage.
--
-- topics     one row per Part 1 topic, Part 2 cue card or Part 3 discussion topic.
--            A topic is identified by (exam, part, title).
--            Part 2 cue cards keep their bullets in cue_bullets and the
--            "and explain ..." line in cue_explain.
--            Part 3 topics point at their Part 2 cue card with related_topic_id.
-- questions  the questions of a topic. Disabled instead of deleted.
-- mock_sets  one full exam (for IELTS: one Part 1 topic, one cue card, one Part 3 topic).
-- mock_set_topics  which topics make up each mock set, per part, in order.
--
-- "part" is a plain number so CEFR can use different parts later.

do $$ begin
  create type public.exam_code as enum ('ielts', 'cefr');
exception when duplicate_object then null; end $$;

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  exam public.exam_code not null,
  part smallint not null check (part between 1 and 9),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  is_core boolean not null default false,
  related_topic_id uuid references public.topics (id) on delete set null,
  cue_bullets text[] not null default '{}',
  cue_explain text,
  is_placeholder boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists topics_exam_part_title_key on public.topics (exam, part, lower(btrim(title)));
create index if not exists topics_related_topic_id_idx on public.topics (related_topic_id);
create index if not exists topics_exam_part_active_idx on public.topics (exam, part) where active;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 2 and 500),
  sort_order integer not null default 0,
  audio_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists questions_topic_text_key on public.questions (topic_id, lower(btrim(text)));
create index if not exists questions_topic_id_idx on public.questions (topic_id, sort_order);

create table if not exists public.mock_sets (
  id uuid primary key default gen_random_uuid(),
  exam public.exam_code not null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mock_sets_exam_name_key on public.mock_sets (exam, lower(btrim(name)));

create table if not exists public.mock_set_topics (
  mock_set_id uuid not null references public.mock_sets (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete restrict,
  part smallint not null check (part between 1 and 9),
  sort_order integer not null default 0,
  primary key (mock_set_id, topic_id)
);

create index if not exists mock_set_topics_topic_id_idx on public.mock_set_topics (topic_id);

-- updated_at triggers
drop trigger if exists topics_touch_updated_at on public.topics;
create trigger topics_touch_updated_at before update on public.topics
  for each row execute function private.touch_updated_at();
drop trigger if exists questions_touch_updated_at on public.questions;
create trigger questions_touch_updated_at before update on public.questions
  for each row execute function private.touch_updated_at();
drop trigger if exists mock_sets_touch_updated_at on public.mock_sets;
create trigger mock_sets_touch_updated_at before update on public.mock_sets
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: signed-in users read active content, admins manage it.
-- ---------------------------------------------------------------------------
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.mock_sets enable row level security;
alter table public.mock_set_topics enable row level security;

revoke all on public.topics, public.questions, public.mock_sets, public.mock_set_topics from anon;

-- topics
drop policy if exists "topics read" on public.topics;
create policy "topics read" on public.topics for select to authenticated
  using (active or (select private.is_admin()));
drop policy if exists "topics admin insert" on public.topics;
create policy "topics admin insert" on public.topics for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists "topics admin update" on public.topics;
create policy "topics admin update" on public.topics for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "topics admin delete" on public.topics;
create policy "topics admin delete" on public.topics for delete to authenticated
  using ((select private.is_admin()));

-- questions (a student sees a question only when it and its topic are active)
drop policy if exists "questions read" on public.questions;
create policy "questions read" on public.questions for select to authenticated
  using (
    (select private.is_admin())
    or (active and exists (select 1 from public.topics t where t.id = topic_id and t.active))
  );
drop policy if exists "questions admin insert" on public.questions;
create policy "questions admin insert" on public.questions for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists "questions admin update" on public.questions;
create policy "questions admin update" on public.questions for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "questions admin delete" on public.questions;
create policy "questions admin delete" on public.questions for delete to authenticated
  using ((select private.is_admin()));

-- mock_sets
drop policy if exists "mock_sets read" on public.mock_sets;
create policy "mock_sets read" on public.mock_sets for select to authenticated
  using (active or (select private.is_admin()));
drop policy if exists "mock_sets admin insert" on public.mock_sets;
create policy "mock_sets admin insert" on public.mock_sets for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists "mock_sets admin update" on public.mock_sets;
create policy "mock_sets admin update" on public.mock_sets for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "mock_sets admin delete" on public.mock_sets;
create policy "mock_sets admin delete" on public.mock_sets for delete to authenticated
  using ((select private.is_admin()));

-- mock_set_topics
drop policy if exists "mock_set_topics read" on public.mock_set_topics;
create policy "mock_set_topics read" on public.mock_set_topics for select to authenticated
  using (
    (select private.is_admin())
    or exists (select 1 from public.mock_sets m where m.id = mock_set_id and m.active)
  );
drop policy if exists "mock_set_topics admin insert" on public.mock_set_topics;
create policy "mock_set_topics admin insert" on public.mock_set_topics for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists "mock_set_topics admin update" on public.mock_set_topics;
create policy "mock_set_topics admin update" on public.mock_set_topics for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "mock_set_topics admin delete" on public.mock_set_topics;
create policy "mock_set_topics admin delete" on public.mock_set_topics for delete to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Storage bucket for optional question audio files.
-- Public read (the files are just question audio), admin-only write.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-audio', 'question-audio', true, 5242880,
        array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "question-audio admin insert" on storage.objects;
create policy "question-audio admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'question-audio' and (select private.is_admin()));
drop policy if exists "question-audio admin update" on storage.objects;
create policy "question-audio admin update" on storage.objects for update to authenticated
  using (bucket_id = 'question-audio' and (select private.is_admin()))
  with check (bucket_id = 'question-audio' and (select private.is_admin()));
drop policy if exists "question-audio admin delete" on storage.objects;
create policy "question-audio admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'question-audio' and (select private.is_admin()));
