-- ============================================================================
-- ADOPT AN EXISTING DATABASE — Second Skool
--
-- Run this ONCE, and only on a database that was built with the old loose
-- .sql files (i.e. the current production project). It does not change a
-- single table, policy or function — it only writes the ledger rows saying
-- "these migrations already ran", so that from now on you can apply new
-- migrations in order and know exactly where you are.
--
-- HOW TO RUN
--   1. Supabase Dashboard -> SQL Editor.
--   2. Run supabase/migrations/0000_schema_migrations.sql first.
--   3. Run this file.
--   4. Verify with the SELECT at the bottom: you should see 0000 - 0014.
--
-- ON A FRESH PROJECT: do NOT run this file. Run 0000, then 0001 - 0014 in
-- order, and each one records itself.
-- ============================================================================

insert into public.schema_migrations (version) values
  ('0001_baseline'),
  ('0002_push_notifications'),
  ('0003_student_onboarding'),
  ('0004_student_join_code'),
  ('0005_lock_student_self_edit'),
  ('0006_batches'),
  ('0007_audit_hardening'),
  ('0008_audit_hardening_search_path'),
  ('0009_reminder_notice_type'),
  ('0010_staff_profile_details'),
  ('0011_push_subscription_ownership'),
  ('0012_performance_indexes'),
  ('0013_attendance_totals'),
  ('0014_drop_dead_tables')
on conflict (version) do nothing;

-- Expect 15 rows, 0000 through 0014.
select version, applied_at from public.schema_migrations order by version;
