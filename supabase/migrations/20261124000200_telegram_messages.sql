-- Messages from the owner and teachers (admins) to students through the Telegram bot.
--
-- Every student who signed in with Telegram has already pressed Start in the
-- bot, so the bot may write to them. In a private chat the chat id is the
-- Telegram user id, which is saved on the account at sign-in:
--   auth.users.raw_user_meta_data ->> 'telegram_id'
--   (also inside the made-up email "telegram-<id>@users.invalid").
-- The owner's Telegram id is private.app_config 'owner_telegram_id'.
--
-- The server sends the messages (it has the bot token). The database decides
-- WHO may send and WHO receives:
--   admin_message_recipients(group_ids)  admins only; students with Telegram
--   admin_my_telegram_id()               admins only; for "send a test to me"
--   admin_log_message(...)               admins only; saves the history row
-- telegram_messages keeps a history that every admin can read.

create table if not exists public.telegram_messages (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid references public.profiles (id) on delete set null,
  sender_name text,
  audience text not null check (char_length(audience) between 1 and 200),
  body text not null check (char_length(body) between 1 and 4000),
  recipients integer not null default 0 check (recipients >= 0),
  delivered integer not null default 0 check (delivered >= 0),
  failed integer not null default 0 check (failed >= 0),
  created_at timestamptz not null default now()
);

create index if not exists telegram_messages_created_at_idx on public.telegram_messages (created_at desc);
create index if not exists telegram_messages_sent_by_idx on public.telegram_messages (sent_by);

alter table public.telegram_messages enable row level security;

drop policy if exists "telegram_messages admin read" on public.telegram_messages;
create policy "telegram_messages admin read" on public.telegram_messages
  for select to authenticated
  using ((select private.is_admin()));

revoke all on public.telegram_messages from anon;
revoke insert, update, delete on public.telegram_messages from authenticated;
grant select on public.telegram_messages to authenticated;

-- Telegram id of an account, or null.
create or replace function private.telegram_id_of(p_user_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_meta text;
  v_email text;
  v_role public.app_role;
  v_owner text;
begin
  select u.raw_user_meta_data ->> 'telegram_id', u.email into v_meta, v_email
  from auth.users u where u.id = p_user_id;
  if v_meta ~ '^[0-9]{1,20}$' then
    return v_meta::bigint;
  end if;
  if v_email ~ '^telegram-[0-9]{1,20}@users\.invalid$' then
    return substring(v_email from '^telegram-([0-9]+)@')::bigint;
  end if;
  select p.role into v_role from public.profiles p where p.id = p_user_id;
  if v_role = 'owner' then
    select btrim(c.value) into v_owner from private.app_config c where c.key = 'owner_telegram_id';
    if v_owner ~ '^[0-9]{1,20}$' then
      return v_owner::bigint;
    end if;
  end if;
  return null;
end;
$$;

-- Students (role student) in the given groups (null = every student) who can get a Telegram message.
create or replace function public.admin_message_recipients(p_group_ids uuid[] default null)
returns table (user_id uuid, telegram_id bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return query
  select r.id, r.tg
  from (
    select p.id, private.telegram_id_of(p.id) as tg
    from public.profiles p
    where p.role = 'student'
      and (p_group_ids is null or p.lesson_group_id = any (p_group_ids))
  ) r
  where r.tg is not null;
end;
$$;

-- The caller's own Telegram id (admins only), for "send a test to me".
create or replace function public.admin_my_telegram_id()
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return private.telegram_id_of((select auth.uid()));
end;
$$;

-- Save one sent message in the history (admins only; the sender is always the caller).
create or replace function public.admin_log_message(
  p_audience text,
  p_body text,
  p_recipients integer,
  p_delivered integer,
  p_failed integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  insert into public.telegram_messages (sent_by, sender_name, audience, body, recipients, delivered, failed)
  select (select auth.uid()), p.full_name, left(btrim(p_audience), 200), p_body,
    greatest(coalesce(p_recipients, 0), 0), greatest(coalesce(p_delivered, 0), 0), greatest(coalesce(p_failed, 0), 0)
  from public.profiles p where p.id = (select auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function private.telegram_id_of(uuid) from public, anon, authenticated;
revoke all on function public.admin_message_recipients(uuid[]) from public, anon;
revoke all on function public.admin_my_telegram_id() from public, anon;
revoke all on function public.admin_log_message(text, text, integer, integer, integer) from public, anon;
grant execute on function public.admin_message_recipients(uuid[]) to authenticated;
grant execute on function public.admin_my_telegram_id() to authenticated;
grant execute on function public.admin_log_message(text, text, integer, integer, integer) to authenticated;
