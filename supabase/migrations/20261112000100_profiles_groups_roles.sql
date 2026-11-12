-- Step 1: lesson groups, profiles, roles and row level security.
--
-- Roles: student (default), admin, owner.
-- The owner's email is NOT stored in this file. It lives in private.app_config
-- (key 'owner_email') and is set once with SQL outside of git, so the
-- repository never contains personal data.

create extension if not exists citext;

-- Private schema: not exposed through the Supabase API.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists private.app_config (
  key text primary key,
  value text not null
);
revoke all on private.app_config from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Types and tables
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('student', 'admin', 'owner');
exception when duplicate_object then null; end $$;

create table if not exists public.lesson_groups (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique check (char_length(name) between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (full_name is null or char_length(btrim(full_name)) between 2 and 100),
  lesson_group_id uuid references public.lesson_groups (id) on delete set null,
  role public.app_role not null default 'student',
  language text not null default 'uz' check (language in ('uz', 'en')),
  kept boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_lesson_group_id_idx on public.profiles (lesson_group_id);
create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer, live in the private schema)
-- ---------------------------------------------------------------------------
create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() in ('admin', 'owner'), false);
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'owner', false);
$$;

revoke all on function private.current_app_role() from public, anon;
revoke all on function private.is_admin() from public, anon;
revoke all on function private.is_owner() from public, anon;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_owner() to authenticated;

-- Keep updated_at fresh.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Create a profile row for every new auth user. The configured owner email
-- gets the owner role automatically.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_email text;
begin
  select c.value into v_owner_email from private.app_config c where c.key = 'owner_email';

  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case
      when v_owner_email is not null and lower(new.email) = lower(v_owner_email) then 'owner'::public.app_role
      else 'student'::public.app_role
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.lesson_groups enable row level security;
alter table public.profiles enable row level security;

-- lesson_groups: any signed-in user can read; admins manage.
drop policy if exists "lesson_groups read" on public.lesson_groups;
create policy "lesson_groups read" on public.lesson_groups
  for select to authenticated
  using (active or (select private.is_admin()));

drop policy if exists "lesson_groups admin insert" on public.lesson_groups;
create policy "lesson_groups admin insert" on public.lesson_groups
  for insert to authenticated
  with check ((select private.is_admin()));

drop policy if exists "lesson_groups admin update" on public.lesson_groups;
create policy "lesson_groups admin update" on public.lesson_groups
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "lesson_groups admin delete" on public.lesson_groups;
create policy "lesson_groups admin delete" on public.lesson_groups
  for delete to authenticated
  using ((select private.is_admin()));

-- profiles: users read their own row, admins read all rows.
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

-- profiles: users update their own row only. Column privileges below limit
-- WHICH columns they can change (not role, kept or email).
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert or delete policies: rows are created by the trigger and removed
-- through the functions below.

revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, lesson_group_id, language) on public.profiles to authenticated;

revoke all on public.lesson_groups from anon;

-- ---------------------------------------------------------------------------
-- Admin and owner actions (enforced in the database, not only in the UI)
-- ---------------------------------------------------------------------------

-- Admins mark an account as kept (checked) or not.
create or replace function public.admin_set_kept(p_user_id uuid, p_kept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  update public.profiles set kept = p_kept where id = p_user_id;
end;
$$;

-- Only the owner can promote or demote admins. The owner role itself cannot
-- be given or taken away here.
create or replace function public.owner_set_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role public.app_role;
begin
  if not private.is_owner() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'the owner role cannot be assigned' using errcode = '42501';
  end if;
  select role into v_target_role from public.profiles where id = p_user_id;
  if v_target_role is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if v_target_role = 'owner' then
    raise exception 'the owner cannot be demoted' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

-- Admins delete student accounts. Only the owner can delete an admin.
-- Nobody can delete the owner this way.
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller public.app_role := private.current_app_role();
  v_target public.app_role;
begin
  if v_caller is null or v_caller not in ('admin', 'owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'use delete_my_account to delete your own account' using errcode = '42501';
  end if;
  select role into v_target from public.profiles where id = p_user_id;
  if v_target = 'owner' then
    raise exception 'the owner account cannot be deleted' using errcode = '42501';
  end if;
  if v_target = 'admin' and v_caller <> 'owner' then
    raise exception 'only the owner can delete an admin' using errcode = '42501';
  end if;
  delete from auth.users where id = p_user_id;
end;
$$;

-- Any user can delete their own account (except the owner, to avoid locking
-- everyone out of the admin area by accident).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if private.is_owner() then
    raise exception 'the owner account cannot be deleted from the app' using errcode = '42501';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke all on function public.admin_set_kept(uuid, boolean) from public, anon;
revoke all on function public.owner_set_role(uuid, public.app_role) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.admin_set_kept(uuid, boolean) to authenticated;
grant execute on function public.owner_set_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
