-- ============================================================================
-- THE PARTS OF SUPABASE THE MIGRATIONS ASSUME ALREADY EXIST — Second Skool
--
-- Every policy in this schema is written against auth.uid() and the anon /
-- authenticated roles, and none of those are Postgres. They are supplied by
-- the platform before the first migration ever runs, which is why the
-- migrations never create them and why, on a bare postgres:17, 0001 fails on
-- its first line.
--
-- This file is that platform layer, reproduced closely enough that the real
-- migration files replay unmodified. It exists so the RLS test suite argues
-- with the actual policies rather than with a hand-written imitation of them,
-- and so `scripts/migrate.mjs` can prove the whole stack applies from zero.
--
-- It is a TEST FIXTURE. It never runs against Supabase, where all of this is
-- already present and considerably more complete. Anything here that drifts
-- from the real platform makes the tests wrong rather than the app wrong, so
-- keep it minimal: add a piece only when a migration actually reaches for it.
-- ============================================================================

-- ─── ROLES ───────────────────────────────────────────────────────────────────
-- nologin, because the tests reach them with `set role` rather than by
-- connecting. noinherit matches the platform: a member of authenticated does
-- not silently pick up its rights.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  -- The operator console's key. It bypasses RLS on the real platform, and the
  -- tests assert that the tenant boundary is RLS rather than politeness, so it
  -- has to bypass here too or those assertions would pass for the wrong reason.
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase grants the API roles full table access up front and leaves the
-- actual gate to RLS. The migrations are written on top of that assumption —
-- 0001 revokes INSERT on profiles and grants three columns back, which only
-- means anything if the table-level grant was there to cut into.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- ─── auth ────────────────────────────────────────────────────────────────────
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- Only three columns of the real auth.users are ever read by this schema:
-- profiles references id, and handle_new_user() reads email and
-- raw_user_meta_data. The rest of the platform's table is not our business.
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- PostgREST puts the verified JWT claims in a GUC and auth.uid() reads the
-- subject back out. The tests set the same GUC, so a test session is
-- indistinguishable from a signed-in browser as far as every policy is
-- concerned. `true` on current_setting means an unset GUC is null rather than
-- an error — that is the anon case, and several policies depend on it.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

-- ─── storage ─────────────────────────────────────────────────────────────────
-- 0001 seeds the notes bucket and 0021 scopes its policies by the first path
-- segment. Both statements have to resolve or the migration aborts.
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id         text primary key,
  name       text not null,
  public     boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

-- Supabase's own definition: every path segment except the filename.
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- ─── realtime ────────────────────────────────────────────────────────────────
-- 0001 adds public.profiles to this publication so the head's screen advances
-- when a teacher is approved. The publication itself is the platform's.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
