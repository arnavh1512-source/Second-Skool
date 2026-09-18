-- ============================================================================
-- A CRASH ON A PHONE REACHES THE OPERATOR — Second Skool
--
-- Every client error was written to the browser console and nowhere else. A
-- teacher whose attendance screen crashed saw the error card; the operator saw
-- nothing unless that teacher filed a support ticket, and most never do. The
-- first sign of a broken release was a centre going quiet.
--
-- The app now posts each client error to /api/log, which stores it here. The
-- operator console reads the last seven days.
--
-- What a row can hold is decided by the logger, not the caller: an event name
-- and a handful of scalar fields (the same PII-safe shape every log line
-- already has), the deploy it came from, and a trimmed user agent. No user id,
-- no centre id, no IP. A crash report says what broke, not who was using it.
--
-- Access: only the service role, through the API route. RLS is on with no
-- policies and the API roles hold no grants, so neither the anon key in the
-- browser nor a signed-in user can read or write this table directly.
--
-- Size: the route rate-limits per address and globally, and the trigger below
-- keeps only the newest 5000 rows, so a flood can cost the table at most a
-- few megabytes and never grows the database.
-- ============================================================================

create table if not exists public.client_errors (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event      text not null check (char_length(event) between 1 and 80),
  detail     jsonb not null default '{}'::jsonb check (pg_column_size(detail) <= 8192),
  version    text check (char_length(version) <= 40),
  user_agent text check (char_length(user_agent) <= 200)
);

create index if not exists client_errors_created_at_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;
revoke all on table public.client_errors from anon, authenticated;

-- Statement-level, so a batch insert trims once. The ids are an identity, so
-- "the newest 5000" is simply everything above max(id) - 5000.
create or replace function public.client_errors_trim()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.client_errors
  where id <= (select max(id) - 5000 from public.client_errors);
  return null;
end; $$;
revoke all on function public.client_errors_trim() from public;

drop trigger if exists client_errors_trim on public.client_errors;
create trigger client_errors_trim
  after insert on public.client_errors
  for each statement execute function public.client_errors_trim();

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0047_a_crash_on_a_phone_reaches_the_operator')
  on conflict (version) do nothing;
