-- ============================================================================
-- THE THROTTLE STOPS TRUSTING A HEADER THE CALLER WRITES — Second Skool
--
-- 0032 gave the code-guessing paths a per-caller throttle: 25 wrong codes a
-- minute from one IP and the door shuts. It reads the IP like this:
--
--   split_part(request.headers ->> 'x-forwarded-for', ',', 1)
--
-- The FIRST entry of x-forwarded-for. That is the right entry only if the edge
-- overwrites the header. Proxies generally do not — they APPEND the address
-- they see to whatever arrived, because the header is a trail, not a field.
-- Under that behaviour the first entry is not the client, it is whatever the
-- client typed:
--
--   curl -H 'x-forwarded-for: 1.2.3.4' ...   ->  header becomes "1.2.3.4, <real>"
--
-- so an attacker changes one string per request, lands in a fresh bucket every
-- time, and the 25-a-minute limit never triggers. The 600-a-minute global
-- backstop still holds, so this was never unlimited guessing — but the limit
-- doing the real work was forgeable, and nobody had checked which way the edge
-- behaves.
--
-- Rather than find out and depend on the answer, this stops depending on it.
-- client_ip() reads, in order:
--
--   cf-connecting-ip  — written by Cloudflare, which overwrites any value the
--                       client supplies. Supabase sits behind it.
--   x-real-ip         — written by the proxy layer, same property.
--   x-forwarded-for   — LAST entry, not first. The last hop to append is the
--                       one nearest us and the one we can believe; the entries
--                       before it are whatever was handed in.
--
-- Under an overwriting edge the last entry is also the only entry, so this is
-- correct there too. Under a chain of trusted proxies the last entry is the
-- innermost proxy and every caller shares one bucket, which throttles too hard
-- rather than not at all — the safe side, and the first two headers normally
-- answer before it comes to that.
--
-- The value is also capped at 45 characters, the longest an IPv6 address can
-- be. It is stored in a table, and an unbounded string out of a request header
-- is a row somebody else gets to choose the size of.
--
-- Run this in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- One definition of "who is calling", for anything that ever needs to rate
-- limit. Not SECURITY DEFINER: it reads request headers and nothing else.
-- ---------------------------------------------------------------------------
create or replace function public.client_ip()
returns text language plpgsql stable set search_path = public as $$
declare v_h json; v_ip text;
begin
  -- Outside a PostgREST request there are no headers at all — a direct SQL
  -- caller, a cron job, this migration. They share one 'unknown' bucket, which
  -- in production is nobody.
  begin
    v_h := current_setting('request.headers', true)::json;
  exception when others then
    v_h := null;
  end;
  if v_h is null then return 'unknown'; end if;

  v_ip := coalesce(
    nullif(trim(v_h ->> 'cf-connecting-ip'), ''),
    nullif(trim(v_h ->> 'x-real-ip'), ''),
    -- The last comma-separated entry. split_part with a negative index counts
    -- from the right, which is exactly the hop we can believe.
    nullif(trim(split_part(coalesce(v_h ->> 'x-forwarded-for', ''), ',', -1)), ''));

  return left(coalesce(v_ip, 'unknown'), 45);
end; $$;

revoke all on function public.client_ip() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The throttle itself, reproduced from 0032 with the header parsing replaced
-- by the call above. Limits and backstop unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.code_attempt_guard()
returns void language plpgsql security definer set search_path = public as $$
declare v_ip text; v_mine int; v_all int;
begin
  v_ip := public.client_ip();

  select count(*) into v_mine from public.code_attempts
    where ip = v_ip and at > now() - interval '1 minute';
  if v_mine >= 25 then
    raise exception 'Too many attempts — please try again in a minute';
  end if;

  -- Backstop. A distributed guess still meets a ceiling, but it is set where
  -- only an attack reaches it: 600 wrong codes a minute across every centre on
  -- the platform is not a bad afternoon at a tuition centre.
  select count(*) into v_all from public.code_attempts
    where user_id is null and at > now() - interval '1 minute';
  if v_all >= 600 then
    raise exception 'Too many attempts — please try again in a minute';
  end if;

  insert into public.code_attempts (ip) values (v_ip);
  delete from public.code_attempts where at < now() - interval '5 minutes' and user_id is null;
end; $$;

revoke all on function public.code_attempt_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0038_the_throttle_stops_trusting_a_header_the_caller_writes')
  on conflict (version) do nothing;
