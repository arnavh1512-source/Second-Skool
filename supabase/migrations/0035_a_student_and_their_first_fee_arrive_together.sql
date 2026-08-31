-- ============================================================================
-- A STUDENT AND THEIR FIRST FEE ARRIVE TOGETHER — Second Skool
--
-- 0034 said "every fee write is one transaction" and it was one insert short of
-- true. addStudent() wrote the student row, waited for it to commit, and then
-- inserted the enrolment fee as a second request:
--
--   insert into students ...   -- committed
--   insert into fees ...       -- separate request, may never happen
--
-- Two ways that ends badly, and both have happened to somebody. The connection
-- drops between them and the head has a student who owes nothing, when the
-- whole point of typing 2000 into the fee box was that they owe 2000 — nobody
-- notices until the month is over. Or the person adding the student is a
-- teacher: students_staff lets them create the child, fees_head refuses the
-- fee, and the app cheerfully reports the student saved while the money
-- silently did not.
--
-- create_student() does both in one function body, which is one transaction.
-- Either the child and their first fee are both there or neither is.
--
-- The second half of this file is the same bug wearing different clothes.
-- students.fee_status defaulted to 'Due', the roster import wrote 'Due'
-- explicitly and so did student_signup(), so every path that creates a student
-- without a fee — a pasted-in roster, a student signing themselves up and
-- waiting for approval — produced a Due badge with no fee row under it. That is
-- exactly the lie 0034's repair pass went through the table to erase, and the
-- very next import wrote it straight back.
--
-- "Due" means "at least one fee row is not Paid". A student being inserted has
-- no fee rows at all, so the only truthful badge at that instant is Paid, no
-- matter what the caller passed. That is a property of the table rather than of
-- any one caller, so it is enforced once, on the table, and every path present
-- and future inherits it — including create_student() below, which then sets
-- the real badge from fee_status_of() once the fee row exists.
--
-- Run this in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Nothing outstanding is the honest starting position for a new student.
-- ---------------------------------------------------------------------------
create or replace function public.students_start_settled()
returns trigger language plpgsql set search_path = public as $$
begin
  new.fee_status := 'Paid';
  return new;
end; $$;

drop trigger if exists students_start_settled on public.students;
create trigger students_start_settled
  before insert on public.students
  for each row execute function public.students_start_settled();

-- ---------------------------------------------------------------------------
-- Create a student, and their enrolment fee if there is one.
--
-- SECURITY INVOKER, so the same two policies decide as before: students_staff
-- for the child, fees_head for the money. What changes is that a teacher who
-- types a fee is now told so instead of being handed a half-made record — the
-- raise aborts the whole function, so no student row survives it either. The
-- check is explicit rather than left to fees_head, because a with-check
-- violation is unreadable in a toast and this one has a plain sentence.
--
-- The student code is chosen by the caller. It is minted against the roster
-- already on the screen and the unique index is the real arbiter, which is the
-- arrangement importStudents has always used.
-- ---------------------------------------------------------------------------
create or replace function public.create_student(
  p_name text,
  p_class text,
  p_batch text,
  p_school text,
  p_parent_contact text,
  p_student_code text,
  p_address text,
  p_branch_id uuid,
  p_fee_amount numeric default null,
  p_fee_due_date date default null)
returns json language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_fees int := 0; v_status text;
begin
  if p_fee_amount is not null and p_fee_amount > 0 and not public.is_head() then
    raise exception 'only the head can set a fee — leave the fee blank to add the student';
  end if;

  insert into public.students
    (name, class, batch, school, parent_contact, student_code, address, branch_id)
  values
    (p_name, p_class, p_batch, p_school, p_parent_contact, p_student_code, p_address, p_branch_id)
  returning id into v_id;

  if p_fee_amount is not null and p_fee_amount > 0 then
    insert into public.fees (student_id, amount, period, due_date, status)
      values (v_id, p_fee_amount, to_char(now(), 'Mon YYYY'), coalesce(p_fee_due_date, current_date), 'Due');
    get diagnostics v_fees = row_count;
  end if;

  v_status := public.fee_status_of(v_id);
  update public.students set fee_status = v_status where id = v_id;

  return json_build_object('student', 1, 'id', v_id, 'fees', v_fees, 'status', v_status);
end; $$;

-- Students have no auth session and do not enrol anybody, including themselves:
-- student_signup() is the anon path and it is SECURITY DEFINER for that reason.
revoke all on function public.create_student(
  text, text, text, text, text, text, text, uuid, numeric, date) from public, anon;
grant execute on function public.create_student(
  text, text, text, text, text, text, text, uuid, numeric, date) to authenticated;

-- ---------------------------------------------------------------------------
-- approve_student() has to say what the badge is now, rather than inherit it.
--
-- It used to work by accident: student_signup() stamped 'Due' on the pending
-- row, and approving with a fee happened to agree with it. Approving WITHOUT a
-- fee did not — that student stayed Due forever with nothing to pay — and now
-- that a new row starts Paid the accident runs the other way too, leaving a
-- Paid badge over a fee that is genuinely owed. Deriving it once at the end is
-- right in both directions, and it is the same fee_status_of() every other fee
-- path uses, so there is only ever one definition of what Due means.
--
-- Otherwise unchanged from 0003.
-- ---------------------------------------------------------------------------
create or replace function public.approve_student(
  p_id        uuid,
  p_class     text default null,
  p_branch_id uuid default null,
  p_fee       numeric default null,
  p_fee_due   date default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  update public.students
     set status    = 'approved',
         class     = coalesce(nullif(trim(p_class), ''), class),
         branch_id = coalesce(p_branch_id, branch_id)
   where id = p_id and centre_id = public.current_centre() and status = 'pending';
  if not found then raise exception 'Request not found or already handled'; end if;

  if p_fee is not null and p_fee > 0 then
    insert into public.fees (student_id, amount, period, due_date, status)
    values (p_id, p_fee, to_char(now(), 'Mon YYYY'), coalesce(p_fee_due, current_date), 'Due');
  end if;

  update public.students set fee_status = public.fee_status_of(p_id) where id = p_id;
end; $$;

-- ---------------------------------------------------------------------------
-- Erase the false Due badges written since 0034 ran — every roster import and
-- every student still waiting for approval. Identical to 0034's repair pass,
-- and it stays here rather than being assumed done, because the trigger above
-- is what stops the next one.
-- ---------------------------------------------------------------------------
update public.students s
   set fee_status = public.fee_status_of(s.id)
 where s.fee_status is distinct from public.fee_status_of(s.id);

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0035_a_student_and_their_first_fee_arrive_together')
  on conflict (version) do nothing;
