-- ============================================================================
-- CLEAN UP WHAT THE MIGRATIONS NEVER KNEW ABOUT — Second Skool
--
-- 0018 reconciled every foreign key between production and this folder and
-- found two disagreements. It never checked columns or indexes. This one does,
-- and there were nine more:
--
--   select table_name||'.'||column_name from information_schema.columns
--     where table_schema='public';          -- then grep each against this folder
--   select indexname from pg_indexes where schemaname='public';
--
-- One column and eight indexes exist in production and in no migration file.
-- They are invisible to anyone rebuilding from this folder — a staging project,
-- a new laptop, a restore during an outage — which means the environment you
-- test in is not the one holding the students.
--
-- Also fixes the four RLS policies the Supabase linter flags for re-evaluating
-- auth.uid() once per row.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles.admin_pin — a credential column nothing has ever authenticated
--    against, defaulting to '1234' on every row.
--
-- `grep -rn admin_pin app/` returns nothing. It is not read, not written, and
-- not referenced by any policy, function, index or view — checked against
-- production, not assumed. Both existing rows hold the literal default.
--
-- Dead is not the problem. The problem is what it becomes: `authenticated` can
-- SELECT it, and `profiles_read` lets a head read every staff row in their
-- centre — so a column that looks exactly like a PIN, holds '1234', and is
-- already visible to other people is sitting there waiting for someone to wire
-- an "admin PIN lock" screen to it in six months and ship 1234 for everybody.
--
-- Dropping it is also the only way to make it leave the backups, which is where
-- it currently gets copied nightly.
-- ---------------------------------------------------------------------------
alter table public.profiles drop column if exists admin_pin;

-- ---------------------------------------------------------------------------
-- 2. Eight indexes left over from the pre-migration hand-built schema.
--
-- Five are byte-identical duplicates of indexes 0012 already creates — two
-- copies of the same B-tree, both maintained on every write, one of them never
-- read:
--     idx_fees_student           = fees_student_idx
--     idx_notifications_student  = notifications_student_idx
--     idx_results_student        = results_student_idx
--     idx_results_test           = results_test_idx
--     idx_students_branch        = students_branch_idx
--
-- The other three are single-column indexes the centre-scoped composites in
-- 0012 already cover, on columns no query filters by alone:
--     idx_attendance_student_date (student_id, date)
--         vs attendance_student_date_idx (student_id, date desc) — same access
--         path, and DESC is the direction the app actually reads in.
--     idx_students_class (class)
--         every students query is centre-scoped first, so
--         students_centre_class_idx (centre_id, class) is strictly better and
--         this one can only be chosen for a query the app never issues.
--     idx_timetable_day (day)
--         seven distinct values. A sequential scan beats it at any table size
--         this app will reach.
--
-- Dropping all eight also ends the drift: afterwards production's index set is
-- exactly what 0012 defines.
-- ---------------------------------------------------------------------------
drop index if exists public.idx_fees_student;
drop index if exists public.idx_notifications_student;
drop index if exists public.idx_results_student;
drop index if exists public.idx_results_test;
drop index if exists public.idx_students_branch;
drop index if exists public.idx_attendance_student_date;
drop index if exists public.idx_students_class;
drop index if exists public.idx_timetable_day;

-- ---------------------------------------------------------------------------
-- 3. auth.uid() per row becomes auth.uid() once per statement.
--
-- Postgres re-evaluates a bare `auth.uid()` inside a policy for every candidate
-- row. Wrapping it in a scalar subquery makes it an InitPlan: evaluated once,
-- then compared as a constant. Identical semantics, and the saving grows
-- linearly with the table.
--
-- The policies are dropped and recreated rather than altered, because `alter
-- policy` cannot restate USING without also restating the rest on every build.
-- Each comes back with the same command, the same role and the same predicate
-- modulo the wrapper.
--
-- Note on the two UPDATE policies: neither declares WITH CHECK, and that is
-- deliberate — Postgres then applies USING to the new row as well, so a user
-- cannot update their own row into somebody else's id. Restated unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists centres_write on public.centres;
create policy centres_write on public.centres
  for update to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (public.is_head() and centre_id = public.current_centre())
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0020_drift_and_rls_initplan')
  on conflict (version) do nothing;
