-- ============================================================================
-- EVERY FEE WRITE IN ONE TRANSACTION — Second Skool
--
-- 0030 said "money in one transaction" and only half meant it. Collecting and
-- reopening went through mark_fees_paid() and reopen_fees_today(), which lock
-- the student row and change the fee rows and the badge together. Creating and
-- deleting a fee did not: the browser wrote the fee row, that write committed,
-- and only then did a second request call sync_fee_status(). Two transactions,
-- and the same gap 0030 was written to close — a fee added on one phone while
-- another was collecting could leave the badge and the rows disagreeing, and a
-- dropped connection between the two requests left it that way for good.
--
-- The row lock did not help there either, and it is worth being precise about
-- why. `select ... for update` on the student row makes other writers of THAT
-- ROW wait. It does not make an insert into fees wait — fees is a different
-- table, and a child row can be inserted while the parent is locked. The lock
-- only serialises the fee paths because every one of them writes
-- students.fee_status. A path that inserts a fee and does not take the lock is
-- outside the queue entirely, which is exactly what addFee was.
--
-- So the remaining four paths become functions too: add_fee, add_fee_plan,
-- delete_fee and delete_fee_plan. Each takes the same lock, changes the fee
-- rows, and derives the badge from what is left — all inside one function body,
-- which is one transaction. SECURITY INVOKER throughout, so RLS decides who may
-- do what exactly as it did when the browser issued the statements itself: a
-- teacher's delete still finds nothing, because fees_head is still the policy.
--
-- And one real bug, in reopen_fees_today().
--
--   update fees set status='Due' where ... and paid_date = current_date;
--   update students set fee_status='Due';   -- unconditionally
--
-- The second write did not depend on the first. A student whose fees were all
-- collected in earlier months has nothing to reopen — the first update touches
-- zero rows, correctly, because rewriting fee history is not an undo. But the
-- badge flipped to Due anyway. The family then reads "Due" against a fee list
-- in which every row says Paid, and the head has no way to clear it except to
-- mark paid fees paid again. The badge is now derived, like everywhere else.
--
-- Run this in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The one definition of what the badge means.
--
-- "Due" is "at least one fee row is not Paid". A student with no fee rows at
-- all reads Paid, because this app means "nothing outstanding" by it. Five
-- functions below need that sentence and none of them should own a second copy
-- of it — a badge rule that disagrees with itself between two code paths is the
-- whole class of bug this migration exists to end.
--
-- No lock of its own: every caller already holds the student row.
-- ---------------------------------------------------------------------------
create or replace function public.fee_status_of(p_student_id uuid)
returns text language sql stable security invoker set search_path = public as $$
  select case when exists (
    select 1 from public.fees where student_id = p_student_id and status <> 'Paid'
  ) then 'Due' else 'Paid' end;
$$;

-- ---------------------------------------------------------------------------
-- Recompute the badge from the rows that are actually there. Unchanged in
-- behaviour; it just no longer spells the rule out itself.
-- ---------------------------------------------------------------------------
create or replace function public.sync_fee_status(p_student_id uuid)
returns json language plpgsql security invoker set search_path = public as $$
declare v_locked uuid; v_status text; v_rows int;
begin
  select id into v_locked from public.students where id = p_student_id for update;
  if v_locked is null then return json_build_object('student', 0, 'status', null); end if;

  v_status := public.fee_status_of(p_student_id);
  update public.students set fee_status = v_status where id = p_student_id;
  get diagnostics v_rows = row_count;
  return json_build_object('student', v_rows, 'status', v_status);
end; $$;

-- ---------------------------------------------------------------------------
-- Undo a mis-tap, and only a mis-tap.
--
-- Fees marked paid TODAY reopen. A month collected in April must never flip
-- back: that is not an undo, it is fee history rewriting itself, and the
-- fees-collected report is built on it.
--
-- The badge that follows is derived rather than assumed. Reopening a row makes
-- it Due, so in the ordinary case the answer is the same one this used to write
-- blindly — but when there was nothing to reopen, the honest answer is whatever
-- the remaining rows say, which for a fully collected student is Paid.
-- ---------------------------------------------------------------------------
create or replace function public.reopen_fees_today(p_student_id uuid)
returns json language plpgsql security invoker set search_path = public as $$
declare v_locked uuid; v_fees int; v_students int; v_status text;
begin
  select id into v_locked from public.students where id = p_student_id for update;
  if v_locked is null then return json_build_object('student', 0, 'fees', 0, 'status', null); end if;

  update public.fees set status = 'Due', paid_date = null
    where student_id = p_student_id and status = 'Paid' and paid_date = current_date;
  get diagnostics v_fees = row_count;

  v_status := public.fee_status_of(p_student_id);
  update public.students set fee_status = v_status where id = p_student_id;
  get diagnostics v_students = row_count;

  return json_build_object('student', v_students, 'fees', v_fees, 'status', v_status);
end; $$;

-- ---------------------------------------------------------------------------
-- Add one fee.
--
-- The insert and the badge, together. The lock is taken before the insert
-- rather than after, so a collection running on another phone either sees this
-- fee and collects it, or does not and leaves it outstanding — and in both
-- orders the badge agrees with the rows.
--
-- A missing student row is the RLS answer as much as the roster's: a head
-- aiming this at another centre's child cannot see the row to lock it, and gets
-- student 0 rather than an inserted fee. centre_id fills itself from the
-- caller's session through the column default, so the fee cannot land anywhere
-- but the caller's own centre.
-- ---------------------------------------------------------------------------
create or replace function public.add_fee(
  p_student_id uuid, p_amount numeric, p_period text, p_due_date date)
returns json language plpgsql security invoker set search_path = public as $$
declare v_locked uuid; v_fee uuid; v_students int; v_status text;
begin
  select id into v_locked from public.students where id = p_student_id for update;
  if v_locked is null then return json_build_object('student', 0, 'fees', 0, 'status', null); end if;

  insert into public.fees (student_id, amount, period, due_date, status)
    values (p_student_id, p_amount, p_period, p_due_date, 'Due')
    returning id into v_fee;

  v_status := public.fee_status_of(p_student_id);
  update public.students set fee_status = v_status where id = p_student_id;
  get diagnostics v_students = row_count;

  return json_build_object('student', v_students, 'fees', 1, 'fee_id', v_fee, 'status', v_status);
end; $$;

-- ---------------------------------------------------------------------------
-- Add a whole installment plan.
--
-- The installments arrive as a json array — [{"amount":…,"period":…,
-- "due_date":…}, …] — because the alternative is one call per installment, and
-- a plan that is three rows in when the connection drops is worse than no plan
-- at all. One statement, one transaction, all six rows or none.
--
-- The plan id is generated here rather than accepted from the browser. It only
-- exists to group rows created together, so nothing outside this function has
-- any business choosing it, and a client that reuses one cannot glue its rows
-- onto somebody else's plan.
-- ---------------------------------------------------------------------------
create or replace function public.add_fee_plan(p_student_id uuid, p_installments json)
returns json language plpgsql security invoker set search_path = public as $$
declare v_locked uuid; v_plan uuid; v_fees int; v_students int; v_status text;
begin
  select id into v_locked from public.students where id = p_student_id for update;
  if v_locked is null then return json_build_object('student', 0, 'fees', 0, 'status', null); end if;

  if p_installments is null or json_array_length(p_installments) = 0 then
    raise exception 'a plan needs at least one installment';
  end if;

  v_plan := gen_random_uuid();

  insert into public.fees (student_id, plan_id, amount, period, due_date, status)
  select p_student_id, v_plan, (i->>'amount')::numeric, i->>'period', (i->>'due_date')::date, 'Due'
    from json_array_elements(p_installments) as i;
  get diagnostics v_fees = row_count;

  v_status := public.fee_status_of(p_student_id);
  update public.students set fee_status = v_status where id = p_student_id;
  get diagnostics v_students = row_count;

  return json_build_object('student', v_students, 'fees', v_fees, 'plan_id', v_plan, 'status', v_status);
end; $$;

-- ---------------------------------------------------------------------------
-- Remove one fee.
--
-- The student is read from the fee row rather than passed in, so there is no
-- way to lock one child and delete another's money. The read is the caller's
-- own, under fees_read, so a fee in another centre is simply not there — which
-- is the same answer as a fee that has already been deleted, and both are
-- reported as fees 0 rather than as an error.
-- ---------------------------------------------------------------------------
create or replace function public.delete_fee(p_fee_id uuid)
returns json language plpgsql security invoker set search_path = public as $$
declare v_student uuid; v_locked uuid; v_fees int; v_students int; v_status text;
begin
  select student_id into v_student from public.fees where id = p_fee_id;
  if v_student is null then return json_build_object('student', 0, 'fees', 0, 'status', null); end if;

  select id into v_locked from public.students where id = v_student for update;
  if v_locked is null then return json_build_object('student', 0, 'fees', 0, 'status', null); end if;

  delete from public.fees where id = p_fee_id;
  get diagnostics v_fees = row_count;
  -- A teacher gets here: fees_read let them find the row, fees_head refuses to
  -- delete it, and RLS filters the delete to nothing without raising. Report
  -- the zero and change no badge — the caller turns it into "not saved".
  if v_fees = 0 then return json_build_object('student', 0, 'fees', 0, 'status', null); end if;

  v_status := public.fee_status_of(v_student);
  update public.students set fee_status = v_status where id = v_student;
  get diagnostics v_students = row_count;

  return json_build_object('student', v_students, 'fees', v_fees, 'status', v_status);
end; $$;

-- ---------------------------------------------------------------------------
-- Remove the unpaid half of a plan.
--
-- Only the unpaid rows go. An installment already collected is money that
-- changed hands, and deleting it would quietly erase it from the fees-collected
-- report. A plan whose every installment is paid therefore deletes nothing, and
-- says so.
-- ---------------------------------------------------------------------------
create or replace function public.delete_fee_plan(p_plan_id uuid, p_student_id uuid)
returns json language plpgsql security invoker set search_path = public as $$
declare v_locked uuid; v_fees int; v_students int; v_status text;
begin
  select id into v_locked from public.students where id = p_student_id for update;
  if v_locked is null then return json_build_object('student', 0, 'fees', 0, 'status', null); end if;

  delete from public.fees
    where plan_id = p_plan_id and student_id = p_student_id and status <> 'Paid';
  get diagnostics v_fees = row_count;
  if v_fees = 0 then return json_build_object('student', 0, 'fees', 0, 'status', null); end if;

  v_status := public.fee_status_of(p_student_id);
  update public.students set fee_status = v_status where id = p_student_id;
  get diagnostics v_students = row_count;

  return json_build_object('student', v_students, 'fees', v_fees, 'status', v_status);
end; $$;

-- Students have no auth session and no business touching fees.
revoke all on function public.fee_status_of(uuid)                          from public, anon;
revoke all on function public.add_fee(uuid, numeric, text, date)           from public, anon;
revoke all on function public.add_fee_plan(uuid, json)                     from public, anon;
revoke all on function public.delete_fee(uuid)                             from public, anon;
revoke all on function public.delete_fee_plan(uuid, uuid)                  from public, anon;
grant execute on function public.fee_status_of(uuid)                       to authenticated;
grant execute on function public.add_fee(uuid, numeric, text, date)        to authenticated;
grant execute on function public.add_fee_plan(uuid, json)                  to authenticated;
grant execute on function public.delete_fee(uuid)                          to authenticated;
grant execute on function public.delete_fee_plan(uuid, uuid)               to authenticated;

-- ---------------------------------------------------------------------------
-- Repair the badges 0030's reopen bug has already written.
--
-- Any student reading Due with nothing outstanding is either one of those, or
-- an older two-phase write whose second half never arrived. Both are the same
-- disagreement between the rows and the column, and the rows are the truth.
-- ---------------------------------------------------------------------------
update public.students s
   set fee_status = public.fee_status_of(s.id)
 where s.fee_status is distinct from public.fee_status_of(s.id);

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0034_every_fee_write_in_one_transaction')
  on conflict (version) do nothing;
