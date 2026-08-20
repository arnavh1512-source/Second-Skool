-- ============================================================================
-- MIGRATION LEDGER — Second Skool
--
-- Every other file in this directory ends by inserting its own version here,
-- so the database itself records which migrations have run. Run this file
-- once, before anything else, on any database (new or existing).
--
-- Locked down deliberately: no RLS policies are defined, so neither anon nor
-- authenticated can read or write this table through the REST API. Only the
-- SQL Editor (which runs as the table owner and bypasses RLS) touches it.
-- ============================================================================

create table if not exists public.schema_migrations (
  version     text primary key,
  applied_at  timestamptz not null default now()
);

alter table public.schema_migrations enable row level security;

comment on table public.schema_migrations is
  'One row per applied migration file in supabase/migrations. Written by the tail block of each migration.';

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0000_schema_migrations')
  on conflict (version) do nothing;
