-- ============================================================================
-- ATOMIC ATTENDANCE ARCHIVE — Second Skool
--
-- archive_old_attendance() was two statements: an INSERT that rolled daily
-- rows older than 90 days into attendance_monthly, then a DELETE that removed
-- them. Both run in one transaction, but under READ COMMITTED each statement
-- takes its own snapshot and evaluates current_date afresh, which leaves two
-- holes:
--
--  1. A row committed between the two statements (with an old date) is seen by
--     the DELETE but was never seen by the INSERT — deleted without being
--     counted. Today's app only writes today's date, so this needs an out-of-
--     band write to bite, but "the archive can't lose rows" should not depend
--     on what every future writer happens to do.
--  2. current_date is evaluated twice. If the two statements straddle
--     midnight, the DELETE's cutoff is one day later than the INSERT's, and
--     every row on that boundary day is deleted without ever being rolled up.
--     The cron fires at 03:05, so this is unlikely — and unlikely silent data
--     loss is the worst kind.
--
-- One data-modifying CTE closes both: a single statement has a single
-- snapshot and a single cutoff, and the rollup is computed from exactly the
-- rows the DELETE returned. Nothing can fall between, because there is no
-- between.
-- ============================================================================

create or replace function public.archive_old_attendance()
returns text language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  with moved as (
    delete from public.attendance
    where date < current_date - 90
    returning centre_id, student_id, date, status
  ),
  rolled as (
    insert into public.attendance_monthly (centre_id, student_id, month, present, total)
    select m.centre_id, m.student_id, date_trunc('month', m.date)::date,
           count(*) filter (where m.status = 'Present'), count(*)
    from moved m
    group by m.centre_id, m.student_id, date_trunc('month', m.date)
    on conflict (student_id, month) do update
      set present = public.attendance_monthly.present + excluded.present,
          total   = public.attendance_monthly.total   + excluded.total
    returning 1
  )
  select count(*)::int into v_rows from moved;
  return 'archived ' || v_rows || ' daily attendance rows';
end; $$;

-- create or replace preserves the ownership and the revoke-from-everyone ACL
-- set in 0001 — only the pg_cron job (as postgres) can call this. Re-assert it
-- anyway so this file stands alone if 0001's grants ever change shape.
revoke all on function public.archive_old_attendance() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0017_atomic_attendance_archive')
  on conflict (version) do nothing;
