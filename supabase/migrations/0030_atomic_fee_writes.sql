-- ============================================================================
-- MONEY IN ONE TRANSACTION — Second Skool
--
-- Marking a student paid was two round trips from the browser:
--
--   update students set fee_status='Paid' where id=...      -- request 1
--   update fees set status='Paid' where student_id=... and status='Due'
--
-- Between those two requests the database is telling two different stories.
-- A fee added by the other half of the family, or by a teacher on another
-- phone, lands in that gap: the badge already says Paid and the new row says
-- Due, or the row is swept into Paid without anybody collecting the money.
-- Neither is a rounding error — it is a receipt for cash that did not change
-- hands, in the one part of this app a centre will actually check.
--
-- The gap closes here. A function body is a transaction, so both writes commit
-- together or neither does. SECURITY INVOKER, so RLS still decides who is
-- allowed: the head's policies apply exactly as they did when the browser
-- issued the two statements itself. Nothing is granted that was not reachable
-- before.
--
-- The row lock is the other half. `for update` on the student row makes the
-- concurrent writer wait, and every path that touches a student's money also
-- writes students.fee_status, so they all queue behind the same lock. A fee
-- added mid-collection now lands strictly before or strictly after — and
-- either order leaves the badge and the rows agreeing.
--
-- Run this in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Recompute the badge from the rows that are actually there.
--
-- students.fee_status is a stored column, not a total, so it has to be told.
-- The browser used to work out the new value from its own copy of the fee list
-- — a list fetched before the delete it is reacting to, and missing anything
-- another device added since. This asks the table instead, inside the same
-- transaction as the change that prompted it, which is the only place the
-- answer is knowable.
--
-- Paid is what this app means by "nothing outstanding", which is also why a
-- student with no fee records at all reads Paid.
-- ---------------------------------------------------------------------------
create or replace function public.sync_fee_status(p_student_id uuid)
returns json language plpgsql security invoker set search_path = public as $$
declare v_locked uuid; v_status text; v_rows int;
begin
  select id into v_locked from public.students where id = p_student_id for update;
  if v_locked is null then return json_build_object('student', 0, 'status', null); end if;

  select case when exists (
    select 1 from public.fees where student_id = p_student_id and status <> 'Paid'
  ) then 'Due' else 'Paid' end into v_status;

  update public.students set fee_status = v_status where id = p_student_id;
  get diagnostics v_rows = row_count;
  return json_build_object('student', v_rows, 'status', v_status);
end; $$;

-- ---------------------------------------------------------------------------
-- Collect everything outstanding.
--
-- Returns how many rows each half touched rather than raising, because the
-- caller already distinguishes the two failures it cares about: a student who
-- is no longer on the roster (student 0 — say so and roll the badge back) from
-- a student who simply had nothing due (fees 0 — perfectly normal).
-- ---------------------------------------------------------------------------
create or replace function public.mark_fees_paid(p_student_id uuid)
returns json language plpgsql security invoker set search_path = public as $$
declare v_locked uuid; v_fees int; v_students int;
begin
  select id into v_locked from public.students where id = p_student_id for update;
  if v_locked is null then return json_build_object('student', 0, 'fees', 0); end if;

  update public.fees set status = 'Paid', paid_date = current_date
    where student_id = p_student_id and status <> 'Paid';
  get diagnostics v_fees = row_count;

  update public.students set fee_status = 'Paid' where id = p_student_id;
  get diagnostics v_students = row_count;

  return json_build_object('student', v_students, 'fees', v_fees);
end; $$;

-- ---------------------------------------------------------------------------
-- Undo a mis-tap, and only a mis-tap.
--
-- Fees marked paid TODAY reopen. A month collected in April must never flip
-- back: that is not an undo, it is fee history rewriting itself, and the
-- fees-collected report is built on it.
-- ---------------------------------------------------------------------------
create or replace function public.reopen_fees_today(p_student_id uuid)
returns json language plpgsql security invoker set search_path = public as $$
declare v_locked uuid; v_fees int; v_students int;
begin
  select id into v_locked from public.students where id = p_student_id for update;
  if v_locked is null then return json_build_object('student', 0, 'fees', 0); end if;

  update public.fees set status = 'Due', paid_date = null
    where student_id = p_student_id and status = 'Paid' and paid_date = current_date;
  get diagnostics v_fees = row_count;

  update public.students set fee_status = 'Due' where id = p_student_id;
  get diagnostics v_students = row_count;

  return json_build_object('student', v_students, 'fees', v_fees);
end; $$;

-- Students have no auth session and no business touching fees.
revoke all on function public.sync_fee_status(uuid)   from public, anon;
revoke all on function public.mark_fees_paid(uuid)    from public, anon;
revoke all on function public.reopen_fees_today(uuid) from public, anon;
grant execute on function public.sync_fee_status(uuid)   to authenticated;
grant execute on function public.mark_fees_paid(uuid)    to authenticated;
grant execute on function public.reopen_fees_today(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0030_atomic_fee_writes')
  on conflict (version) do nothing;
