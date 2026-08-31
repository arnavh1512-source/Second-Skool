-- ============================================================================
-- TWO PHONES AT ONCE WERE BOTH THE FIRST — Second Skool
--
-- 0040's whole security property is "the first phone on a code is allowed, the
-- second one waits". claim_student_device() decided which of the two a caller
-- was by reading the device rows and then inserting — with nothing held in
-- between:
--
--     select the student
--     count live devices          <- both callers read the same empty table
--     has it ever had a device?   <- both callers read "no"
--     insert approved = true      <- both callers insert an approved device
--
-- Two phones claiming the same code at the same moment therefore both saw an
-- empty table, both concluded they were the first, and both let themselves in.
-- That is exactly the case the design exists to stop — a code that travelled
-- and got typed on someone else's phone — and it is not a rare shape either:
-- the code is read out to a room, and a household with two parents opens the
-- app on two phones within the same few seconds.
--
-- The fix is the same one the fee writes already use: take the row lock on the
-- parent before deciding anything about its children. `for update` on the
-- students row serialises the competing claims, so the second caller waits and
-- then reads a table that has the first caller's device in it.
--
-- A unique constraint would have been the wrong tool. The invariant is not
-- "one approved device ever" — the head can and should allow a second phone —
-- it is "only one device may approve itself". That is a rule about a moment in
-- time, and a lock is how a moment in time is expressed.
--
-- Run this in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================================

create or replace function public.claim_student_device(p_code text, p_label text default null)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_student public.students; v_token text; v_live int; v_approved boolean;
begin
  if length(coalesce(p_code,'')) < 4 then raise exception 'Not found'; end if;

  -- The lock, and the only line that differs from 0040. Held until this
  -- function's transaction ends, which for a PostgREST call is the call itself.
  select * into v_student from public.students where student_code = p_code for update;
  if v_student.id is null then
    -- Same throttle as every other code-shaped guess. Claiming must not become
    -- the cheap oracle that the guarded functions stopped being.
    perform public.code_attempt_guard();
    raise exception 'Not found';
  end if;

  select count(*) into v_live from public.student_devices
   where student_id = v_student.id and revoked_at is null;

  -- A code that has leaked can still be spent, but not endlessly: ten pending
  -- rows is a head's list somebody has to read, not an unbounded table.
  if v_live >= 10 then raise exception 'Too many devices are already using this code'; end if;

  -- The first device on a code is the household's own phone in every real case,
  -- and making them wait for an approval that has never existed would be a new
  -- step in front of every parent for a threat the second device already covers.
  -- Ever, not now: a household that lost its phone claims a new one and the head
  -- allows it from the phones list, but a leaker who has just been removed
  -- cannot re-approve themselves by typing the code again.
  select not exists (select 1 from public.student_devices where student_id = v_student.id)
    into v_approved;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.student_devices (student_id, centre_id, token_hash, label, approved)
  values (v_student.id, v_student.centre_id,
          encode(digest(v_token, 'sha256'), 'hex'),
          nullif(left(trim(coalesce(p_label, '')), 60), ''),
          v_approved);

  -- The only time the plaintext exists anywhere but this phone's storage.
  return json_build_object('token', v_token, 'approved', v_approved);
end $$;

revoke all on function public.claim_student_device(text, text) from public;
grant execute on function public.claim_student_device(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0041_two_phones_at_once_were_both_the_first')
  on conflict (version) do nothing;
