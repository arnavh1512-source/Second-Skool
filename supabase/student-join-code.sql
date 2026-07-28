-- ============================================================================
-- SEPARATE STUDENT JOIN CODE — Second Skool
-- Teachers and students used to share one centre join code. This splits them:
--   • centres.join_code          → teachers (Google sign-in + code)   [unchanged]
--   • centres.student_join_code   → students (self-registration form)  [new]
-- A code entered on the student form now ONLY matches student_join_code, and a
-- code entered on the teacher form ONLY matches join_code — so the two audiences
-- can never use each other's code.
--
-- Idempotent. Existing centres are backfilled with a fresh student code.
-- ⚠️ Back up first (Supabase → Database → Backups) before running in production.
-- ============================================================================

-- 1) New column + unique index ------------------------------------------------
alter table public.centres add column if not exists student_join_code text;

-- Backfill every centre that doesn't have one yet with a unique, human-friendly
-- 6-char code (confusable-free alphabet), distinct from all existing codes.
do $$
declare
  c        record;
  v_code   text;
  v_alpha  constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i        int;
begin
  for c in select id from public.centres where student_join_code is null loop
    loop
      v_code := '';
      for i in 1..6 loop
        v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
      end loop;
      exit when not exists (select 1 from public.centres where student_join_code = v_code)
            and not exists (select 1 from public.centres where join_code = v_code);
    end loop;
    update public.centres set student_join_code = v_code where id = c.id;
  end loop;
end $$;

create unique index if not exists centres_student_join_code_idx on public.centres (student_join_code);

-- 2) student_signup now resolves the centre by the STUDENT code ----------------
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

  -- Resolve the centre from its STUDENT join code; throttle repeated invalid attempts.
  select id, name into v_centre, v_cname
    from public.centres where student_join_code = upper(trim(coalesce(p_join_code, '')));
  if v_centre is null then
    select count(*) into v_fails from public.code_attempts where at > now() - interval '1 minute';
    if v_fails >= 25 then raise exception 'Too many attempts — please try again in a minute'; end if;
    insert into public.code_attempts default values;
    delete from public.code_attempts where at < now() - interval '5 minutes';
    raise exception 'Invalid student code — check with your teacher';
  end if;

  -- Flood guard: cap outstanding pending requests per centre.
  select count(*) into v_pending from public.students where centre_id = v_centre and status = 'pending';
  if v_pending >= 300 then raise exception 'Too many pending requests — please ask your teacher'; end if;

  -- Unique, human-readable login code (TUT- + 8 chars from the confusable-free alphabet).
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

-- 3) my_centre returns both codes so the head can show/copy each --------------
create or replace function public.my_centre()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select json_build_object('name',c.name,'join_code',c.join_code,'student_join_code',c.student_join_code,'logo_url',c.logo_url)
    into v from public.centres c where c.id = public.current_centre();
  return v;
end; $$;

revoke all on function public.my_centre() from public, anon;
grant execute on function public.my_centre() to authenticated;

-- 4) New centres get a student code too ---------------------------------------
create or replace function public.create_centre(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid;
  v_code   text;
  v_scode  text;
  v_alpha  constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i        int;
begin
  if length(coalesce(trim(p_name),'')) < 2 or length(trim(p_name)) > 80 then raise exception 'Enter a centre name (2-80 characters)'; end if;
  if (select centre_id from public.profiles where id=auth.uid()) is not null then raise exception 'You already belong to a centre'; end if;
  loop v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)); exit when not exists (select 1 from public.centres where join_code=v_code); end loop;
  loop
    v_scode := '';
    for i in 1..6 loop v_scode := v_scode || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1); end loop;
    exit when not exists (select 1 from public.centres where student_join_code = v_scode)
          and not exists (select 1 from public.centres where join_code = v_scode);
  end loop;
  begin
    insert into public.centres (name, join_code, student_join_code, owner_id)
    values (trim(p_name), v_code, v_scode, auth.uid()) returning id into v_id;
  exception when unique_violation then
    raise exception 'You already created a centre';
  end;
  update public.profiles set role='admin', staff_status='approved', centre_id=v_id, head_requested=false where id=auth.uid();
  return json_build_object('centre_id',v_id,'join_code',v_code,'student_join_code',v_scode,'name',trim(p_name));
end; $$;

revoke all on function public.create_centre(text) from public, anon;
grant execute on function public.create_centre(text) to authenticated;

-- 5) Let the head rotate the student code if it leaks -------------------------
create or replace function public.regenerate_student_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_centre uuid := public.current_centre();
  v_code   text;
  v_alpha  constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i        int;
begin
  if not public.is_head() then raise exception 'Only the head can change the student code'; end if;
  loop
    v_code := '';
    for i in 1..6 loop v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1); end loop;
    exit when not exists (select 1 from public.centres where student_join_code = v_code)
          and not exists (select 1 from public.centres where join_code = v_code);
  end loop;
  update public.centres set student_join_code = v_code where id = v_centre;
  return v_code;
end; $$;

revoke all on function public.regenerate_student_code() from public, anon;
grant execute on function public.regenerate_student_code() to authenticated;
