-- ============================================================================
-- THE REVOKE THAT DID NOT REVOKE — Second Skool
--
-- 0023 tried to keep support_student() internal and 0032 repeated the attempt:
--
--   revoke execute on function public.support_student(text) from anon, authenticated;
--
-- That line looks like it closes the door and does not. A function with no ACL
-- of its own is not "ungranted" in Postgres — it carries the default, which is
-- EXECUTE to PUBLIC. The first revoke against it materialises that default and
-- then removes the two roles named, leaving PUBLIC's grant sitting there
-- untouched. anon is a member of PUBLIC, so anon kept execute the whole time.
--
-- support_student() is SECURITY DEFINER and returns a whole students row —
-- name, parent contact, address, centre — for any code that resolves. It is
-- meant to be the door the three ticket functions walk through, not a door of
-- its own. code_attempt_guard() still throttles wrong guesses, so this was
-- never an enumeration hole, but a single correct code should not hand out the
-- full row outside the function that scopes it.
--
-- Revoking from PUBLIC is the part that was missing. The three ticket
-- functions are unaffected: they call it as the definer's owner, and owners do
-- not need a grant to call their own function.
--
-- Found by the test added alongside this file, which asserts no SECURITY
-- DEFINER function in public is executable by PUBLIC. That sweep is now
-- machine-enforced rather than repeated by hand.
--
-- Run this in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================================

revoke all on function public.support_student(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0037_the_revoke_that_did_not_revoke')
  on conflict (version) do nothing;
