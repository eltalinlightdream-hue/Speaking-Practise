-- Telegram-first login.
--
-- 1. The owner can sign in with Telegram AND with email into the SAME account.
--    Their Telegram user id is stored outside git, like the owner email:
--      insert into private.app_config (key, value) values ('owner_telegram_id', '123456789')
--      on conflict (key) do update set value = excluded.value;
-- 2. The server needs to know who is signing in (to skip the channel check for
--    admins and the owner, and to send the owner to their email account).
--
-- Both functions are for the server only (service role key). Nobody else may run them.

-- Which account a Telegram user signs in to, and that account's role
-- (role is null when the account does not exist yet).
create or replace function public.telegram_login_info(p_telegram_id bigint)
returns table (login_email text, role public.app_role)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner_tg text;
  v_owner_email text;
  v_email text;
begin
  select c.value into v_owner_tg from private.app_config c where c.key = 'owner_telegram_id';
  select c.value into v_owner_email from private.app_config c where c.key = 'owner_email';

  if v_owner_tg is not null and v_owner_email is not null and trim(v_owner_tg) = p_telegram_id::text then
    v_email := lower(v_owner_email);
  else
    v_email := 'telegram-' || p_telegram_id::text || '@users.invalid';
  end if;

  return query
    select v_email, p.role
    from (select 1) one
    left join auth.users u on lower(u.email) = v_email
    left join public.profiles p on p.id = u.id;
end;
$$;

-- True only for the configured owner email (used by the owner-only email login).
create or replace function public.is_owner_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.app_config c
    where c.key = 'owner_email' and lower(trim(c.value)) = lower(trim(p_email))
  );
$$;

revoke all on function public.telegram_login_info(bigint) from public, anon, authenticated;
revoke all on function public.is_owner_email(text) from public, anon, authenticated;
grant execute on function public.telegram_login_info(bigint) to service_role;
grant execute on function public.is_owner_email(text) to service_role;
