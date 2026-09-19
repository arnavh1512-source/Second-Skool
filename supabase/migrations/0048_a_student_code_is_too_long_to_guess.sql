-- ---------------------------------------------------------------------------
-- 0048 — a student code is too long to guess, and a centre row is only for
--        the staff who run it
--
-- Findings from the AI-generated-code security audit (Sep 2026):
--
-- M1  student_signup() is anonymous. It checked minimum lengths only, so one
--     call could store a megabyte-long "name" in a pending row the head then
--     has to render. It now rejects anything longer than the limits the app
--     already clamps to (app/store/validate.ts LIMITS), so a real signup never
--     sees the new errors.
--
--     The student join code was 6 characters from a 31-letter alphabet
--     (~887 million codes). The guard allows 60 misses a minute per network
--     block, and with many blocks and many centres that is a real chance of
--     landing in someone's centre as a pending student. New and regenerated
--     codes are 8 characters (~852 billion). Codes already handed out keep
--     working; a head who wants the longer one taps "regenerate".
--
--     An IPv6 customer is usually handed a /48 or /56, not a single /64, so a
--     /64 bucket let one household rotate through 65,536 buckets. IPv6 is now
--     bucketed per /48. IPv4 stays at /24.
--
-- L2  centres_read let a PENDING teacher read the centre row directly. The app
--     only ever reads it through my_centre(); the policy now requires approved
--     staff, and my_centre() hands the join codes only to approved staff.
--
-- L3  notes.file_url had no shape check, unlike link_url. It is rendered as a
--     link, so a hand-crafted insert could store a javascript: URL. It must now
--     be an https URL into the public notes bucket. NOT VALID: existing rows
--     are not rechecked, every new or edited row is.
--
-- L4  centres_write matched on owner_id alone. It now also requires the row to
--     be the caller's current centre.
-- ---------------------------------------------------------------------------

-- 1. code_attempt_guard() — IPv6 per /48.
create or replace function public.code_attempt_guard()
returns void language plpgsql security definer set search_path = public as $$
declare v_ip text; v_net text; v_recent int;
begin
  v_ip := public.client_ip();
  begin
    v_net := network(set_masklen(v_ip::inet, case when family(v_ip::inet) = 4 then 24 else 48 end))::text;
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

-- 2. student_signup() — upper bounds. A wrong join code still returns, never
--    raises, so the guard's record of the miss survives (see 0046).
create or replace function public.student_signup(
  p_join_code text, p_name text, p_parent text, p_class text, p_school text, p_address text default null
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_centre uuid; v_cname text; v_code text;
  v_name text := trim(coalesce(p_name,'')); v_parent text := trim(coalesce(p_parent,''));
  v_class text := trim(coalesce(p_class,'')); v_school text := trim(coalesce(p_school,''));
  v_address text := nullif(trim(coalesce(p_address,'')),'');
  v_pending int;
begin
  if length(v_name) < 2 or length(v_name) > 80 then raise exception 'Enter your full name'; end if;
  if length(v_parent) > 20 or v_parent !~ '^\+?\d[\d\s\-]{6,}$' then raise exception 'Enter a valid parent phone number'; end if;
  if length(v_class) < 1 or length(v_class) > 40 then raise exception 'Select your class'; end if;
  if length(v_school) < 2 or length(v_school) > 120 then raise exception 'Enter your school name'; end if;
  if length(coalesce(v_address,'')) > 200 then raise exception 'Address is too long'; end if;
  if length(coalesce(p_join_code,'')) > 20 then return json_build_object('error', 'invalid_join_code'); end if;
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
  values (v_name, v_class, v_school, v_parent, v_address, v_code, 'Due', v_centre, 'pending');
  return json_build_object('code', v_code, 'name', v_name, 'centre', v_cname);
end; $$;
revoke all on function public.student_signup(text,text,text,text,text,text) from public;
grant execute on function public.student_signup(text,text,text,text,text,text) to anon, authenticated;

-- 3. 8-character student join codes for new centres and regenerated codes.
create or replace function public.create_centre(p_name text)
returns json language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid; v_code text; v_scode text;
begin
  if length(coalesce(trim(p_name),'')) < 2 or length(trim(p_name)) > 80 then raise exception 'Enter a centre name (2-80 characters)'; end if;
  if (select centre_id from public.profiles where id=auth.uid()) is not null then raise exception 'You already belong to a centre'; end if;
  loop v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)); exit when not exists (select 1 from public.centres where join_code=v_code); end loop;
  loop
    v_scode := public.secure_code(8);
    exit when not exists (select 1 from public.centres where student_join_code = v_scode)
          and not exists (select 1 from public.centres where join_code = v_scode);
  end loop;
  begin
    insert into public.centres (name, join_code, student_join_code, owner_id)
    values (trim(p_name), v_code, v_scode, auth.uid()) returning id into v_id;
  exception when unique_violation then raise exception 'You already created a centre'; end;
  update public.profiles set role='admin', staff_status='approved', centre_id=v_id where id=auth.uid();
  return json_build_object('centre_id',v_id,'join_code',v_code,'student_join_code',v_scode,'name',trim(p_name));
end; $function$;

create or replace function public.regenerate_student_code()
returns text language plpgsql security definer set search_path = public as $$
declare v_centre uuid := public.current_centre(); v_code text;
begin
  if not public.is_head() then raise exception 'Only the head can change the student code'; end if;
  loop
    v_code := public.secure_code(8);
    exit when not exists (select 1 from public.centres where student_join_code = v_code)
          and not exists (select 1 from public.centres where join_code = v_code);
  end loop;
  update public.centres set student_join_code = v_code where id = v_centre;
  return v_code;
end; $$;
revoke all on function public.regenerate_student_code() from public, anon;
grant execute on function public.regenerate_student_code() to authenticated;

-- 4. my_centre() — the name and logo for anyone in the centre, the join codes
--    only for approved staff.
create or replace function public.my_centre()
returns json language plpgsql security definer set search_path = public as $$
declare v json; v_staff boolean := public.is_staff();
begin
  select json_build_object(
           'name', c.name, 'logo_url', c.logo_url,
           'join_code', case when v_staff then c.join_code end,
           'student_join_code', case when v_staff then c.student_join_code end)
    into v from public.centres c where c.id = public.current_centre();
  return v;
end; $$;
revoke all on function public.my_centre() from public, anon;
grant execute on function public.my_centre() to authenticated;

-- 5. centres policies.
drop policy if exists centres_read on public.centres;
create policy centres_read on public.centres for select to authenticated
  using (id = public.current_centre() and public.is_staff());

drop policy if exists centres_write on public.centres;
create policy centres_write on public.centres for update to authenticated
  using (owner_id = (select auth.uid()) and id = public.current_centre())
  with check (owner_id = (select auth.uid()) and id = public.current_centre());

-- 6. notes.file_url must point into the public notes bucket.
alter table public.notes drop constraint if exists notes_file_url_bucket;
alter table public.notes add constraint notes_file_url_bucket
  check (file_url is null or file_url ~ '^https://[^/\s]+/storage/v1/object/public/notes/[^\s]+$') not valid;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0048_a_student_code_is_too_long_to_guess')
  on conflict (version) do nothing;
