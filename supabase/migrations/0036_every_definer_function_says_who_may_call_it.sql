-- ============================================================================
-- EVERY SECURITY DEFINER FUNCTION SAYS WHO MAY CALL IT — Second Skool
--
-- A SECURITY DEFINER function runs as its owner with RLS switched off, so the
-- only thing standing between it and every centre's data is the check written
-- at the top of its body. Most of them also carry an explicit REVOKE/GRANT pair
-- so the guard is not the only line of defence — but four never got one, and a
-- function with no grant of its own is executable by PUBLIC, which is every
-- role the project has now and every role it gains later.
--
-- None of these four is exploitable today: each one checks something before it
-- acts. This is defence in depth, not an incident. The point is that "who may
-- call this" should be readable from the grant rather than reconstructed by
-- reading plpgsql, and that a future role added to this project should not
-- silently inherit execute on a function nobody meant to give it.
--
-- Two different intents here, and they are opposite on purpose:
--
--   join_centre    — a staff path. It reads auth.uid(), so it is meaningless
--                    without a session and anon has no business holding it.
--
--   the ticket three — deliberately anon. Students have no auth session at all;
--                    they are identified by a student_code passed in, which
--                    support_student() resolves and throttles. Granting these
--                    to anon is not an oversight being fixed, it is the design
--                    being written down.
--
-- Run this in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Staff only: there is a session behind this call or there is nothing.
-- ---------------------------------------------------------------------------
revoke all on function public.join_centre(text) from public, anon;
grant execute on function public.join_centre(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Student support, which anon reaches on purpose. Revoking from PUBLIC and
-- granting to the two roles by name changes nothing about who can call these
-- today; it stops a role added tomorrow from inheriting them.
-- ---------------------------------------------------------------------------
revoke all on function
  public.file_ticket(text, text, text, text, text, text, jsonb),
  public.my_tickets(text),
  public.reply_ticket(text, uuid, text)
  from public;
grant execute on function
  public.file_ticket(text, text, text, text, text, text, jsonb),
  public.my_tickets(text),
  public.reply_ticket(text, uuid, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0036_every_definer_function_says_who_may_call_it')
  on conflict (version) do nothing;
