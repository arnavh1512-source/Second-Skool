-- ============================================================================
-- A WRONG GUESS IS COUNTED EVEN WHEN IT FAILS — Second Skool
--
-- 1. The throttle never counted anything.
--
-- Every code-guessing path does the same two steps on a miss:
--
--   perform public.code_attempt_guard();   -- inserts a row into code_attempts
--   raise exception 'Not found';           -- ...and rolls that insert back
--
-- A raise aborts the whole statement, and a PostgREST call is one statement,
-- so the row the guard just wrote is undone by the very error that follows it.
-- code_attempts only ever held rows from calls that did not raise. Five of the
-- guard's callers already return a sentinel instead of raising, and those were
-- throttled; the other five — support_student (and through it file_ticket,
-- my_tickets, reply_ticket), claim_student_device and student_signup — were
-- not throttled at all, however many wrong codes arrived.
--
-- The fix is the rule the working callers already follow: after the guard,
-- RETURN, never raise. Each function below says "not found" with its return
-- value instead of an exception:
--
--   support_student       -> a students row with a null id
--   file_ticket           -> null
--   reply_ticket          -> false  (was void, so the function is recreated)
--   claim_student_device  -> {"error": "not_found"}
--   student_signup        -> {"error": "invalid_join_code"}
--
-- The guard itself still raises when the limit is hit. That is correct: over
-- the limit nothing is inserted, so there is nothing to lose.
--
-- 2. One global cap could shut every centre out at once.
--
-- The guard also refused all anonymous guesses once 600 had arrived from
-- anywhere in the last minute. That line is what a single attacker spraying
-- from rotating addresses would hit first, and when they hit it, every parent
-- in the country mistyping a code was refused with them. A limit meant to stop
-- one caller should not be one every caller shares.
--
-- It is replaced by a limit per network block: 60 misses a minute from one
-- IPv4 /24 or one IPv6 /64. Rotating addresses inside a block no longer buys a
-- fresh bucket, and a block that misbehaves shuts only itself out. A school on
-- one NAT address shares a bucket, which is why it is 60 and not 25: only
-- WRONG codes count, and sixty children mistyping in the same minute is not a
-- thing that happens. A student code is eight characters from a 31-letter
-- alphabet; at 60 a minute from every /24 an attacker could rent, guessing one
-- is still out of reach.
--
-- The block is stored in the existing ip column, so the (ip, at) index keeps
-- serving the count. A request with no readable address stays in its own
-- 'unknown' bucket, as before.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. code_attempt_guard() — per network block, no global cap.
-- ---------------------------------------------------------------------------
create or replace function public.code_attempt_guard()
returns void language plpgsql security definer set search_path = public as $$
declare v_ip text; v_net text; v_recent int;
begin
  v_ip := public.client_ip();
  begin
    v_net := network(set_masklen(v_ip::inet, case when family(v_ip::inet) = 4 then 24 else 64 end))::text;
  exception when others then
    -- 'unknown', or anything else that is not an address, is its own bucket.
    v_net := v_ip;
  end;
  select count(*) into v_recent from public.code_attempts
   where ip = v_net and at > now() - interval '1 minute';
  if v_recent >= 60 then raise exception 'Too many attempts — please try again in a minute'; end if;
  insert into public.code_attempts (ip) values (v_net);
  delete from public.code_attempts where at < now() - interval '5 minutes' and user_id is null;
end; $$;
revoke all on function public.code_attempt_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. support_student() — reproduced from 0040; a miss returns an empty row.
-- ---------------------------------------------------------------------------
create or replace function public.support_student(p_code text)
returns public.students language plpgsql security definer set search_path = public as $$
declare v_student public.students;
begin
  if length(coalesce(p_code,'')) < 4 then return v_student; end if;
  v_student := public.student_for_credential(p_code);
  if v_student.id is null then
    perform public.code_attempt_guard();
  end if;
  -- A pending student has not been approved by the head. They can still report
  -- a problem - being stuck on the waiting screen is a legitimate thing to
  -- report - so status is deliberately not checked here.
  return v_student;
end $$;
revoke all on function public.support_student(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. file_ticket() — reproduced from 0023; an unknown code returns null.
-- ---------------------------------------------------------------------------
create or replace function public.file_ticket(
  p_code text, p_intent text, p_outcome text, p_area text, p_frequency text,
  p_shot text, p_diag jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_centre public.centres; v_id uuid; v_recent int;
begin
  v_student := public.support_student(p_code);
  if v_student.id is null then return null; end if;
  if length(coalesce(trim(p_intent),'')) < 3 or length(trim(p_intent)) > 120
    then raise exception 'Tell us what you were trying to do'; end if;
  if length(coalesce(trim(p_outcome),'')) < 3 or length(trim(p_outcome)) > 1000
    then raise exception 'Tell us what happened instead'; end if;
  if p_frequency is null or p_frequency not in ('always','sometimes','first')
    then raise exception 'Tell us how often it happens'; end if;
  if length(coalesce(trim(p_area),'')) < 1 or length(trim(p_area)) > 40
    then raise exception 'Choose which part of the app'; end if;
  if p_shot is not null and (p_shot not like 'data:image/jpeg;base64,%' or length(p_shot) > 400000)
    then raise exception 'That screenshot could not be attached'; end if;
  -- A valid code is still not a licence to flood the inbox.
  select count(*) into v_recent from public.support_tickets
    where reporter_student_id = v_student.id and created_at > now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'You have reported several problems already — we will reply soon'; end if;
  select * into v_centre from public.centres where id = v_student.centre_id;
  insert into public.support_tickets
    (reporter_student_id, centre_id, centre_name, reporter_name, reporter_role,
     intent, outcome, area, frequency, shot, diagnostics)
  values
    (v_student.id, v_student.centre_id, coalesce(v_centre.name,''), v_student.name, 'student',
     trim(p_intent), trim(p_outcome), trim(p_area), p_frequency, p_shot,
     coalesce(p_diag, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 4. reply_ticket() — reproduced from 0023, now returns whether the code was
--    known. The return type changes, so it has to be dropped and re-granted.
-- ---------------------------------------------------------------------------
drop function public.reply_ticket(text, uuid, text);
create function public.reply_ticket(p_code text, p_ticket uuid, p_body text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_recent int;
begin
  v_student := public.support_student(p_code);
  if v_student.id is null then return false; end if;
  if length(coalesce(trim(p_body),'')) < 1 or length(trim(p_body)) > 4000
    then raise exception 'Type a message first'; end if;
  if not exists (select 1 from public.support_tickets
                 where id = p_ticket and reporter_student_id = v_student.id)
    then raise exception 'Not found'; end if;
  select count(*) into v_recent from public.support_messages m
    join public.support_tickets t on t.id = m.ticket_id
   where t.reporter_student_id = v_student.id and m.author = 'reporter'
     and m.created_at > now() - interval '1 hour';
  if v_recent >= 20 then raise exception 'Too many messages — please try again in a minute'; end if;
  insert into public.support_messages (ticket_id, author, body) values (p_ticket, 'reporter', trim(p_body));
  -- Replying to a report you had been told was fixed reopens it.
  update public.support_tickets set status = 'open' where id = p_ticket and status = 'resolved';
  return true;
end $$;
revoke all on function public.reply_ticket(text, uuid, text) from public;
grant execute on function public.reply_ticket(text, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. claim_student_device() — reproduced from 0041; a miss returns an error
--    object. The short-code check stays a raise: it never reaches the guard.
-- ---------------------------------------------------------------------------
create or replace function public.claim_student_device(p_code text, p_label text default null)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_student public.students; v_token text; v_live int; v_approved boolean;
begin
  if length(coalesce(p_code,'')) < 4 then raise exception 'Not found'; end if;
  select * into v_student from public.students where student_code = p_code for update;
  if v_student.id is null then
    perform public.code_attempt_guard();
    return json_build_object('error', 'not_found');
  end if;
  select count(*) into v_live from public.student_devices where student_id = v_student.id and revoked_at is null;
  if v_live >= 10 then raise exception 'Too many devices are already using this code'; end if;
  select not exists (select 1 from public.student_devices where student_id = v_student.id) into v_approved;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.student_devices (student_id, centre_id, token_hash, label, approved)
  values (v_student.id, v_student.centre_id, encode(digest(v_token, 'sha256'), 'hex'),
          nullif(left(trim(coalesce(p_label, '')), 60), ''), v_approved);
  return json_build_object('token', v_token, 'approved', v_approved);
end $$;
revoke all on function public.claim_student_device(text, text) from public;
grant execute on function public.claim_student_device(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. student_signup() — reproduced from 0032; a wrong join code returns an
--    error object.
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
    return json_build_object('error', 'invalid_join_code');
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
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0046_a_wrong_guess_is_counted_even_when_it_fails')
  on conflict (version) do nothing;
