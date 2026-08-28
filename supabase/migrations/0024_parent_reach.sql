-- ============================================================================
-- PARENT REACH — Second Skool
--
-- The head can see how many students are enrolled. She cannot see how many of
-- their families ever open the app. Those are very different numbers, and the
-- second one is the whole product: a centre that has 42 students and 6 looking
-- parents is not getting what it pays for, and nobody currently knows that
-- until the renewal conversation goes badly.
--
-- Run this in Supabase → SQL Editor. Safe to re-run.
--
-- ── Why this column and not a click counter ─────────────────────────────────
-- The obvious ways to measure reach all cost somebody work. Notification-open
-- tracking needs the service worker to phone home on every click. Reading
-- push_subscriptions needs a whole new security definer RPC, and it answers
-- the wrong question anyway — a granted permission is not a parent who looked.
-- Marking notifications read needs the student app to write, which students
-- have no session to do.
--
-- get_student_snapshot is already the student household's app-open path. It
-- runs, by definition, exactly when a parent opens the app, and it runs with
-- the privileges to write. So the measurement is a timestamp on a function
-- that was going to run regardless: no client change, no service worker
-- change, and — the part that matters — no teacher typing anything new. A
-- feature that costs teacher data entry does not ship here.
--
-- ── Why the write is throttled to an hour ───────────────────────────────────
-- This is a read path, and public.students carries an updated_at trigger, so
-- every bump is two writes and an index update. The number this feeds is
-- "opened in the last seven days". Hour resolution is already far finer than
-- that question needs, and it collapses a household refreshing the app six
-- times over breakfast into one write.
--
-- Approved students only. A pending registration has no data to look at, so
-- opening the app tells you nothing about whether the family is engaged.
-- ============================================================================

alter table public.students add column if not exists last_seen_at timestamptz;

-- The head's roster read filters by centre and buckets by recency, which is
-- exactly this pair. Nulls are in the index too — "never opened" is the
-- bucket she most needs to act on.
create index if not exists students_centre_last_seen_idx
  on public.students (centre_id, last_seen_at);

-- Reproduced whole from 0021 — plpgsql has no partial replace. The only change
-- is the parent-reach block, marked below.
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

  -- ── Parent reach ──────────────────────────────────────────────────────────
  -- Getting here means an approved household just opened the app. Stamp it,
  -- at most once an hour. See the header for why this lives here.
  if v_student.last_seen_at is null or v_student.last_seen_at < now() - interval '1 hour' then
    update public.students set last_seen_at = now() where id = v_student.id;
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

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0024_parent_reach')
  on conflict (version) do nothing;
