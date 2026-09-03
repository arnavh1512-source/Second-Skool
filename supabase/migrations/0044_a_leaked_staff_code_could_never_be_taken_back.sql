-- ---------------------------------------------------------------------------
-- A leaked staff code could never be taken back.
--
-- The centre has two codes. The student one has been rotatable since 0004: a
-- head who finds it in the wrong hands presses a button and the old one dies.
-- The staff code — the one that lets somebody sign in with Google and ask to
-- become a teacher — has been fixed for the life of the centre since 0001. It
-- travels further than the student code, because it is the one handed around a
-- staff room and forwarded in messages, and it was the one that could not be
-- changed.
--
-- The damage is bounded either way: join_centre files a request as `pending`,
-- so a stranger with the code still cannot see a single student until the head
-- approves them. But a code that keeps arriving in the approvals queue with
-- names nobody recognises is a code that should be retired, and until now the
-- only cure was to delete the centre.
--
-- Rotation costs nobody their access. Staff who have already joined are joined;
-- the code is only ever read at the moment a request is filed. What stops
-- working is the paper it was written on.
-- ---------------------------------------------------------------------------

create or replace function public.regenerate_join_code()
returns text language plpgsql security definer set search_path = public as $$
declare v_centre uuid := public.current_centre(); v_code text;
begin
  if not public.is_head() then raise exception 'Only the head can change the staff code'; end if;
  loop
    -- secure_code, not the gen_random_uuid() substring the original codes were
    -- cut from: a join code is a credential, and 0007 already replaced every
    -- other one in the schema for the same reason.
    v_code := public.secure_code(8);
    -- Unique against both columns. The two codes are read by two different
    -- functions and a collision would let a student form and a staff form
    -- accept the same string.
    exit when not exists (select 1 from public.centres where join_code = v_code)
          and not exists (select 1 from public.centres where student_join_code = v_code);
  end loop;
  update public.centres set join_code = v_code where id = v_centre;
  return v_code;
end; $$;
revoke all on function public.regenerate_join_code() from public, anon;
grant execute on function public.regenerate_join_code() to authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0044_a_leaked_staff_code_could_never_be_taken_back')
  on conflict (version) do nothing;
