-- ============================================================================
-- A rank is only a rank within a class
-- ----------------------------------------------------------------------------
-- Rankings were grouped by subject alone, so a centre teaching Class 9, 10 and
-- 12 got one leaderboard per subject with every student on it. That is wrong
-- twice over. A Class 9 student is not competing with a Class 12 student, and
-- the percentages are not even comparable — the two classes sit different
-- papers, out of different totals, on different weeks.
--
-- Both places that build a ranking are fixed here:
--   centre_rankings()      — the staff board, now carries the class on each row
--                            so the screen can offer a class filter.
--   get_student_snapshot() — the parent board, now scoped server-side to the
--                            student's own class. A parent has no class picker
--                            and wants exactly one answer: where is my child in
--                            their class.
-- ============================================================================

-- ── Staff board ─────────────────────────────────────────────────────────────
-- Grouped by class as well as subject. The rows still come back keyed by
-- subject, because the screen's subject chips are what a teacher reaches for
-- first; the class rides along on each row and the screen filters on it. That
-- keeps one round trip instead of one per class.
create or replace function public.centre_rankings()
returns json language sql stable security invoker set search_path = public as $$
  select coalesce((
    select json_object_agg(subject, arr) from (
      select subject, json_agg(json_build_object('id', sid, 'name', name, 'klass', klass, 'score', pct)
                               order by klass, pct desc, name) as arr
      from (
        select s.name as subject, st.id as sid, st.name as name, st.class as klass,
               round(sum(r.marks)::numeric / nullif(sum(t.max_marks),0) * 100)::int as pct
        from public.results r
        join public.tests t on t.id = r.test_id
        join public.subjects s on s.id = t.subject_id
        join public.students st on st.id = r.student_id
        where st.centre_id = public.current_centre() and st.status = 'approved'
        group by s.name, st.id, st.name, st.class
      ) per_student
      group by subject
    ) ranked), '{}'::json)
$$;

revoke all on function public.centre_rankings() from public, anon;
grant execute on function public.centre_rankings() to authenticated;

-- ── Parent board ────────────────────────────────────────────────────────────
-- Reproduced whole from 0040. Postgres has no way to replace one statement
-- inside a function, so the whole body travels with every change; the only
-- difference from 0040 is the class filter in the rankings block below.
create or replace function public.get_student_snapshot(p_code text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_student public.students; v_result json; v_c uuid; v_device text;
begin
  if length(coalesce(p_code,'')) < 4 then return null; end if;

  v_student := public.student_for_credential(p_code);

  if v_student.id is null then
    -- Before treating this as a guess: it may be a real token belonging to a
    -- device the centre has not allowed yet, or one it has revoked. Neither is
    -- a guess, so neither is throttled, and a household staring at "Invalid
    -- code" would have no idea what to do. Both get a screen that says what
    -- happened and who can undo it.
    select case when d.revoked_at is not null then 'device_revoked' else 'device_pending' end
      into v_device
      from public.student_devices d
     where d.token_hash = encode(digest(p_code, 'sha256'), 'hex');
    if v_device is not null then return json_build_object('status', v_device); end if;

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
    -- CHANGED FROM 0040: scoped to the student's own class. A rank is only a
    -- rank against the people who sat the same paper. Grouped by st.id, so the
    -- name is a label and never the key; approved students only.
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
          where st.centre_id = v_c and st.status = 'approved' and st.class = v_student.class
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

insert into public.schema_migrations (version) values ('0045_a_rank_is_only_a_rank_within_a_class')
  on conflict (version) do nothing;
