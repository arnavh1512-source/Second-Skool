-- ============================================================================
-- THE CODE BECOMES A VOUCHER — Second Skool
--
-- A student's login code is the whole of their security today. It sits in
-- localStorage, it is sent as p_code to every student RPC, and whoever holds it
-- reads the child's attendance, marks, fees, address and parent's phone number.
-- That is a bearer password with three properties no password should have:
--
--   * it is short and shaped, so it is guessable in a way a password is not,
--     which is why code_attempt_guard() exists at all;
--   * it never changes, so a household that shared it once has shared it for
--     as long as the child is at the centre;
--   * it is designed to be passed around — the head reads it out, it goes into
--     a WhatsApp group, it is written on a fee receipt. Every copy is a key.
--
-- The fix is to stop letting the code BE the credential and let it MINT one.
-- claim_student_device() takes the code once, mints 32 bytes from the CSPRNG,
-- stores only the SHA-256 of it, and hands the plaintext back to that phone.
-- From then on that phone sends the token and the code opens nothing.
--
-- Two properties make this safe to ship into a live app with no flag day:
--
--   1. The first device claims itself. A household typing the code on the
--     phone they already use sees exactly what they see today — no approval,
--     no waiting, no extra step for anybody, and no new data for a teacher to
--     enter. A SECOND device on the same code lands unapproved and shows up in
--     the head's list to allow or refuse. So the leak that matters — a code
--     travelling to someone who is not the parent — is the case that now stops.
--
--   2. The raw code still resolves, but ONLY while the student has no live
--     device. That is the compatibility window, and it closes by itself the
--     moment a household opens the app once: their phone claims, a device
--     exists, and the code stops being a credential for that child forever.
--     Nobody is logged out, and nothing has to be migrated.
--
-- Every student RPC keeps its p_code parameter. What changes is the one line
-- that turned it into a student — that line is now student_for_credential(),
-- which accepts either a token or a code and applies the rule above. Three of
-- the six (file_ticket, my_tickets, reply_ticket) already went through
-- support_student(), so rewriting support_student() covers them for free.
--
-- Revocation and approval are ordinary rows: the head's screen writes to
-- student_devices through RLS, exactly as it writes to students. No function
-- is needed for either, so none is defined.
--
-- Note the search_path on the new functions: pgcrypto lives in the extensions
-- schema on Supabase, not public, so digest() and gen_random_bytes() only
-- resolve if extensions is on the path. 0008 exists because of that.
--
-- Run this in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The devices themselves.
--
-- Only the hash is stored. A dump of this table is not a set of logins, and
-- neither is a backup of it, which is the entire point of the change.
-- ---------------------------------------------------------------------------
create table if not exists public.student_devices (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null,
  -- Denormalised so RLS can scope by centre without a join, and so the
  -- composite key below can refuse a row that names a child at another centre.
  centre_id    uuid not null,
  token_hash   text not null unique,
  -- Shown to the head so "allow this one, refuse that one" is a decision about
  -- something recognisable rather than about a uuid. Whatever the browser can
  -- say about itself; never trusted for anything.
  label        text,
  -- False means the head has not allowed this device yet: it was not the first
  -- one on this code. It can claim nothing until somebody at the centre says so.
  approved     boolean not null default false,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  -- Set instead of deleting, so a revoked device stays visible in the list as
  -- a thing that once had access rather than vanishing from the history.
  revoked_at   timestamptz,
  constraint student_devices_student_centre_fk
    foreign key (student_id, centre_id)
    references public.students (id, centre_id) on delete cascade
);

-- Not partial on revoked_at: the resolver asks whether a student has *ever*
-- had a device, revoked ones included, so a partial index would not serve it.
create index if not exists student_devices_student_idx
  on public.student_devices (student_id);
create index if not exists student_devices_centre_idx
  on public.student_devices (centre_id);

alter table public.student_devices enable row level security;

drop policy if exists student_devices_staff on public.student_devices;
create policy student_devices_staff on public.student_devices for all to authenticated
  using      (public.is_staff() and centre_id = public.current_centre())
  with check (public.is_staff() and centre_id = public.current_centre());

-- anon reaches this table only through the functions below, which run as owner.
revoke all on public.student_devices from anon;

-- ---------------------------------------------------------------------------
-- 2. Turning a credential into a student.
--
-- Internal only: every caller is a SECURITY DEFINER function that already runs
-- as the owner, so nothing needs execute on it and nobody gets it. The sweep in
-- tests/rls/rpc-authorization.test.ts fails the build if that slips.
-- ---------------------------------------------------------------------------
create or replace function public.student_for_credential(p_cred text)
returns public.students
language plpgsql security definer set search_path = public, extensions as $$
declare v_student public.students; v_hash text;
begin
  if length(coalesce(p_cred,'')) < 4 then return null; end if;

  v_hash := encode(digest(p_cred, 'sha256'), 'hex');

  select s.* into v_student
    from public.student_devices d
    join public.students s on s.id = d.student_id
   where d.token_hash = v_hash and d.revoked_at is null and d.approved;

  if v_student.id is not null then
    -- Cheap enough to be worth having: the head's list can say "last used
    -- yesterday", which is what makes an unrecognised device recognisable as
    -- one. Stamped at most hourly so a screen refresh is not a write.
    update public.student_devices set last_seen_at = now()
     where token_hash = v_hash
       and (last_seen_at is null or last_seen_at < now() - interval '1 hour');
    return v_student;
  end if;

  -- The compatibility window. A raw code is still a credential, but only for a
  -- child whose household has not yet opened the app on any phone. One claim
  -- closes it, permanently, for that child — revoking the phone does not open
  -- it again, or removing a leaked device would hand the leaked code its power
  -- straight back.
  select s.* into v_student from public.students s
   where s.student_code = p_cred
     and not exists (select 1 from public.student_devices d where d.student_id = s.id);

  return v_student;
end $$;

revoke all on function public.student_for_credential(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Spending the voucher.
--
-- The one place the raw code is still the input. Called once per phone, by an
-- anonymous caller, because a student has no session and never will.
-- ---------------------------------------------------------------------------
create or replace function public.claim_student_device(p_code text, p_label text default null)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_student public.students; v_token text; v_live int; v_approved boolean;
begin
  if length(coalesce(p_code,'')) < 4 then raise exception 'Not found'; end if;

  select * into v_student from public.students where student_code = p_code;
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
-- 4. support_student() — reproduced from 0032 with the lookup replaced. This
--    is what file_ticket(), my_tickets() and reply_ticket() resolve through,
--    so all three accept a device token from here without being touched.
-- ---------------------------------------------------------------------------
create or replace function public.support_student(p_code text)
returns public.students language plpgsql security definer set search_path = public as $$
declare v_student public.students;
begin
  if length(coalesce(p_code,'')) < 4 then raise exception 'Not found'; end if;
  v_student := public.student_for_credential(p_code);
  if v_student.id is null then
    perform public.code_attempt_guard();
    raise exception 'Not found';
  end if;
  -- A pending student has not been approved by the head. They can still report
  -- a problem - being stuck on the waiting screen is a legitimate thing to
  -- report - so status is deliberately not checked here.
  return v_student;
end $$;

-- ---------------------------------------------------------------------------
-- 5. get_student_notes() — reproduced from 0032, same one-line change.
-- ---------------------------------------------------------------------------
create or replace function public.get_student_notes(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students;
begin
  if length(coalesce(p_code,'')) < 4 then return '[]'::json; end if;

  v_student := public.student_for_credential(p_code);

  if v_student.id is null then
    perform public.code_attempt_guard();
    return '[]'::json;
  end if;

  -- Real code, but not approved yet (or declined). No throttle - the code is
  -- genuine - and no material either.
  if v_student.status <> 'approved' then return '[]'::json; end if;

  return coalesce((select json_agg(json_build_object('title',n.title,'subject',n.subject,'body',n.body,'fileUrl',n.file_url,'linkUrl',n.link_url,'date',n.created_at) order by n.created_at desc)
    from public.notes n where n.class=v_student.class and n.centre_id=v_student.centre_id),'[]'::json);
end; $$;

-- ---------------------------------------------------------------------------
-- 6. save_push_subscription() — reproduced from 0011. The student branch used
--    to look the code up itself; it now resolves the same way as everything
--    else, so a phone that has claimed a token registers for pushes with that
--    token rather than being the last place the raw code still worked.
--
--    The stored ref is normalised to the student_code, because that is what
--    /api/push/route.ts matches subscriptions on. A token in that column would
--    be a device that never receives anything.
-- ---------------------------------------------------------------------------
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_kind text, p_ref text
) returns void language plpgsql security definer set search_path = public as $$
declare v_centre uuid; v_student public.students; v_ref text := trim(coalesce(p_ref, ''));
begin
  if p_kind not in ('profile','student') then raise exception 'bad kind'; end if;
  if length(coalesce(p_endpoint,'')) < 10 then raise exception 'bad endpoint'; end if;
  if length(coalesce(p_p256dh,'')) < 10 or length(coalesce(p_auth,'')) < 8 then
    raise exception 'bad keys';
  end if;
  if v_ref = '' then raise exception 'bad ref'; end if;

  if p_kind = 'profile' then
    -- Staff device. Only ever your own row: auth.uid() cannot be forged, so
    -- there is no ref to guess. An anonymous caller has no uid and is refused.
    if auth.uid() is null or v_ref <> auth.uid()::text then
      raise exception 'Not authorized';
    end if;
    select centre_id into v_centre from public.profiles where id = auth.uid();
  else
    -- Student device. Unknown credentials are rejected rather than stored: a
    -- typo used to create a permanently dead row that every future send would
    -- count and never deliver.
    v_student := public.student_for_credential(v_ref);
    if v_student.id is null then raise exception 'Invalid code'; end if;
    v_centre := v_student.centre_id;
    v_ref := v_student.student_code;
  end if;

  insert into public.push_subscriptions (endpoint, p256dh, auth, kind, ref, centre_id)
  values (p_endpoint, p_p256dh, p_auth, p_kind, v_ref, v_centre)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth,
        kind = excluded.kind, ref = excluded.ref,
        centre_id = excluded.centre_id, updated_at = now();
end; $$;

-- ---------------------------------------------------------------------------
-- 7. get_student_snapshot() — reproduced from 0032. One line differs: the
--    lookup. It is reproduced whole because Postgres has no way to replace a
--    single statement inside a function body.
-- ---------------------------------------------------------------------------
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
insert into public.schema_migrations (version) values ('0040_the_code_becomes_a_voucher')
  on conflict (version) do nothing;
