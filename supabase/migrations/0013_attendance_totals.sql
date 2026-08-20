-- ============================================================================
-- ATTENDANCE TOTALS RPC — Second Skool
--
-- ── THE BUG THIS FIXES ──────────────────────────────────────────────────────
-- The app used to compute every student's attendance percentage in the
-- browser, from a single `select * from attendance limit 20000` ordered newest
-- first. That works until a centre has more than 20,000 attendance rows — and
-- at ~25 school days a month, that is 150 students after five months.
--
-- Past that point the oldest rows silently stop arriving and every percentage
-- in the app is computed from a partial denominator. No error, no warning: the
-- numbers just quietly become wrong, and they are shown to parents.
--
-- ── THE FIX ─────────────────────────────────────────────────────────────────
-- Aggregate in the database and return one row per student instead of one row
-- per attendance mark. A 2,000-student centre returns 2,000 small rows no
-- matter how many years of history sits behind them, so there is no cap to
-- outgrow and nothing to truncate.
--
-- The totals span both halves of the history:
--   * attendance_monthly — everything archive_old_attendance() has rolled up
--     and deleted (older than 90 days), kept forever as monthly counts;
--   * attendance — the recent daily rows that have not been archived yet.
-- The archive deletes what it rolls up, so the two never overlap and nothing
-- is double-counted.
--
-- Run this in Supabase → SQL Editor. Safe to re-run.
-- ============================================================================

create or replace function public.student_attendance_totals()
returns table (student_id uuid, present int, total int)
language sql
security definer
stable
set search_path = public
as $$
  select s.id,
         (coalesce(m.present, 0) + coalesce(d.present, 0))::int,
         (coalesce(m.total,   0) + coalesce(d.total,   0))::int
  from public.students s
  -- Archived history: monthly counts, one row per student per month.
  left join lateral (
    select sum(am.present) as present, sum(am.total) as total
    from public.attendance_monthly am
    where am.student_id = s.id
  ) m on true
  -- Live history: daily rows not yet archived.
  left join lateral (
    select count(*) filter (where a.status = 'Present') as present,
           count(*)                                     as total
    from public.attendance a
    where a.student_id = s.id
  ) d on true
  -- SECURITY DEFINER bypasses RLS, so the tenant filter must be explicit here.
  -- is_staff() is checked by the caller-facing grant below; this scopes the
  -- rows to the caller's own centre and nothing else.
  where s.centre_id = public.current_centre()
    and public.is_staff();
$$;

revoke all on function public.student_attendance_totals() from public, anon;
grant execute on function public.student_attendance_totals() to authenticated;

comment on function public.student_attendance_totals() is
  'Per-student lifetime attendance counts for the caller''s centre, combining '
  'archived monthly rollups with un-archived daily rows. Returns one row per '
  'student so the result never has to be capped.';

-- ============================================================================
-- SCHEDULE THE ARCHIVE JOB
--
-- archive_old_attendance() already exists but nothing calls it, so
-- attendance_monthly is empty and the daily table grows forever. The RPC above
-- is correct either way, but without the archive the daily table keeps
-- growing and every write to it gets slower.
--
-- Enable pg_cron once: Supabase Dashboard → Database → Extensions → pg_cron.
-- Then run the block below. It is separate because it fails if the extension
-- is not enabled yet, and that failure would otherwise roll back this whole
-- file.
-- ============================================================================

-- Runs 03:05 on the 2nd of each month, after the previous month has closed.
--
--   select cron.schedule(
--     'archive-attendance',
--     '5 3 2 * *',
--     $job$ select public.archive_old_attendance() $job$
--   );
--
-- Verify with:      select * from cron.job;
-- Run once by hand: select public.archive_old_attendance();
-- Unschedule with:  select cron.unschedule('archive-attendance');

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0013_attendance_totals')
  on conflict (version) do nothing;
