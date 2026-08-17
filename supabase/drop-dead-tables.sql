-- ============================================================================
-- DROP DEAD TABLES — Second Skool
--
-- assignment_submissions and subscriptions have been in the schema since the
-- original schema.sql and were never wired up:
--
--   * zero references anywhere in app/ — no query, no RPC, no API route
--   * zero rows in production
--   * RLS enabled but NO policies at all, so even if the app tried to read
--     them, every anon/authenticated request would be denied
--   * nothing references them — the only foreign keys point outward, at
--     assignments / students / branches, so dropping them breaks no other table
--
-- subscriptions was a first guess at billing that predates the Razorpay
-- decision; when billing is built it will need a centre-scoped table with a
-- gateway subscription id, not a per-branch price row. assignment_submissions
-- was a placeholder for homework hand-in, which the app does not do — students
-- see assignments, they don't submit through it.
--
-- Keeping them costs a little (they inflate every schema dump and they showed
-- up as two "RLS enabled, no policy" findings in the Supabase linter, which is
-- noise that hides real findings) and it misleads: the next person reading the
-- schema reasonably assumes the app has homework submission and billing.
--
-- Both are empty, so nothing is lost. Reversible by re-running the CREATE TABLE
-- statements from git history if either idea comes back.
--
-- Run this in Supabase → SQL Editor. Safe to re-run.
-- ============================================================================

drop table if exists public.assignment_submissions;
drop table if exists public.subscriptions;

-- The indexes performance-indexes.sql created on these two go with the tables;
-- Postgres drops them as part of the DROP TABLE. Nothing else to clean up.
