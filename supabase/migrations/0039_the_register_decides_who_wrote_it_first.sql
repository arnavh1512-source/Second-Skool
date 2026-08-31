-- ============================================================================
-- THE REGISTER DECIDES WHO WROTE IT FIRST — Second Skool
--
-- Attendance is saved twice in this app and both paths did the same unsafe
-- thing: read the register, decide, then write. Two round trips, and anything
-- that lands between them is invisible to the decision.
--
--   const { data: existing } = await supabase.from('attendance').select(...)
--   ...decide...
--   await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date' })
--
-- On the live save the cost is a wrong sentence: two teachers marking the same
-- class in the same minute both read an empty register, both write, and both
-- are told "Attendance saved" when the second one silently replaced the first.
-- The warning that exists precisely to stop that never fires.
--
-- On the offline queue drain the cost is the register itself. The rule in
-- att-queue.ts is "a queued mark writes only where the register has no answer
-- yet" — her marks were made with no signal, so anyone else's mark is newer
-- than hers and must win. That rule was enforced in the browser, against a
-- list read a round trip earlier, and then written with an upsert, which
-- UPDATES on conflict. A row appearing in that gap is overwritten by a stale
-- offline mark, and if the stale mark says Absent, the parent gets a push
-- about a child who was in class. That is the one message a centre cannot take
-- back, and the file says so itself.
--
-- save_attendance() makes the read and the write the same statement. ON
-- CONFLICT DO UPDATE takes a row lock on every conflicting row, so a second
-- caller waits rather than racing, and RETURNING says what was actually there:
--
--   xmax = 0   this call inserted the row — nobody had answered for that child
--   otherwise  a row already existed, and its status comes back with it
--
-- p_overwrite is what separates the two callers. The live save passes true:
-- she is looking at the class right now, so the latest mark is the true one,
-- and the rows that already existed come back only so she can be told. The
-- queue drain passes false: the update sets the status to what it already was,
-- which changes nothing but still locks the row and still returns it, so the
-- stale mark is refused inside the transaction rather than in the browser, and
-- comes back as a conflict for her to look at.
--
-- SECURITY INVOKER: attendance_staff still decides, exactly as it did when the
-- client wrote the rows itself.
--
-- Run this in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================================

create or replace function public.save_attendance(
  p_date      date,
  p_marks     jsonb,
  p_overwrite boolean default false)
returns json language plpgsql security invoker set search_path = public as $$
declare v_existing json; v_written int;
begin
  if p_date is null or p_date > current_date then
    raise exception 'attendance can only be marked for a day that has already happened';
  end if;
  if jsonb_typeof(p_marks) is distinct from 'array' or jsonb_array_length(p_marks) = 0 then
    raise exception 'no marks to save';
  end if;
  -- A register is one class. Anything past this is not a teacher.
  if jsonb_array_length(p_marks) > 500 then
    raise exception 'too many marks in one save';
  end if;

  with given as (
    select (x ->> 'student_id')::uuid as student_id, x ->> 'status' as status, ord
      from jsonb_array_elements(p_marks) with ordinality as e(x, ord)
  ),
  -- The same child twice in one batch is a correction, not a conflict, and the
  -- later one is the correction. ON CONFLICT cannot touch a row twice in one
  -- statement, so this has to be settled before the insert rather than by it.
  marks as (
    select distinct on (student_id) student_id, status
      from given order by student_id, ord desc
  ),
  written as (
    insert into public.attendance (student_id, date, status)
    select student_id, p_date, status from marks
    on conflict (student_id, date) do update
      set status = case when p_overwrite then excluded.status else public.attendance.status end
    returning student_id, status, (xmax = 0) as inserted
  )
  select json_agg(json_build_object('student_id', student_id, 'status', status))
           filter (where not inserted),
         count(*) filter (where inserted or p_overwrite)
    into v_existing, v_written
    from written;

  return json_build_object(
    'written',  coalesce(v_written, 0),
    'existing', coalesce(v_existing, '[]'::json));
end; $$;

revoke all on function public.save_attendance(date, jsonb, boolean) from public, anon;
grant execute on function public.save_attendance(date, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0039_the_register_decides_who_wrote_it_first')
  on conflict (version) do nothing;
