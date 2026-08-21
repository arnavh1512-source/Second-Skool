-- ============================================================================
-- TIMETABLE: HEAD WRITES, STAFF READ — Second Skool
--
-- 0001_baseline.sql grants every approved staff member full control of the
-- timetable:
--
--   create policy timetable_staff on public.timetable for all to authenticated
--     using (is_staff() and centre_id = current_centre())
--     with check (is_staff() and centre_id = current_centre());
--
-- `for all` means any teacher can insert, edit or delete any period in the
-- centre — including other teachers' classes. The app only ever offers the
-- timetable editor from the head's screens, so this is a gap between what the
-- UI shows and what the database actually allows: a teacher with the API key
-- (which ships to every browser) can rewrite the whole schedule.
--
-- The timetable is the one shared object every teacher reads and only the head
-- should own. Attendance and results are per-teacher work and stay writable by
-- staff; the schedule is centre policy.
--
-- After this migration:
--   * every approved staff member can SELECT their own centre's timetable
--     (unchanged — teachers need to see when they teach)
--   * only a head can INSERT / UPDATE / DELETE
--   * centre scoping is unchanged on both — no cross-centre access either way
-- ============================================================================

drop policy if exists timetable_staff on public.timetable;

-- Read: any approved staff member, own centre only.
create policy timetable_staff_read on public.timetable
  for select to authenticated
  using (public.is_staff() and centre_id = public.current_centre());

-- Write: heads only, own centre only. Split into the three commands rather
-- than `for all` so a future read-policy change can never silently re-grant
-- writes the way the combined policy did.
create policy timetable_head_insert on public.timetable
  for insert to authenticated
  with check (public.is_head() and centre_id = public.current_centre());

create policy timetable_head_update on public.timetable
  for update to authenticated
  using (public.is_head() and centre_id = public.current_centre())
  with check (public.is_head() and centre_id = public.current_centre());

create policy timetable_head_delete on public.timetable
  for delete to authenticated
  using (public.is_head() and centre_id = public.current_centre());

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0015_timetable_head_only')
  on conflict (version) do nothing;
