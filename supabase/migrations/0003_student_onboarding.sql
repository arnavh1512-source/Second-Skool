-- ============================================================================
-- STUDENT SELF-ONBOARDING — Second Skool
-- Students register themselves with the centre's join code and their own
-- details; the head reviews and approves before they gain access. Removes the
-- head's data-entry burden (no more typing 50 students by hand).
--
-- Model: a self-signup inserts a `pending` student row (SECURITY DEFINER, so an
-- anonymous student can only create a pending record in a centre whose join code
-- they know — never read or touch anyone else's data). The head approves (sets
-- batch/branch/fee) or rejects. A code only unlocks the dashboard once approved.
--
-- Safe to run once on the existing database (idempotent). Existing students
-- default to `approved`, so nothing already live is affected.
-- ⚠️ Back up first (Supabase → Database → Backups) before running in production.
-- ============================================================================

-- 1) Registration status on students -----------------------------------------
-- Existing rows default to 'approved' (already active); self-signups are 'pending'.
alter table public.students add column if not exists status text not null default 'approved';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'students_status_chk') then
    alter table public.students
      add constraint students_status_chk check (status in ('pending','approved','rejected'));
  end if;
end $$;

create index if not exists students_status_idx on public.students (centre_id, status);

-- 2) Student self-signup (anon) ----------------------------------------------
-- Validates the join code → centre, enforces the required fields, mints a unique
-- code, and inserts a PENDING student. Reuses code_attempts (from 0001_baseline.sql)
-- to throttle invalid-join-code spam. Returns the new code + centre name so the
-- app can show the student their code on the waiting screen.
create or replace function public.student_signup(
  p_join_code text,
  p_name      text,
  p_parent    text,
  p_class     text,
  p_school    text,
  p_address   text default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_centre  uuid;
  v_cname   text;
  v_code    text;
  v_id      uuid;
  v_name    text := trim(coalesce(p_name, ''));
  v_parent  text := trim(coalesce(p_parent, ''));
  v_class   text := trim(coalesce(p_class, ''));
  v_school  text := trim(coalesce(p_school, ''));
  v_fails   int;
  v_pending int;
  v_alpha   constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no confusable chars
  i         int;
begin
  -- Required fields (school is compulsory alongside name, parent, class).
  if length(v_name)   < 2 then raise exception 'Enter your full name'; end if;
  if v_parent !~ '^\+?\d[\d\s\-]{6,}$' then raise exception 'Enter a valid parent phone number'; end if;
  if length(v_class)  < 1 then raise exception 'Select your class'; end if;
  if length(v_school) < 2 then raise exception 'Enter your school name'; end if;

  -- Resolve the centre from its join code; throttle repeated invalid attempts.
  select id, name into v_centre, v_cname
    from public.centres where join_code = upper(trim(coalesce(p_join_code, '')));
  if v_centre is null then
    select count(*) into v_fails from public.code_attempts where at > now() - interval '1 minute';
    if v_fails >= 25 then raise exception 'Too many attempts — please try again in a minute'; end if;
    insert into public.code_attempts default values;
    delete from public.code_attempts where at < now() - interval '5 minutes';
    raise exception 'Invalid centre code — check with your teacher';
  end if;

  -- Flood guard: cap outstanding pending requests per centre.
  select count(*) into v_pending from public.students where centre_id = v_centre and status = 'pending';
  if v_pending >= 300 then raise exception 'Too many pending requests — please ask your teacher'; end if;

  -- Unique, human-readable code (TUT- + 8 chars from the confusable-free alphabet).
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    v_code := 'TUT-' || v_code;
    exit when not exists (select 1 from public.students where student_code = v_code);
  end loop;

  insert into public.students (name, class, school, parent_contact, address, student_code, fee_status, centre_id, status)
  values (v_name, v_class, v_school, v_parent, nullif(trim(coalesce(p_address, '')), ''), v_code, 'Due', v_centre, 'pending')
  returning id into v_id;

  return json_build_object('code', v_code, 'name', v_name, 'centre', v_cname);
end; $$;

revoke all on function public.student_signup(text,text,text,text,text,text) from public;
grant execute on function public.student_signup(text,text,text,text,text,text) to anon, authenticated;

-- 3) Head/staff approval of a pending student --------------------------------
-- Approve sets the registration live and lets staff assign batch (class),
-- branch, and an optional first fee in the same action.
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
end; $$;

create or replace function public.reject_student(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  update public.students set status = 'rejected'
   where id = p_id and centre_id = public.current_centre() and status = 'pending';
end; $$;

revoke all on function public.approve_student(uuid,text,uuid,numeric,date) from public, anon;
revoke all on function public.reject_student(uuid) from public, anon;
grant execute on function public.approve_student(uuid,text,uuid,numeric,date) to authenticated;
grant execute on function public.reject_student(uuid) to authenticated;

-- 4) Snapshot: gate the dashboard on approval --------------------------------
-- Rebuilds get_student_snapshot (0001_baseline.sql version) so that:
--   • invalid code   → null (throttled, unchanged)
--   • pending student → { status:'pending', ... } so the app holds on the
--                       waiting screen instead of showing the dashboard
--   • rejected        → null (real code, but no throttle — access declined)
--   • approved        → full snapshot, tagged status:'approved'
create or replace function public.get_student_snapshot(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_result json; v_c uuid; v_fails int;
begin
  if length(coalesce(p_code,'')) < 4 then return null; end if;

  select * into v_student from public.students where student_code = p_code;

  -- Invalid code: sliding-window throttle (valid codes skip this entirely).
  if v_student.id is null then
    select count(*) into v_fails from public.code_attempts where at > now() - interval '1 minute';
    if v_fails >= 25 then raise exception 'Too many attempts — please try again in a minute'; end if;
    insert into public.code_attempts default values;
    delete from public.code_attempts where at < now() - interval '5 minutes';
    return null;
  end if;

  -- Awaiting the head's approval: return a minimal marker (name only), no data.
  if v_student.status = 'pending' then
    return json_build_object('status', 'pending',
      'student', json_build_object('name', v_student.name, 'code', v_student.student_code));
  end if;

  -- Access declined (rejected): real code, so no throttle, but no access.
  if v_student.status <> 'approved' then
    return json_build_object('status', v_student.status);
  end if;

  v_c := v_student.centre_id;
  select json_build_object(
    'status', 'approved',
    'student', json_build_object('dbId',v_student.id,'name',v_student.name,'klass',v_student.class,'school',v_student.school,'code',v_student.student_code,'parent',v_student.parent_contact,'address',v_student.address,'feeStatus',v_student.fee_status),
    'attendance', coalesce((select json_agg(json_build_object('date',a.date,'status',a.status) order by a.date desc) from public.attendance a where a.student_id=v_student.id),'[]'::json),
    'results', coalesce((select json_agg(json_build_object('subject',s.name,'test',t.name,'date',t.date,'marks',r.marks,'total',t.max_marks) order by t.date desc) from public.results r join public.tests t on t.id=r.test_id join public.subjects s on s.id=t.subject_id where r.student_id=v_student.id),'[]'::json),
    'fees', coalesce((select json_agg(json_build_object('period',f.period,'amount',f.amount,'status',f.status,'dueDate',f.due_date,'paidDate',f.paid_date) order by f.due_date desc) from public.fees f where f.student_id=v_student.id),'[]'::json),
    'notifications', coalesce((select json_agg(json_build_object('title',n.title,'detail',n.detail,'icon',n.icon,'createdAt',n.created_at) order by n.created_at desc) from public.notifications n where n.student_id=v_student.id),'[]'::json),
    'teachers', coalesce((select json_agg(json_build_object('name',te.name,'subject',te.subject,'experience',te.experience,'qualification',te.qualification,'rating',te.rating,'about',te.about) order by te.created_at desc) from public.teachers te where te.centre_id=v_c),'[]'::json),
    'rankings', coalesce((select json_object_agg(subject,arr) from (select subject, json_agg(json_build_array(name,pct) order by pct desc) as arr from (select s.name as subject, st.name as name, round(sum(r.marks)::numeric/nullif(sum(t.max_marks),0)*100)::int as pct from public.results r join public.tests t on t.id=r.test_id join public.subjects s on s.id=t.subject_id join public.students st on st.id=r.student_id where st.centre_id=v_c group by s.name, st.name) per_student group by subject) ranked),'{}'::json),
    'timetable', coalesce((select json_agg(json_build_object('day',tt.day,'start',tt.start_time,'end',tt.end_time,'subject',tt.subject,'room',tt.room) order by tt.start_time) from public.timetable tt where tt.class=v_student.class and tt.centre_id=v_c),'[]'::json),
    'assignments', coalesce((select json_agg(json_build_object('title',ag.title,'subject',sub.name,'due',ag.due_date,'instructions',ag.instructions) order by ag.due_date desc) from public.assignments ag left join public.subjects sub on sub.id=ag.subject_id where ag.class=v_student.class and ag.centre_id=v_c),'[]'::json)
  ) into v_result;
  return v_result;
end; $$;

grant execute on function public.get_student_snapshot(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0003_student_onboarding')
  on conflict (version) do nothing;
