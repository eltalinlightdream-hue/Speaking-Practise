-- Telegram sign-in through the bot.
--
-- 1. The login page asks the server for a request: a random `code` (goes into
--    the link t.me/<bot>?start=<code>) and a random secret kept in an httpOnly
--    cookie in that browser (only its hash is stored here).
-- 2. The student presses Start in the bot and then "Confirm". The bot webhook
--    writes the Telegram user's id and name onto the row.
-- 3. The login page keeps asking "confirmed yet?" with its cookie. Once the row
--    is confirmed the server deletes it and signs that browser in.
--
-- Only the server (service role key) touches this table: RLS is on and there
-- are no policies, and the browser roles have no privileges at all.

create table public.telegram_login_requests (
  code         text primary key check (code ~ '^[A-Za-z0-9_-]{20,64}$'),
  secret_hash  text not null unique,
  next_path    text not null default '/home',
  telegram_id  bigint,
  first_name   text,
  last_name    text,
  username     text,
  confirmed_at timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.telegram_login_requests is
  'Short-lived Telegram bot sign-in requests (10 minutes). Server only.';

create index telegram_login_requests_created_at_idx on public.telegram_login_requests (created_at);

alter table public.telegram_login_requests enable row level security;
revoke all on public.telegram_login_requests from anon, authenticated;
