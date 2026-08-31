-- ============================================================================
-- THE THROTTLE THAT LOCKED OUT THE WRONG PEOPLE — Second Skool
--
-- Four anon-callable functions take a student code and throttle the misses:
-- get_student_snapshot(), get_student_notes(), student_signup(), and
-- support_student() (which the three ticket functions all route through).
-- All four count the same way:
--
--   select count(*) from public.code_attempts where at > now() - interval '1 minute'
--   if v_fails >= 25 then raise exception 'Too many attempts'
--
-- Note what is not in that WHERE clause: who. There is one bucket for the
-- entire deployment. Twenty-five wrong codes a minute from one laptop and
-- every student at every centre on the platform is locked out — not slowed,
-- locked out, because their own valid lookup runs the same counter first. The
-- cheapest denial of service available against this app costs an attacker one
-- for-loop, and it lands on customers who have never heard of them.
--
-- It is also the wrong shape for the job it was hired to do. Somebody hunting
-- codes rather than downtime spreads across addresses and never trips a global
-- counter that one noisy client trips by accident. 0021 wrote the problem down
-- in a comment and left it there.
--
-- So the bucket is keyed on the caller. PostgREST puts the request headers in
-- a GUC, and Supabase sits behind a proxy that sets x-forwarded-for, so the
-- address is readable from inside the function — no new endpoint, no new
-- service, same table.
--
-- The global count stays as a backstop, at a ceiling no real traffic reaches.
-- A distributed attempt still meets a wall; one address can no longer put
-- everybody else behind it.
--
-- Run this in Supabase -> SQL Editor. Safe to re-run.
--
-- -- Also in this file --------------------------------------------------------
-- get_student_snapshot() has to be reproduced whole to change one block
-- (plpgsql has no partial replace), so the unbounded collections inside it are
-- bounded in the same pass. Every list it returned grew for the life of the
-- student with no ceiling: a child with four years of history was handed four
-- years of daily attendance to render fifteen rows of it. The caps below all
-- sit far above what any screen reads, and the lifetime attendance figures
-- come from attendanceTotals, which counts rather than lists and is untouched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Where the attempt came from. (user_id, from the baseline, buckets the
-- separate join_centre throttle by account; that path is already scoped and is
-- left alone here.)
-- ---------------------------------------------------------------------------
alter table public.code_attempts add column if not exists ip text;
create index if not exists code_attempts_ip_at_idx on public.code_attempts (ip, at);

-- ---------------------------------------------------------------------------
-- One guard, four callers. Raises if this caller has spent their budget,
-- records the attempt otherwise. Only ever called on a code that did not
-- match — a valid code costs nothing.
--
-- SECURITY DEFINER because anon must not hold rights on code_attempts itself:
-- a table an attacker can read tells them how close they are, and one they can
-- write lets them fill somebody else's bucket.
-- ---------------------------------------------------------------------------
create or replace function public.code_attempt_guard()
returns void language plpgsql security definer set search_path = public as $$
declare v_ip text; v_mine int; v_all int;
begin
  -- x-forwarded-for is a list; the client is the first entry. A direct SQL
  -- caller has no request headers at all and shares one 'unknown' bucket —
  -- which in production is nobody, and is the safe side to be wrong on.
  begin
    v_ip := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  v_ip := coalesce(nullif(trim(v_ip), ''), 'unknown');

  select count(*) into v_mine from public.code_attempts
    where ip = v_ip and at > now() - interval '1 minute';
  if v_mine >= 25 then
    raise exception 'Too many attempts — please try again in a minute';
  end if;

  -- Backstop. A distributed guess still meets a ceiling, but it is set where
  -- only an attack reaches it: 600 wrong codes a minute across every centre on
  -- the platform is not a bad afternoon at a tuition centre.
  select count(*) into v_all from public.code_attempts
    where user_id is null and at > now() - interval '1 minute';
  if v_all >= 600 then
    raise exception 'Too many attempts — please try again in a minute';
  end if;

  insert into public.code_attempts (ip) values (v_ip);
  delete from public.code_attempts where at < now() - interval '5 minutes' and user_id is null;
end; $$;

revoke all on function public.code_attempt_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. get_student_notes() — reproduced from 0019, throttle block replaced.
-- ---------------------------------------------------------------------------
create or replace function public.get_student_notes(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students;
begin
  if length(coalesce(p_code,'')) < 4 then return '[]'::json; end if;

  select * into v_student from public.students where student_code = p_code;

  if v_student.id is null then
    perform public.code_attempt_guard();
    return '[]'::json;
  end if;

  -- Real code, but not approved yet (or declined). No throttle — the code is
  -- genuine — and no material either.
  if v_student.status <> 'approved' then return '[]'::json; end if;

  return coalesce((select json_agg(json_build_object('title',n.title,'subject',n.subject,'body',n.body,'fileUrl',n.file_url,'linkUrl',n.link_url,'date',n.created_at) order by n.created_at desc)
    from public.notes n where n.class=v_student.class and n.centre_id=v_student.centre_id),'[]'::json);
end; $$;

revoke all on function public.get_student_notes(text) from public;
grant execute on function public.get_student_notes(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. support_student() — reproduced from 0023, throttle block replaced. The
--    door for file_ticket(), my_tickets() and reply_ticket(), which all call
--    it first and are unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.support_student(p_code text)
returns public.students language plpgsql security definer set search_path = public as $$
declare v_student public.students;
begin
  if length(coalesce(p_code,'')) < 4 then raise exception 'Not found'; end if;
  select * into v_student from public.students where student_code = p_code;
  if v_student.id is null then
    perform public.code_attempt_guard();
    raise exception 'Not found';
  end if;
  -- A pending student has not been approved by the head. They can still report
  -- a problem — being stuck on the waiting screen is a legitimate thing to
  -- report — so status is deliberately not checked here.
  return v_student;
end $$;

revoke execute on function public.support_student(text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. student_signup() — reproduced from 0007, throttle block replaced.
-- ---------------------------------------------------------------------------
create or replace function public.student_signup(
  p_join_code text, p_name text, p_parent text, p_class text, p_school text, p_address text default null
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_centre uuid; v_cname text; v_code text;
  v_name text := trim(coalesce(p_name,'')); v_parent text := trim(coalesce(p_parent,''));
  v_class text := trim(coalesce(p_class,'')); v_school text := trim(coalesce(p_school,''));
  v_pending int;
begin
  if length(v_name)   < 2 then raise exception 'Enter your full name'; end if;
  if v_parent !~ '^\+?\d[\d\s\-]{6,}$' then raise exception 'Enter a valid parent phone number'; end if;
  if length(v_class)  < 1 then raise exception 'Select your class'; end if;
  if length(v_school) < 2 then raise exception 'Enter your school name'; end if;

  select id, name into v_centre, v_cname
    from public.centres where student_join_code = upper(trim(coalesce(p_join_code,'')));
  if v_centre is null then
    perform public.code_attempt_guard();
    raise exception 'Invalid student code — check with your teacher';
  end if;

  select count(*) into v_pending from public.students where centre_id = v_centre and status = 'pending';
  if v_pending >= 300 then raise exception 'Too many pending requests — please ask your teacher'; end if;

  loop
    v_code := 'TUT-' || public.secure_code(8);
    exit when not exists (select 1 from public.students where student_code = v_code);
  end loop;

  insert into public.students (name, class, school, parent_contact, address, student_code, fee_status, centre_id, status)
  values (v_name, v_class, v_school, v_parent, nullif(trim(coalesce(p_address,'')),''), v_code, 'Due', v_centre, 'pending');

  return json_build_object('code', v_code, 'name', v_name, 'centre', v_cname);
end; $$;

revoke all on function public.student_signup(text,text,text,text,text,text) from public;
grant execute on function public.student_signup(text,text,text,text,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. get_student_snapshot() — reproduced from 0025. Two changes: the throttle
--    block, and a ceiling on every collection. The caps are larger than any
--    screen reads, so nothing changes for a real household — a centre would
--    have to run for a decade to reach one.
-- ---------------------------------------------------------------------------
create or replace function public.get_student_snapshot(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_result json; v_c uuid;
begin
  if length(coalesce(p_code,'')) < 4 then return null; end if;

  select * into v_student from public.students where student_code = p_code;

  if v_student.id is null then
    perform public.code_attempt_guard();
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

  -- ── Parent reach ──────────────────────────────────────────────────────────
  -- Getting here means an approved household just opened the app. Stamp it,
  -- at most once an hour. See 0024 for why this lives here.
  if v_student.last_seen_at is null or v_student.last_seen_at < now() - interval '1 hour' then
    update public.students set last_seen_at = now() where id = v_student.id;
  end if;

  v_c := v_student.centre_id;
  select json_build_object(
    'status', 'approved',
    'student', json_build_object('dbId',v_student.id,'name',v_student.name,'klass',v_student.class,'school',v_student.school,'code',v_student.student_code,'parent',v_student.parent_contact,'address',v_student.address,'feeStatus',v_student.fee_status),
    -- The day-by-day log on the student side shows fifteen rows. 180 is most
    -- of a school year, and the archiver rolls anything older than 90 days out
    -- of this table anyway.
    'attendance', coalesce((select json_agg(json_build_object('date',a.date,'status',a.status) order by a.date desc)
      from (select date, status from public.attendance where student_id=v_student.id order by date desc limit 180) a),'[]'::json),
    -- Lifetime counts across both halves of the history. The archive deletes
    -- what it rolls up, so the two sources never overlap and nothing is
    -- double-counted — the same guarantee student_attendance_totals() relies on.
    -- These count rather than list, so the caps above do not touch them.
    'attendanceTotals', json_build_object(
      'present', (select coalesce((select sum(am.present) from public.attendance_monthly am where am.student_id=v_student.id),0)
                       + (select count(*) from public.attendance a where a.student_id=v_student.id and a.status='Present'))::int,
      'total',   (select coalesce((select sum(am.total) from public.attendance_monthly am where am.student_id=v_student.id),0)
                       + (select count(*) from public.attendance a where a.student_id=v_student.id))::int
    ),
    'results', coalesce((select json_agg(json_build_object('subject',x.subject,'test',x.test,'date',x.date,'marks',x.marks,'total',x.total) order by x.date desc)
      from (select s.name as subject, t.name as test, t.date as date, r.marks as marks, t.max_marks as total
              from public.results r
              join public.tests t on t.id=r.test_id
              join public.subjects s on s.id=t.subject_id
             where r.student_id=v_student.id order by t.date desc limit 300) x),'[]'::json),
    -- The outstanding balance and the next installment are computed from this
    -- whole list, so the cap has to sit well above any real fee history:
    -- 200 rows is sixteen years of monthly fees.
    'fees', coalesce((select json_agg(json_build_object('period',x.period,'amount',x.amount,'status',x.status,'dueDate',x.due_date,'paidDate',x.paid_date) order by x.due_date desc)
      from (select period, amount, status, due_date, paid_date from public.fees
             where student_id=v_student.id order by due_date desc limit 200) x),'[]'::json),
    'notifications', coalesce((select json_agg(json_build_object('title',x.title,'detail',x.detail,'icon',x.icon,'createdAt',x.created_at) order by x.created_at desc)
      from (select title, detail, icon, created_at from public.notifications
             where student_id=v_student.id order by created_at desc limit 100) x),'[]'::json),
    'teachers', coalesce((select json_agg(json_build_object('name',te.name,'subject',te.subject,'experience',te.experience,'qualification',te.qualification,'rating',te.rating,'about',te.about) order by te.created_at desc) from public.teachers te where te.centre_id=v_c),'[]'::json),
    -- Grouped by st.id. The name rides along as a label, never as the key.
    -- Approved students only: a pending registration has no place on a board.
    'rankings', coalesce((
      select json_object_agg(subject, arr) from (
        select subject, json_agg(json_build_object('id', sid, 'name', name, 'score', pct) order by pct desc, name) as arr
        from (
          select s.name as subject, st.id as sid, st.name as name,
                 round(sum(r.marks)::numeric / nullif(sum(t.max_marks),0) * 100)::int as pct
          from public.results r
          join public.tests t on t.id = r.test_id
          join public.subjects s on s.id = t.subject_id
          join public.students st on st.id = r.student_id
          where st.centre_id = v_c and st.status = 'approved'
          group by s.name, st.id, st.name
        ) per_student
        group by subject
      ) ranked),'{}'::json),
    -- Left join on the teacher, because a period with no teacher set is the
    -- normal state of every row entered before 0025 and must keep working.
    'timetable', coalesce((select json_agg(json_build_object('day',tt.day,'start',tt.start_time,'end',tt.end_time,'subject',tt.subject,'room',tt.room,'teacher',tea.name) order by tt.start_time) from public.timetable tt left join public.teachers tea on tea.id = tt.teacher_id where tt.class=v_student.class and tt.centre_id=v_c),'[]'::json),
    'assignments', coalesce((select json_agg(json_build_object('title',x.title,'subject',x.subject,'due',x.due,'instructions',x.instructions) order by x.due desc)
      from (select ag.title as title, sub.name as subject, ag.due_date as due, ag.instructions as instructions
              from public.assignments ag
              left join public.subjects sub on sub.id=ag.subject_id
             where ag.class=v_student.class and ag.centre_id=v_c order by ag.due_date desc limit 100) x),'[]'::json)
  ) into v_result;
  return v_result;
end; $$;

grant execute on function public.get_student_snapshot(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0032_per_caller_throttle_and_bounds')
  on conflict (version) do nothing;
