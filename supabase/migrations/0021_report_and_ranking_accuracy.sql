-- ============================================================================
-- REPORT AND RANKING ACCURACY — Second Skool
--
-- Four numbers this file corrects, all of them numbers somebody reads and
-- believes: a child's attendance percentage, their place on a leaderboard, a
-- branch's student count, and who is allowed to delete a notes file.
--
-- Run this in Supabase → SQL Editor. Safe to re-run: every statement is
-- `create or replace` or a drop-then-create, and none of it touches data.
--
-- ── 1. get_student_snapshot: attendance stopped at 90 days ──────────────────
-- The snapshot built the student's attendance out of public.attendance alone.
-- archive_old_attendance() (scheduled monthly by 0013) rolls everything older
-- than 90 days into public.attendance_monthly and DELETES it from
-- public.attendance, so from the fourth month onwards the parent's percentage
-- silently became "the last 90 days" — while the teacher, whose screen is fed
-- by student_attendance_totals(), still saw the lifetime figure. Two numbers
-- for the same child, neither of them labelled, and the one the parent trusts
-- was the wrong one.
--
-- The daily list stays exactly as it was: it is what the day-by-day log on the
-- Attendance screen renders, and it can only ever show un-archived days. What
-- is added is `attendanceTotals` — the lifetime present/total pair, spanning
-- both halves of the history the same way student_attendance_totals() does.
--
-- ── 2. rankings: two students with one name became one student ──────────────
-- The rankings block grouped by `st.name`. Two students called Aarav Patel in
-- the same centre collapsed into a single leaderboard row carrying the sum of
-- both their marks over the sum of both their maximums — a rank neither child
-- had earned, under a name that belonged to both of them. And the app, which
-- could only match the reader by name, then highlighted that row as "(You)"
-- for both of them.
--
-- Grouped by st.id now, with the name carried alongside as a label. Each entry
-- is a json object {id, name, score} instead of a [name, score] pair; the app
-- reads both shapes, so a centre that has not run this file yet keeps working
-- (its boards simply arrive with no ids and fall back to name matching).
--
-- ── 3. weekly reports counted students who are not students yet ─────────────
-- weekly_branch_report and weekly_student_reports counted public.students with
-- no status filter, so self-registered rows still awaiting the head's approval
-- — and rows the head had already rejected — were counted as enrolled. The app
-- filters to status='approved' everywhere it lists students, so the Reports
-- screen and the Students screen disagreed about how many children a branch
-- had, and `unassigned_students` counted every pending registration.
--
-- ── 4. notes storage: any staff account could delete any centre's files ─────
-- The upload and delete policies on the notes bucket checked is_staff() and
-- nothing else, so a teacher at one centre could delete a file belonging to
-- another. Nobody could FIND another centre's files (paths are random UUIDs
-- and there is no select policy, so the bucket cannot be listed), which is why
-- this is defence in depth rather than an open door — but "you cannot guess
-- the name" is not an access rule.
--
-- New uploads go to `<centre_id>/<uuid>.<ext>` and the policies check that
-- first path segment. Files uploaded before this file ran sit at the bucket
-- root with no segment at all; the delete policy still accepts those, because
-- refusing them would strand every existing note file with no way to remove
-- it. That exemption shrinks to nothing on its own as old notes are deleted.
--
-- ── TWO THINGS THIS FILE DELIBERATELY DOES NOT CHANGE ───────────────────────
--
-- (a) Student join codes issued before 0007_audit_hardening.sql came from
--     Postgres `random()`, which is a seeded PRNG and not a CSPRNG — those
--     codes are predictable to anyone who can observe enough of them. 0007
--     moved new codes onto gen_random_bytes(), but it did not and could not
--     rotate the ones already handed out to parents. Any centre created before
--     0007 should rotate its code once, by hand:
--
--         select public.regenerate_student_code();
--
--     It is left manual on purpose: rotating invalidates the code the centre
--     has already printed and shared, so it is the head's call, not a
--     migration's.
--
-- (b) public.code_attempts is one global bucket, not one per IP or per centre.
--     The 25-per-minute throttle on invalid student codes is therefore shared
--     across every centre on the instance: a burst of wrong codes anywhere
--     briefly locks out honest students everywhere. That is the intended
--     trade-off at this size — the alternative needs per-caller identity the
--     anon role does not have — but it is a real ceiling, and it is written
--     down here so the next person to look does not have to rediscover it.
-- ============================================================================

-- ─── 1 + 2. get_student_snapshot ────────────────────────────────────────────
-- Reproduced whole (plpgsql has no partial replace). Only the `attendance`
-- neighbourhood and the `rankings` block differ from 0003.
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
    -- Lifetime counts across both halves of the history. The archive deletes
    -- what it rolls up, so the two sources never overlap and nothing is
    -- double-counted — the same guarantee student_attendance_totals() relies on.
    'attendanceTotals', json_build_object(
      'present', (select coalesce((select sum(am.present) from public.attendance_monthly am where am.student_id=v_student.id),0)
                       + (select count(*) from public.attendance a where a.student_id=v_student.id and a.status='Present'))::int,
      'total',   (select coalesce((select sum(am.total) from public.attendance_monthly am where am.student_id=v_student.id),0)
                       + (select count(*) from public.attendance a where a.student_id=v_student.id))::int
    ),
    'results', coalesce((select json_agg(json_build_object('subject',s.name,'test',t.name,'date',t.date,'marks',r.marks,'total',t.max_marks) order by t.date desc) from public.results r join public.tests t on t.id=r.test_id join public.subjects s on s.id=t.subject_id where r.student_id=v_student.id),'[]'::json),
    'fees', coalesce((select json_agg(json_build_object('period',f.period,'amount',f.amount,'status',f.status,'dueDate',f.due_date,'paidDate',f.paid_date) order by f.due_date desc) from public.fees f where f.student_id=v_student.id),'[]'::json),
    'notifications', coalesce((select json_agg(json_build_object('title',n.title,'detail',n.detail,'icon',n.icon,'createdAt',n.created_at) order by n.created_at desc) from public.notifications n where n.student_id=v_student.id),'[]'::json),
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
    'timetable', coalesce((select json_agg(json_build_object('day',tt.day,'start',tt.start_time,'end',tt.end_time,'subject',tt.subject,'room',tt.room) order by tt.start_time) from public.timetable tt where tt.class=v_student.class and tt.centre_id=v_c),'[]'::json),
    'assignments', coalesce((select json_agg(json_build_object('title',ag.title,'subject',sub.name,'due',ag.due_date,'instructions',ag.instructions) order by ag.due_date desc) from public.assignments ag left join public.subjects sub on sub.id=ag.subject_id where ag.class=v_student.class and ag.centre_id=v_c),'[]'::json)
  ) into v_result;
  return v_result;
end; $$;

grant execute on function public.get_student_snapshot(text) to anon, authenticated;

-- ─── 3. Weekly reports count enrolled students only ─────────────────────────
create or replace function public.weekly_branch_report(p_days int default 7)
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_since timestamptz := now() - make_interval(days => p_days); v_date_since date := current_date - p_days; v_c uuid := public.current_centre();
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  select json_build_object('generated_at', now(),
    'branches', coalesce((select json_agg(json_build_object(
      'name', b.name,
      -- status='approved' on every students count below. Without it a branch's
      -- roll included every registration nobody had approved yet.
      'students', (select count(*) from public.students s where s.branch_id=b.id and s.status='approved'),
      'new_students', (select count(*) from public.students s where s.branch_id=b.id and s.status='approved' and s.created_at>=v_since),
      'staff', (select count(*) from public.teachers t where t.branch_id=b.id),
      'att_pct', (select coalesce(round(count(*) filter (where a.status='Present')::numeric/nullif(count(*),0)*100),0)::int from public.attendance a join public.students s on s.id=a.student_id where s.branch_id=b.id and s.status='approved' and a.date>=v_date_since),
      'fees_collected', (select coalesce(sum(f.amount),0)::bigint from public.fees f join public.students s on s.id=f.student_id where s.branch_id=b.id and s.status='approved' and f.status='Paid' and f.paid_date>=v_date_since),
      'fees_pending', (select coalesce(sum(f.amount),0)::bigint from public.fees f join public.students s on s.id=f.student_id where s.branch_id=b.id and s.status='approved' and f.status<>'Paid')
    ) order by b.is_main desc, b.name) from public.branches b where b.centre_id=v_c),'[]'::json),
    -- "Unassigned" means an enrolled student nobody has put in a branch. A
    -- pending registration has no branch by definition and is not a gap to fix.
    'unassigned_students', (select count(*) from public.students where branch_id is null and centre_id=v_c and status='approved'),
    'tests_this_week', (select count(*) from public.tests where date>=v_date_since and centre_id=v_c)
  ) into v_result; return v_result;
end; $$;

create or replace function public.weekly_student_reports(p_days int default 7)
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_date_since date := current_date - p_days; v_c uuid := public.current_centre();
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  select coalesce(json_agg(json_build_object(
    'name', s.name, 'klass', s.class, 'parent', s.parent_contact, 'fee_status', s.fee_status,
    'att_present', (select count(*) from public.attendance a where a.student_id=s.id and a.date>=v_date_since and a.status='Present'),
    'att_total', (select count(*) from public.attendance a where a.student_id=s.id and a.date>=v_date_since),
    'tests', (select count(*) from public.results r join public.tests t on t.id=r.test_id where r.student_id=s.id and t.date>=v_date_since),
    'avg_pct', (select coalesce(round(sum(r.marks)::numeric/nullif(sum(t.max_marks),0)*100),0)::int from public.results r join public.tests t on t.id=r.test_id where r.student_id=s.id and t.date>=v_date_since)
  ) order by s.name),'[]'::json) into v_result
  -- Enrolled students only. A pending registration has no attendance, no marks
  -- and no fees, so it arrived as a row of zeros that read like a child who had
  -- stopped turning up.
  from public.students s where s.centre_id=v_c and s.status='approved';
  return v_result;
end; $$;

grant execute on function public.weekly_branch_report(int), public.weekly_student_reports(int) to authenticated;

-- ─── 4. Notes storage scoped to the owning centre ───────────────────────────
drop policy if exists "notes files staff upload" on storage.objects;
drop policy if exists "notes files staff delete" on storage.objects;

-- Uploads must land under the caller's own centre id.
create policy "notes files staff upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'notes'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_centre()::text
  );

-- Deletes are scoped the same way, with one exemption: an object at the bucket
-- root has no centre segment because it predates this file, and refusing those
-- would leave every existing note file undeletable.
create policy "notes files staff delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'notes'
    and public.is_staff()
    and coalesce((storage.foldername(name))[1], '') in (public.current_centre()::text, '')
  );

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0021_report_and_ranking_accuracy')
  on conflict (version) do nothing;
