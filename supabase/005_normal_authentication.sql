-- Run AFTER 001_schema.sql, for both fresh and existing databases.
-- Replaces the previous Supabase Auth integration without deleting account data.
begin;

-- Remove only this application's former Auth trigger, if it was installed.
do $$
begin
  if to_regclass('auth.users') is not null then
    execute 'drop trigger if exists streamsphere_user_registered on auth.users';
  end if;
end;
$$;
drop function if exists public.create_registered_member();

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null unique check (email = lower(btrim(email)) and char_length(email) <= 254),
  -- NULL marks an imported account awaiting an administrator-set local password.
  password_hash text check (password_hash ~ '^scrypt\$32768\$8\$3\$[0-9a-f]{32}\$[0-9a-f]{128}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.user_profiles (
  id uuid primary key,
  account_id uuid not null unique references public.demo_accounts(id),
  created_at timestamptz not null default now()
);

-- Preserve membership IDs and balances. Imported accounts cannot sign in until
-- a password is set using the trusted backend's user:password command.
insert into public.app_users(id, name, email)
select coalesce(p.id, a.id), left(case when char_length(btrim(a.name)) >= 2 then btrim(a.name) else 'Member' end, 100), lower(btrim(a.email))
from public.demo_accounts a left join public.user_profiles p on p.account_id = a.id
on conflict do nothing;

-- Detach former profile identities from auth.users, retaining all profile rows.
do $$
declare constraint_row record;
begin
  for constraint_row in
    select conname from pg_constraint
    where conrelid = 'public.user_profiles'::regclass and contype = 'f'
      and confrelid = to_regclass('auth.users')
  loop
    execute format('alter table public.user_profiles drop constraint %I', constraint_row.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'public.user_profiles'::regclass and conname = 'user_profiles_app_user_fkey') then
    alter table public.user_profiles add constraint user_profiles_app_user_fkey foreign key (id) references public.app_users(id) on delete cascade;
  end if;
end;
$$;

insert into public.user_profiles(id, account_id)
select u.id, a.id from public.app_users u join public.demo_accounts a on a.id = u.id
on conflict do nothing;

create table if not exists public.app_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index if not exists app_sessions_user_idx on public.app_sessions(user_id);
create index if not exists app_sessions_expiry_idx on public.app_sessions(expires_at);

alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.user_profiles enable row level security;
revoke all on public.app_users, public.app_sessions, public.user_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.app_users, public.app_sessions, public.user_profiles to service_role;

create or replace function public.start_app_session(p_user_id uuid, p_token_hash text, p_expires_at timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days 1 minute' then raise exception 'Invalid session expiry'; end if;
  perform 1 from public.app_users where id = p_user_id and password_hash is not null;
  if not found then raise exception 'Local password is not configured'; end if;
  delete from public.app_sessions where user_id = p_user_id and expires_at <= now();
  insert into public.app_sessions(token_hash, user_id, expires_at) values (p_token_hash, p_user_id, p_expires_at);
end;
$$;

create or replace function public.register_app_user(p_name text, p_email text, p_password_hash text, p_token_hash text, p_expires_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare member_id uuid := gen_random_uuid(); clean_email text := lower(btrim(p_email)); clean_name text := btrim(p_name);
begin
  if clean_name is null or char_length(clean_name) not between 2 and 100 then raise exception 'Enter your name (2-100 characters)'; end if;
  if clean_email is null or char_length(clean_email) > 254 or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email'; end if;
  if p_password_hash is null or p_password_hash !~ '^scrypt\$32768\$8\$3\$[0-9a-f]{32}\$[0-9a-f]{128}$' then raise exception 'Invalid password hash'; end if;
  if exists (select 1 from public.app_users where email = clean_email) or exists (select 1 from public.demo_accounts where lower(email) = clean_email) then
    raise exception 'An account already uses this email. Please sign in; imported accounts need local password setup';
  end if;
  insert into public.app_users(id, name, email, password_hash) values (member_id, clean_name, clean_email, p_password_hash);
  -- Demo onboarding only: Paid Premium, zero wallet, simulated charge today.
  insert into public.demo_accounts(id, name, email, subscription_status, wallet_cents) values (member_id, clean_name, clean_email, 'active', 0);
  insert into public.user_profiles(id, account_id) values (member_id, member_id);
  perform public.start_app_session(member_id, p_token_hash, p_expires_at);
  return jsonb_build_object('id', member_id, 'name', clean_name, 'email', clean_email);
end;
$$;

create or replace function public.get_app_session(p_token_hash text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email)
  from public.app_sessions s join public.app_users u on u.id = s.user_id
  where s.token_hash = p_token_hash and s.expires_at > now() and u.password_hash is not null;
$$;

-- Only a trusted local operator can set/reset an existing member's password.
-- Changing it invalidates all of that member's sessions.
create or replace function public.set_app_user_password(p_email text, p_password_hash text)
returns void language plpgsql security invoker set search_path = '' as $$
declare member_id uuid;
begin
  if p_password_hash is null or p_password_hash !~ '^scrypt\$32768\$8\$3\$[0-9a-f]{32}\$[0-9a-f]{128}$' then raise exception 'Invalid password hash'; end if;
  select id into strict member_id from public.app_users where email = lower(btrim(p_email)) for update;
  update public.app_users set password_hash = p_password_hash where id = member_id;
  delete from public.app_sessions where user_id = member_id;
end;
$$;

revoke all on function public.register_app_user(text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.start_app_session(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_app_session(text) from public, anon, authenticated;
revoke all on function public.set_app_user_password(text, text) from public, anon, authenticated;
grant execute on function public.register_app_user(text, text, text, text, timestamptz) to service_role;
grant execute on function public.start_app_session(uuid, text, timestamptz) to service_role;
grant execute on function public.get_app_session(text) to service_role;
grant execute on function public.set_app_user_password(text, text) to service_role;
commit;
