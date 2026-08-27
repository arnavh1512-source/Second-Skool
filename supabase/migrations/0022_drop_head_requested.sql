-- ============================================================================
-- 0022 — drop profiles.head_requested
--
-- The column was written `false` in seven places and set `true` in none, in
-- either the app or SQL. It fed StaffMember.headRequested, which chose between
-- two labels on the "Make head teacher" button — and the "Grant head
-- (requested)" half could never render, because no code path ever set the flag.
--
-- There was no teacher-requests-head feature. There was only the shape of one.
-- Rather than build a flow nobody asked for to justify a column, remove both.
--
-- Verified before writing this: 0 of 3 profiles had the flag set, and no
-- policy, index, constraint or view referenced it. The four functions below
-- are the only remaining readers, and each merely wrote the same `false`.
--
-- Recreate them first, then drop the column. Bodies are otherwise byte-for-byte
-- what is live today, including `security definer` and the search_path
-- hardening from 0008 — this migration removes one assignment, nothing else.
-- ============================================================================

create or replace function public.create_centre(p_name text)
returns json language plpgsql security definer set search_path to 'public' as $function$
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
  update public.profiles set role='admin', staff_status='approved', centre_id=v_id where id=auth.uid();
  return json_build_object('centre_id',v_id,'join_code',v_code,'student_join_code',v_scode,'name',trim(p_name));
end; $function$;

create or replace function public.grant_head(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin if not public.is_head() then raise exception 'Not authorized'; end if;
  update public.profiles set role='admin', staff_status='approved' where id=p_id and centre_id=public.current_centre(); end; $function$;

create or replace function public.reject_teacher(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin if not public.is_head() then raise exception 'Not authorized'; end if;
  -- Free the account (clear centre_id) so a declined teacher can join another
  -- centre later instead of being permanently stuck on the "denied" screen.
  update public.profiles set role='student', staff_status='rejected', centre_id=null where id=p_id and centre_id=public.current_centre(); end; $function$;

create or replace function public.remove_staff(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin if not public.is_head() then raise exception 'Not authorized'; end if;
  if p_id = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  update public.profiles set role='student', staff_status='rejected', centre_id=null where id=p_id and centre_id=public.current_centre(); end; $function$;

alter table public.profiles drop column if exists head_requested;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0022_drop_head_requested')
  on conflict (version) do nothing;
