-- ============================================================================
-- DELETING A CENTRE IS ONE DECISION, NOT SEVENTEEN — Second Skool
--
-- The operator console erases a centre by looping over seventeen tables, one
-- HTTP round trip each, then detaching the members, then deleting the centre
-- row. Every one of those is its own transaction. If the tenth fails — a
-- dropped connection, a statement timeout on a big table, the process being
-- recycled mid-loop — nine tables are already gone and there is no way back.
--
-- The route handles that about as well as it can: it collects the failures,
-- refuses to touch the centre row or the profiles, and returns "the centre was
-- left in place", so the operator can retry and the head keeps their way in.
-- That is a good failure state, and it is still a half-deleted centre. The
-- data that went is gone, and the operator is looking at a customer's records
-- with an arbitrary subset missing.
--
-- Postgres already offers exactly the guarantee wanted here: a plpgsql
-- function body is one transaction. Either the centre and all of its history
-- go, or nothing moves. This is that function.
--
-- Run this in Supabase -> SQL Editor. Safe to re-run.
--
-- -- Why the table list is a parameter -----------------------------------------
-- app/lib/centre-tables.ts holds the ordered list, and
-- tests/centre-delete-coverage.test.ts checks it against the migrations on every
-- run — that test exists because the list drifted once already (`batches`
-- arrived in 0006 and was never added, and the delete failed on the parent row
-- for months). Copying the list into SQL would create a second copy for the
-- same drift to happen to, with nothing watching this one. So the caller passes
-- it, and there stays exactly one source of truth.
--
-- The function does not trust what it is handed. It is service-role only, and
-- the service role can already delete anything it likes, so this is not a
-- privilege boundary — it is a typo boundary. A name that is not a real table,
-- or is not centre-scoped, or is one of the three tables a centre delete must
-- never touch, aborts the whole thing before a single row moves.
-- ============================================================================

create or replace function public.delete_centre(p_centre_id uuid, p_tables text[])
returns json language plpgsql security invoker set search_path = public as $$
declare
  v_name text;
  t text;
  -- profiles: members are detached, never deleted — erasing a centre must not
  -- erase the people who were in it, and it is what gives the head a way back.
  -- centres: the parent row, removed last by this function itself.
  -- support_tickets: a bug report has to outlive the centre it came from.
  v_exempt constant text[] := array['profiles', 'centres', 'support_tickets'];
begin
  -- Lock the centre first. A concurrent second delete (two operator tabs, a
  -- double-tap on a slow connection) waits here and then finds it already gone.
  select name into v_name from public.centres where id = p_centre_id for update;
  if v_name is null then
    return json_build_object('deleted', false, 'reason', 'not found');
  end if;

  foreach t in array coalesce(p_tables, array[]::text[])
  loop
    if t = any (v_exempt) then
      raise exception 'delete_centre: % must never be cleared by a centre delete', t;
    end if;
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'centre_id'
    ) then
      raise exception 'delete_centre: public.% is not a centre-scoped table', t;
    end if;

    execute format('delete from public.%I where centre_id = $1', t) using p_centre_id;
  end loop;

  -- The members go back to the unregistered state a fresh sign-in lands in.
  update public.profiles
     set centre_id = null, branch_id = null, role = 'student', staff_status = 'none'
   where centre_id = p_centre_id;

  delete from public.centres where id = p_centre_id;

  return json_build_object('deleted', true, 'name', v_name);
end; $$;

-- The operator console reaches this with the service role and nothing else
-- should reach it at all: it is an unrecoverable delete of a whole tenant.
revoke all on function public.delete_centre(uuid, text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0033_atomic_centre_delete')
  on conflict (version) do nothing;
