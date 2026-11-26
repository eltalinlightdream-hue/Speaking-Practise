-- The "turn off reminders" button also finds the owner's account (the owner signs in
-- by email; their Telegram id is private.app_config 'owner_telegram_id').

create or replace function public.reminders_off_by_telegram(p_telegram_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.profiles p set reminders_enabled = false
  where p.id in (
    select u.id from auth.users u
    where u.raw_user_meta_data ->> 'telegram_id' = p_telegram_id::text
       or u.email = 'telegram-' || p_telegram_id::text || '@users.invalid'
  )
  or (
    p.role = 'owner'
    and exists (select 1 from private.app_config c where c.key = 'owner_telegram_id' and btrim(c.value) = p_telegram_id::text)
  );
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.reminders_off_by_telegram(bigint) from public, anon, authenticated;
grant execute on function public.reminders_off_by_telegram(bigint) to service_role;
