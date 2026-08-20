-- ============================================================================
-- WEB PUSH — subscription storage
-- One row per device/browser push subscription. Written via a SECURITY DEFINER
-- RPC (so anon students can subscribe too); read only by the /api/push sender
-- using the service-role key. No public read/write on the table itself.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  kind text not null check (kind in ('profile','student')),  -- staff (profile id) vs student (code)
  ref text not null,
  centre_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
-- No policies => neither anon nor authenticated can read/write directly.

-- Upsert the caller's subscription (idempotent by endpoint).
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_kind text, p_ref text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('profile','student') then raise exception 'bad kind'; end if;
  if length(coalesce(p_endpoint,'')) < 10 then raise exception 'bad endpoint'; end if;
  insert into public.push_subscriptions (endpoint, p256dh, auth, kind, ref)
  values (p_endpoint, p_p256dh, p_auth, p_kind, p_ref)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth,
        kind = excluded.kind, ref = excluded.ref, updated_at = now();
end; $$;

revoke all on function public.save_push_subscription(text,text,text,text,text) from public;
grant execute on function public.save_push_subscription(text,text,text,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0002_push_notifications')
  on conflict (version) do nothing;
