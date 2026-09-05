-- ============================================================================
-- DEMO CENTRE — teardown
-- ----------------------------------------------------------------------------
-- Removes everything demo_centre.sql created, and nothing else. Run it when
-- the demo centre would get in the way of a real one — the account can only
-- own one centre at a time, so this is what you run before onboarding your
-- first paying tuition centre under the same login.
--
-- Deletes in the same order the operator console uses: the rows that hang off
-- students first, then the people, then the centre. Accounts are never
-- deleted, only detached from the centre that is going away.
-- ============================================================================

do $teardown$
declare
  c_centre constant text := 'Shree Vidya Classes (Demo)';
  v_centre uuid;
begin
  select id into v_centre from public.centres where name = c_centre;
  if v_centre is null then
    raise notice 'No demo centre to remove.';
    return;
  end if;

  delete from public.attendance         where centre_id = v_centre;
  delete from public.attendance_monthly where centre_id = v_centre;
  delete from public.results            where centre_id = v_centre;
  delete from public.assignments        where centre_id = v_centre;
  delete from public.fees               where centre_id = v_centre;
  delete from public.notifications      where centre_id = v_centre;
  delete from public.reminders          where centre_id = v_centre;
  delete from public.meetings           where centre_id = v_centre;
  delete from public.timetable          where centre_id = v_centre;
  delete from public.notes              where centre_id = v_centre;
  delete from public.push_subscriptions where centre_id = v_centre;
  delete from public.batches            where centre_id = v_centre;

  update public.profiles set centre_id = null, branch_id = null where centre_id = v_centre;

  delete from public.tests    where centre_id = v_centre;
  delete from public.students where centre_id = v_centre;  -- cascades student_devices
  delete from public.teachers where centre_id = v_centre;
  delete from public.subjects where centre_id = v_centre;
  delete from public.branches where centre_id = v_centre;
  delete from public.centres  where id = v_centre;

  raise notice 'Demo centre removed.';
end
$teardown$;
