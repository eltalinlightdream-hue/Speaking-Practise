-- Step 2: JSON import and export of question content.
--
-- Both functions are SECURITY INVOKER: they run with the caller's rights, so
-- row level security still applies (only admins can write content).
--
-- Format "speaking-easy-content/v2":
-- {
--   "format": "speaking-easy-content/v2",
--   "topics": [
--     { "exam": "ielts", "part": 3, "title": "Noise",
--       "active": true, "is_core": false, "is_placeholder": false,
--       "cue_bullets": [], "cue_explain": null,
--       "related": { "part": 2, "title": "Describe ..." },
--       "questions": [ { "text": "...", "active": true, "audio_url": null } ] }
--   ],
--   "mock_sets": [
--     { "exam": "ielts", "name": "SPEAKING-1", "active": true, "sort_order": 1,
--       "topics": [ { "part": 1, "title": "Work and studies" }, ... ] }
--   ]
-- }
-- Topics are matched by (exam, part, title), questions by (topic, text),
-- mock sets by (exam, name). Import never deletes anything.

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
        insert into public.topics (exam, part, title, active, is_core, is_placeholder, cue_bullets, cue_explain)
        values (
          v_exam, (t->>'part')::smallint, btrim(t->>'title'),
          coalesce((t->>'active')::boolean, true),
          coalesce((t->>'is_core')::boolean, false),
          coalesce((t->>'is_placeholder')::boolean, false),
          coalesce(array(select jsonb_array_elements_text(t->'cue_bullets')), '{}'),
          nullif(btrim(t->>'cue_explain'), '')
        )
        returning id into v_topic_id;
        v_topics_created := v_topics_created + 1;
      else
        update public.topics set
          active = coalesce((t->>'active')::boolean, active),
          is_core = coalesce((t->>'is_core')::boolean, is_core),
          is_placeholder = coalesce((t->>'is_placeholder')::boolean, is_placeholder),
          cue_bullets = case when t ? 'cue_bullets' then coalesce(array(select jsonb_array_elements_text(t->'cue_bullets')), '{}') else cue_bullets end,
          cue_explain = case when t ? 'cue_explain' then nullif(btrim(t->>'cue_explain'), '') else cue_explain end
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
