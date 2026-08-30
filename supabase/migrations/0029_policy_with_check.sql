-- ============================================================================
-- 0029 — the policies that check the row you started from, not the one you left
--
-- 0027 fixed one insert policy that validated a single column and ignored the
-- four denormalised ones beside it. That is a shape, not an incident, so this
-- migration sweeps every policy in the tree for the same mistake. Three came
-- back, all of them UPDATE policies written with `using` and no `with check`.
--
-- A `using` clause decides which rows you may TOUCH. A `with check` clause
-- decides what those rows may LOOK LIKE afterwards. An UPDATE policy with only
-- the first half says: you may edit your own row, into anything at all.
--
-- Today nothing escapes through them, because 0001 revoked table-level UPDATE
-- on both tables and granted back a named list of columns — role, staff_status,
-- centre_id, owner_id and join_code are simply not writable from a client. So
-- this is a second lock on doors that are already bolted. It is worth adding
-- anyway for two reasons: a column grant is one `grant update` away from being
-- widened by a future migration that has forgotten why the list is short, and
-- the comment at 0010_staff_profile_details.sql:47 already tells the next
-- reader that `profiles_update_self` is what stops a self-approval. It wasn't.
-- Now it is, and the comment is true.
--
-- Also here: two policies and three columns that were never reachable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles — a row you may edit must still be your row when you are done.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- The head's power over a staff profile stops at the edge of their own centre.
-- Without the check, an UPDATE could move a colleague's row into somebody
-- else's centre — writing a row the same policy would then refuse to read back.
drop policy if exists profiles_update_head on public.profiles;
create policy profiles_update_head on public.profiles
  for update to authenticated
  using (public.is_head() and centre_id = public.current_centre())
  with check (public.is_head() and centre_id = public.current_centre());

-- ---------------------------------------------------------------------------
-- 2. centres — same shape, on the row that decides who owns the place.
-- ---------------------------------------------------------------------------
drop policy if exists centres_write on public.centres;
create policy centres_write on public.centres
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. profiles_insert_self — a policy guarding a privilege nobody holds.
--
-- 0001 line 501 revokes INSERT on profiles from authenticated and never grants
-- it back; 0010 re-grants UPDATE columns only. Profile rows are created by the
-- handle_new_user trigger, which runs as the definer and is not subject to RLS
-- at all. So this policy has never once been consulted. Dropping it also fails
-- the safer way round: if INSERT is ever granted by accident, there is now no
-- policy to permit the row.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_insert_self on public.profiles;

-- ---------------------------------------------------------------------------
-- 4. Attribution columns are the server's to write.
--
-- attendance.recorded_by, tests.recorded_by, assignments.recorded_by and
-- notes.created_by all default to auth.uid(), and no client code has ever sent
-- them — but a default is only a default. The staff policies on those tables
-- check the centre and nothing else, so any teacher could have filed a class's
-- attendance under a colleague's name, and weekly_teacher_activity would have
-- reported it as that colleague's work. The whole point of this app is that a
-- teacher does not get blamed for something they did not do; a signature the
-- signer does not control is not a signature.
--
-- A trigger rather than a column-level revoke, because Postgres does not let a
-- column REVOKE cut into a table-level grant — closing it that way would mean
-- revoking INSERT on four tables and granting back an explicit list of every
-- other column, which the next `add column` migration would silently break.
--
-- Two functions with the column names written out, rather than one clever one
-- that takes the column as a trigger argument: the generic version needs the
-- hstore extension to assign to a column it only knows by name, and a whole
-- extension is a lot to install so that two nearly identical four-line
-- functions can be one.
-- ---------------------------------------------------------------------------
create or replace function public.stamp_recorded_by()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  -- On insert: whatever the client sent, the author is whoever holds the
  -- session. On update: an edit never re-signs the row — it keeps the name it
  -- was filed under.
  new.recorded_by := case when tg_op = 'INSERT' then (select auth.uid()) else old.recorded_by end;
  return new;
end $$;

create or replace function public.stamp_created_by()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.created_by := case when tg_op = 'INSERT' then (select auth.uid()) else old.created_by end;
  return new;
end $$;

drop trigger if exists attendance_stamp_author on public.attendance;
create trigger attendance_stamp_author before insert or update on public.attendance
  for each row execute function public.stamp_recorded_by();

drop trigger if exists tests_stamp_author on public.tests;
create trigger tests_stamp_author before insert or update on public.tests
  for each row execute function public.stamp_recorded_by();

drop trigger if exists assignments_stamp_author on public.assignments;
create trigger assignments_stamp_author before insert or update on public.assignments
  for each row execute function public.stamp_recorded_by();

drop trigger if exists notes_stamp_author on public.notes;
create trigger notes_stamp_author before insert or update on public.notes
  for each row execute function public.stamp_created_by();

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0029_policy_with_check')
  on conflict (version) do nothing;
</content>
</invoke>
