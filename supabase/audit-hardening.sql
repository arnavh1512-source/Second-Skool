-- ============================================================================
-- AUDIT HARDENING — Second Skool  (backend production-readiness audit, H1)
-- Replaces Postgres random() with a CRYPTOGRAPHIC RNG (pgcrypto.gen_random_bytes)
-- for every security-sensitive code the app mints:
--   • student login code   TUT-XXXXXXXX  (sole credential for a student's PII)
--   • centre student code   6 chars       (self-registration)
--   • centre teacher code   already used gen_random_uuid() — left unchanged
--
-- random() is a session-seeded PRNG: observing outputs can leak the seed and let
-- an attacker predict future codes. gen_random_bytes() is CSPRNG-backed. The
-- helper below uses rejection sampling so the 31-char alphabet has NO modulo bias.
--
-- Idempotent. Only changes code GENERATION — existing codes keep working.
-- ⚠️ Back up first (Supabase → Database → Backups) before running in production.
-- ============================================================================

create extension if not exists pgcrypto;

-- Unbiased crypto-random code from the confusable-free alphabet ---------------
-- Draws random bytes and rejects any byte >= floor(256/len)*len before taking
-- the modulo, so every character is equally likely (no bias toward the start).
create or replace function public.secure_code(p_len int)
returns text language plpgsql as $$
declare
  v_alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 chars, no O/0/I/1/L
  v_n     constant int  := 31;
  v_cap   constant int  := (256 / v_n) * v_n;  -- 248: largest unbiased byte range
  v_out   text := '';
  v_byte  int;
begin
  while length(v_out) < p_len loop
    v_byte := get_byte(gen_random_bytes(1), 0);
    if v_byte < v_cap then
      v_out := v_out || substr(v_alpha, 1 + (v_byte % v_n), 1);
    end if;
  end loop;
  return v_out;
end; $$;

revoke all on function public.secure_code(int) from public, anon, authenticated;

-- 1) student_signup: crypto student login code -------------------------------
create or replace function public.student_signup(
  p_join_code text, p_name text, p_parent text, p_class text, p_school text, p_address text default null
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_centre uuid; v_cname text; v_code text; v_id uuid;
  v_name text := trim(coalesce(p_name,'')); v_parent text := trim(coalesce(p_parent,''));
  v_class text := trim(coalesce(p_class,'')); v_school text := trim(coalesce(p_school,''));
  v_fails int; v_pending int;
begin
  if length(v_name)   < 2 then raise exception 'Enter your full name'; end if;
  if v_parent !~ '^\+?\d[\d\s\-]{6,}$' then raise exception 'Enter a valid parent phone number'; end if;
  if length(v_class)  < 1 then raise exception 'Select your class'; end if;
  if length(v_school) < 2 then raise exception 'Enter your school name'; end if;

  select id, name into v_centre, v_cname
    from public.centres where student_join_code = upper(trim(coalesce(p_join_code,'')));
  if v_centre is null then
    select count(*) into v_fails from public.code_attempts where at > now() - interval '1 minute';
    if v_fails >= 25 then raise exception 'Too many attempts — please try again in a minute'; end if;
    insert into public.code_attempts default values;
    delete from public.code_attempts where at < now() - interval '5 minutes';
    raise exception 'Invalid student code — check with your teacher';
  end if;

  select count(*) into v_pending from public.students where centre_id = v_centre and status = 'pending';
  if v_pending >= 300 then raise exception 'Too many pending requests — please ask your teacher'; end if;

  loop
    v_code := 'TUT-' || public.secure_code(8);
    exit when not exists (select 1 from public.students where student_code = v_code);
  end loop;

  insert into public.students (name, class, school, parent_contact, address, student_code, fee_status, centre_id, status)
  values (v_name, v_class, v_school, v_parent, nullif(trim(coalesce(p_address,'')),''), v_code, 'Due', v_centre, 'pending')
  returning id into v_id;

  return json_build_object('code', v_code, 'name', v_name, 'centre', v_cname);
end; $$;
revoke all on function public.student_signup(text,text,text,text,text,text) from public;
grant execute on function public.student_signup(text,text,text,text,text,text) to anon, authenticated;

-- 2) create_centre: crypto student code (teacher code stays gen_random_uuid) --
create or replace function public.create_centre(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text; v_scode text;
begin
  if length(coalesce(trim(p_name),'')) < 2 or length(trim(p_name)) > 80 then raise exception 'Enter a centre name (2-80 characters)'; end if;
  if (select centre_id from public.profiles where id=auth.uid()) is not null then raise exception 'You already belong to a centre'; end if;
  loop v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)); exit when not exists (select 1 from public.centres where join_code=v_code); end loop;
  loop
    v_scode := public.secure_code(6);
    exit when not exists (select 1 from public.centres where student_join_code = v_scode)
          and not exists (select 1 from public.centres where join_code = v_scode);
  end loop;
  begin
    insert into public.centres (name, join_code, student_join_code, owner_id)
    values (trim(p_name), v_code, v_scode, auth.uid()) returning id into v_id;
  exception when unique_violation then raise exception 'You already created a centre'; end;
  update public.profiles set role='admin', staff_status='approved', centre_id=v_id, head_requested=false where id=auth.uid();
  return json_build_object('centre_id',v_id,'join_code',v_code,'student_join_code',v_scode,'name',trim(p_name));
end; $$;
revoke all on function public.create_centre(text) from public, anon;
grant execute on function public.create_centre(text) to authenticated;

-- 3) regenerate_student_code: crypto ------------------------------------------
create or replace function public.regenerate_student_code()
returns text language plpgsql security definer set search_path = public as $$
declare v_centre uuid := public.current_centre(); v_code text;
begin
  if not public.is_head() then raise exception 'Only the head can change the student code'; end if;
  loop
    v_code := public.secure_code(6);
    exit when not exists (select 1 from public.centres where student_join_code = v_code)
          and not exists (select 1 from public.centres where join_code = v_code);
  end loop;
  update public.centres set student_join_code = v_code where id = v_centre;
  return v_code;
end; $$;
revoke all on function public.regenerate_student_code() from public, anon;
grant execute on function public.regenerate_student_code() to authenticated;
