-- CEFR (Multi-Level) format, decided 2026-11-20 from the "Recent Speaking Questions" booklet.
--
-- The real CEFR speaking exam has four sections. They are stored as part numbers:
--   part 1 = Part 1.1  three short questions about you (30 s each)
--   part 2 = Part 1.2  two pictures and three questions (45 s, then 30 s each)
--   part 3 = Part 2    one picture and three questions (1 min to prepare, 2 min to speak)
--   part 4 = Part 3    a statement with arguments for and against (1 min to prepare, 2 min to speak)
-- Labels and timers live in src/config/exams.ts.
--
-- New topic columns:
--   images          pictures shown with a topic: [{"url": "/content/...", "alt": "..."}]
--   points_for      Part 3 (debate): arguments for the statement in the title
--   points_against  Part 3 (debate): arguments against it
-- Part 2 cards keep their three questions in cue_bullets (like IELTS cue card bullets).
--
-- Also: export/import (speaking-easy-content/v2) now carry the new columns,
-- the old CEFR placeholders are disabled, and earlier CEFR practice sessions
-- get their part numbers moved to the new numbering (old 2 = card -> 3, old 3 = discussion -> 4).

alter table public.topics
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists points_for text[] not null default '{}',
  add column if not exists points_against text[] not null default '{}';

do $$ begin
  alter table public.topics add constraint topics_images_is_array check (jsonb_typeof(images) = 'array');
exception when duplicate_object then null; end $$;

-- Earlier CEFR sessions (placeholder practice): move to the new part numbers.
-- Runs only while no CEFR Part 4 topic exists yet, so running this file again changes nothing.
update public.practice_sessions
set parts = array(select case p when 2 then 3 when 3 then 4 else p end from unnest(parts) as p)
where exam = 'cefr'
  and not exists (select 1 from public.topics where exam = 'cefr' and part = 4);

-- The placeholders are replaced by real content (supabase/seed_cefr_content.sql).
update public.topics set active = false where exam = 'cefr' and is_placeholder and active;

create or replace function public.export_content(p_exam public.exam_code default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'format', 'speaking-easy-content/v2',
    'exported_at', now(),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'exam', t.exam,
        'part', t.part,
        'title', t.title,
        'active', t.active,
        'is_core', t.is_core,
        'is_placeholder', t.is_placeholder,
        'cue_bullets', to_jsonb(t.cue_bullets),
        'cue_explain', t.cue_explain,
        'images', t.images,
        'points_for', to_jsonb(t.points_for),
        'points_against', to_jsonb(t.points_against),
        'related', case when r.id is null then null
                   else jsonb_build_object('part', r.part, 'title', r.title) end,
        'questions', coalesce((
          select jsonb_agg(jsonb_build_object('text', q.text, 'active', q.active, 'audio_url', q.audio_url)
                           order by q.sort_order, q.created_at)
          from public.questions q where q.topic_id = t.id), '[]'::jsonb)
      ) order by t.exam, t.part, t.title)
      from public.topics t
      left join public.topics r on r.id = t.related_topic_id
      where p_exam is null or t.exam = p_exam
    ), '[]'::jsonb),
    'mock_sets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'exam', m.exam,
        'name', m.name,
        'active', m.active,
        'sort_order', m.sort_order,
        'topics', coalesce((
          select jsonb_agg(jsonb_build_object('part', mt.part, 'title', t.title) order by mt.part, mt.sort_order)
          from public.mock_set_topics mt join public.topics t on t.id = mt.topic_id
          where mt.mock_set_id = m.id), '[]'::jsonb)
      ) order by m.exam, m.sort_order, m.name)
      from public.mock_sets m
      where p_exam is null or m.exam = p_exam
    ), '[]'::jsonb)
  );
$$;

create or replace function public.import_content(p_payload jsonb, p_dry_run boolean default true)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
  v_topics_created int := 0;
  v_topics_updated int := 0;
  v_questions_created int := 0;
  v_questions_updated int := 0;
  v_mocks_created int := 0;
  v_mocks_updated int := 0;
  v_problems text[] := '{}';
  t jsonb;
  q jsonb;
  m jsonb;
  mt jsonb;
  v_exam public.exam_code;
  v_topic_id uuid;
  v_related_id uuid;
  v_mock_id uuid;
  v_text text;
  v_exists boolean;
  v_next int;
  v_i int;
begin
  if not private.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if coalesce(p_payload->>'format', '') <> 'speaking-easy-content/v2' then
    raise exception 'unsupported format: expected speaking-easy-content/v2' using errcode = '22023';
  end if;

  begin
    -- 1. Topics and their questions
    for t in select * from jsonb_array_elements(coalesce(p_payload->'topics', '[]'::jsonb)) loop
      if coalesce(btrim(t->>'title'), '') = '' or (t->>'part') is null or (t->>'exam') not in ('ielts', 'cefr') then
        v_problems := v_problems || format('Skipped a topic without exam, part or title: %s', left(t::text, 80));
        continue;
      end if;
      v_exam := (t->>'exam')::public.exam_code;

      select id into v_topic_id from public.topics
      where exam = v_exam and part = (t->>'part')::smallint and lower(btrim(title)) = lower(btrim(t->>'title'));

      if v_topic_id is null then
        insert into public.topics (exam, part, title, active, is_core, is_placeholder, cue_bullets, cue_explain,
                                   images, points_for, points_against)
        values (
          v_exam, (t->>'part')::smallint, btrim(t->>'title'),
          coalesce((t->>'active')::boolean, true),
          coalesce((t->>'is_core')::boolean, false),
          coalesce((t->>'is_placeholder')::boolean, false),
          coalesce(array(select jsonb_array_elements_text(t->'cue_bullets')), '{}'),
          nullif(btrim(t->>'cue_explain'), ''),
          case when jsonb_typeof(t->'images') = 'array' then t->'images' else '[]'::jsonb end,
          coalesce(array(select jsonb_array_elements_text(t->'points_for')), '{}'),
          coalesce(array(select jsonb_array_elements_text(t->'points_against')), '{}')
        )
        returning id into v_topic_id;
        v_topics_created := v_topics_created + 1;
      else
        update public.topics set
          active = coalesce((t->>'active')::boolean, active),
          is_core = coalesce((t->>'is_core')::boolean, is_core),
          is_placeholder = coalesce((t->>'is_placeholder')::boolean, is_placeholder),
          cue_bullets = case when t ? 'cue_bullets' then coalesce(array(select jsonb_array_elements_text(t->'cue_bullets')), '{}') else cue_bullets end,
          cue_explain = case when t ? 'cue_explain' then nullif(btrim(t->>'cue_explain'), '') else cue_explain end,
          images = case when jsonb_typeof(t->'images') = 'array' then t->'images' else images end,
          points_for = case when t ? 'points_for' then coalesce(array(select jsonb_array_elements_text(t->'points_for')), '{}') else points_for end,
          points_against = case when t ? 'points_against' then coalesce(array(select jsonb_array_elements_text(t->'points_against')), '{}') else points_against end
        where id = v_topic_id;
        v_topics_updated := v_topics_updated + 1;
      end if;

      for q in select * from jsonb_array_elements(coalesce(t->'questions', '[]'::jsonb)) loop
        v_text := btrim(case when jsonb_typeof(q) = 'string' then q #>> '{}' else q->>'text' end);
        if coalesce(v_text, '') = '' then continue; end if;

        select true into v_exists from public.questions
        where topic_id = v_topic_id and lower(btrim(text)) = lower(v_text);

        if v_exists then
          if jsonb_typeof(q) = 'object' and (q ? 'active' or q ? 'audio_url') then
            update public.questions set
              active = coalesce((q->>'active')::boolean, active),
              audio_url = case when q ? 'audio_url' then nullif(q->>'audio_url', '') else audio_url end
            where topic_id = v_topic_id and lower(btrim(text)) = lower(v_text);
            v_questions_updated := v_questions_updated + 1;
          end if;
        else
          select coalesce(max(sort_order), 0) + 1 into v_next from public.questions where topic_id = v_topic_id;
          insert into public.questions (topic_id, text, sort_order, active, audio_url)
          values (
            v_topic_id, v_text, v_next,
            coalesce(case when jsonb_typeof(q) = 'object' then (q->>'active')::boolean end, true),
            case when jsonb_typeof(q) = 'object' then nullif(q->>'audio_url', '') end
          );
          v_questions_created := v_questions_created + 1;
        end if;
        v_exists := null;
      end loop;
      v_topic_id := null;
    end loop;

    -- 2. Links between topics (after all topics exist)
    for t in select * from jsonb_array_elements(coalesce(p_payload->'topics', '[]'::jsonb)) loop
      if coalesce(jsonb_typeof(t->'related'), '') <> 'object' or (t->>'exam') not in ('ielts', 'cefr') then continue; end if;
      v_exam := (t->>'exam')::public.exam_code;
      select id into v_related_id from public.topics
      where exam = v_exam and part = (t->'related'->>'part')::smallint
        and lower(btrim(title)) = lower(btrim(t->'related'->>'title'));
      if v_related_id is null then
        v_problems := v_problems || format('Linked topic not found for "%s": %s', t->>'title', t->'related'->>'title');
      else
        update public.topics set related_topic_id = v_related_id
        where exam = v_exam and part = (t->>'part')::smallint and lower(btrim(title)) = lower(btrim(t->>'title'));
      end if;
      v_related_id := null;
    end loop;

    -- 3. Mock sets
    for m in select * from jsonb_array_elements(coalesce(p_payload->'mock_sets', '[]'::jsonb)) loop
      if coalesce(btrim(m->>'name'), '') = '' or (m->>'exam') not in ('ielts', 'cefr') then
        v_problems := v_problems || format('Skipped a mock set without exam or name: %s', left(m::text, 80));
        continue;
      end if;
      v_exam := (m->>'exam')::public.exam_code;

      select id into v_mock_id from public.mock_sets where exam = v_exam and lower(btrim(name)) = lower(btrim(m->>'name'));
      if v_mock_id is null then
        insert into public.mock_sets (exam, name, active, sort_order)
        values (v_exam, btrim(m->>'name'), coalesce((m->>'active')::boolean, true), coalesce((m->>'sort_order')::int, 0))
        returning id into v_mock_id;
        v_mocks_created := v_mocks_created + 1;
      else
        update public.mock_sets set
          active = coalesce((m->>'active')::boolean, active),
          sort_order = coalesce((m->>'sort_order')::int, sort_order)
        where id = v_mock_id;
        v_mocks_updated := v_mocks_updated + 1;
      end if;

      if m ? 'topics' then
        delete from public.mock_set_topics where mock_set_id = v_mock_id;
        v_i := 0;
        for mt in select * from jsonb_array_elements(coalesce(m->'topics', '[]'::jsonb)) loop
          v_i := v_i + 1;
          select id into v_topic_id from public.topics
          where exam = v_exam and part = (mt->>'part')::smallint and lower(btrim(title)) = lower(btrim(mt->>'title'));
          if v_topic_id is null then
            v_problems := v_problems || format('Mock set "%s": topic not found (Part %s): %s', m->>'name', mt->>'part', mt->>'title');
          else
            insert into public.mock_set_topics (mock_set_id, topic_id, part, sort_order)
            values (v_mock_id, v_topic_id, (mt->>'part')::smallint, v_i)
            on conflict (mock_set_id, topic_id) do nothing;
          end if;
          v_topic_id := null;
        end loop;
      end if;
      v_mock_id := null;
    end loop;

    v_result := jsonb_build_object(
      'dry_run', p_dry_run,
      'topics_created', v_topics_created,
      'topics_updated', v_topics_updated,
      'questions_created', v_questions_created,
      'questions_updated', v_questions_updated,
      'mock_sets_created', v_mocks_created,
      'mock_sets_updated', v_mocks_updated,
      'problems', to_jsonb(v_problems)
    );

    if p_dry_run then
      -- Undo everything above; v_result keeps its value.
      raise exception using errcode = 'P0001', message = 'speaking-easy-dry-run';
    end if;
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'speaking-easy-dry-run' then raise; end if;
  end;

  return v_result;
end;
$$;

revoke all on function public.export_content(public.exam_code) from public, anon;
revoke all on function public.import_content(jsonb, boolean) from public, anon;
grant execute on function public.export_content(public.exam_code) to authenticated;
grant execute on function public.import_content(jsonb, boolean) to authenticated;
