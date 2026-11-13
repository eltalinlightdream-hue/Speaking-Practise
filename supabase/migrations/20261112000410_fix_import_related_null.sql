-- Fix: topics without a "related" field were reported as "linked topic not found".
-- (Migration 0400 already contains the corrected line; this patches databases
-- that applied the earlier version. Running it again changes nothing.)
do $$
declare
  src text;
begin
  select pg_get_functiondef('public.import_content(jsonb,boolean)'::regprocedure) into src;
  src := replace(
    src,
    $f$if jsonb_typeof(t->'related') <> 'object'$f$,
    $f$if coalesce(jsonb_typeof(t->'related'), '') <> 'object'$f$
  );
  execute src;
end
$$;
