-- ============================================================================
-- PERFORMANCE INDEXES — Second Skool
--
-- Every table in this schema is shared by every centre and isolated by an RLS
-- policy of the form `centre_id = public.current_centre()`. Without an index on
-- centre_id, Postgres answers each of those policies with a sequential scan of
-- the whole table. The app fires thirteen such queries on every load, and
-- reloads on every tab focus, so the cost is paid constantly and by everybody
-- at once: one busy centre slows the app down for all the others.
--
-- The composites below lead with centre_id and continue with the column the
-- app actually orders by, so the RLS filter and the ORDER BY are both served
-- by one index and no sort is needed.
--
-- Safe to re-run. Safe to run on a live database.
--
-- ── HOW TO RUN ──────────────────────────────────────────────────────────────
-- Paste into Supabase → SQL Editor → Run.
--
-- A plain CREATE INDEX takes a write lock for the duration of the build. On
-- the table sizes this app has today that is milliseconds, so plain CREATE is
-- used here — it is the version that actually runs in the SQL editor, which
-- wraps a script in a transaction and would reject CREATE INDEX CONCURRENTLY.
--
-- If any table has grown past a few hundred thousand rows by the time you run
-- this, do it the other way instead: run ONE statement at a time, on its own,
-- with the word CONCURRENTLY added after CREATE INDEX. That builds without
-- blocking writes, but cannot be batched.
-- ============================================================================

-- ─── The hot path: the thirteen queries the app issues on every load ────────
-- Each of these mirrors an `.order(...)` in fetchAllData(), so the index
-- serves the tenant filter and the ordering together.

create index if not exists teachers_centre_created_idx
  on public.teachers (centre_id, created_at desc);

create index if not exists students_centre_created_idx
  on public.students (centre_id, created_at desc);

create index if not exists branches_centre_main_idx
  on public.branches (centre_id, is_main desc);

create index if not exists meetings_centre_date_idx
  on public.meetings (centre_id, date desc);

create index if not exists assignments_centre_due_idx
  on public.assignments (centre_id, due_date desc);

create index if not exists timetable_centre_start_idx
  on public.timetable (centre_id, start_time);

create index if not exists fees_centre_due_idx
  on public.fees (centre_id, due_date desc);

create index if not exists tests_centre_date_idx
  on public.tests (centre_id, date desc);

create index if not exists results_centre_created_idx
  on public.results (centre_id, created_at desc);

create index if not exists notifications_centre_created_idx
  on public.notifications (centre_id, created_at desc);

create index if not exists subjects_centre_idx
  on public.subjects (centre_id);

create index if not exists attendance_centre_date_idx
  on public.attendance (centre_id, date desc);

-- batches already has a unique index on (centre_id, name), which serves a
-- centre_id lookup from its leading column. Nothing to add.

-- ─── Tables the app reads outside fetchAllData ──────────────────────────────

create index if not exists reminders_centre_created_idx
  on public.reminders (centre_id, created_at desc);

create index if not exists notes_centre_created_idx
  on public.notes (centre_id, created_at desc);

-- This file used to index assignment_submissions (student_id) and
-- subscriptions (branch_id). Both tables were dead — never queried by the app,
-- no rows, no RLS policies — and 0014_drop_dead_tables.sql removed them, taking
-- those two indexes with them. Don't re-add either.

create index if not exists attendance_monthly_centre_idx
  on public.attendance_monthly (centre_id);

-- attendance_monthly already has unique(student_id, month); the per-student
-- lookup in student_attendance_totals() rides on that.

-- ─── profiles: read by current_centre(), is_staff(), is_head() and the push
--     route. current_centre() is called by every single RLS policy in the
--     schema, so this one is load-bearing for the entire application.

create index if not exists profiles_centre_role_status_idx
  on public.profiles (centre_id, role, staff_status);

-- ─── Foreign-key lookups used by joins, cascades and per-student screens ────
-- An un-indexed foreign key also makes every DELETE on the parent scan the
-- child table, which is why deleting a centre is slow.

create index if not exists students_branch_idx      on public.students (branch_id);
create index if not exists students_profile_idx     on public.students (profile_id);
create index if not exists teachers_branch_idx      on public.teachers (branch_id);
create index if not exists teachers_profile_idx     on public.teachers (profile_id);
create index if not exists attendance_student_date_idx on public.attendance (student_id, date desc);
create index if not exists results_student_idx      on public.results (student_id);
create index if not exists results_test_idx         on public.results (test_id);
create index if not exists tests_subject_idx        on public.tests (subject_id);
create index if not exists fees_student_idx         on public.fees (student_id);
create index if not exists notifications_student_idx on public.notifications (student_id);
create index if not exists assignments_subject_idx  on public.assignments (subject_id);

-- ─── Class-scoped lookups: get_student_snapshot() filters a student's
--     timetable and assignments by their class within their centre.

create index if not exists timetable_centre_class_idx
  on public.timetable (centre_id, class);

create index if not exists assignments_centre_class_idx
  on public.assignments (centre_id, class);

create index if not exists students_centre_class_idx
  on public.students (centre_id, class);

create index if not exists notes_centre_class_idx
  on public.notes (centre_id, class);

-- ─── Student sign-in by code. Unique per centre already? No — student_code is
--     looked up globally by get_student_snapshot(), so it needs its own index.

create index if not exists students_code_idx
  on public.students (student_code);

-- ─── Tell the planner about the new indexes immediately, rather than waiting
--     for autovacuum to get around to it.

analyze public.profiles;
analyze public.students;
analyze public.attendance;
analyze public.results;
analyze public.fees;
analyze public.tests;
analyze public.timetable;
analyze public.teachers;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0012_performance_indexes')
  on conflict (version) do nothing;
