-- ============================================================================
-- CLOSE THE UNTHROTTLED DOOR — Second Skool
--
-- Two anon-callable functions take a student code. One counts failures and
-- refuses after 25 a minute. The other counts nothing. Guess which one an
-- attacker uses.
--
-- Found by auditing every function in `public` for who can execute it:
--   select proname, has_function_privilege('anon', oid, 'execute') ...
-- Six came back anon-callable. Four are meant to be. Two are not.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. get_student_notes() has no rate limit, and that makes the one on
--    get_student_snapshot() decorative.
--
-- A student code is 6 characters from a 31-character alphabet — 887,503,681
-- possibilities. Against get_student_snapshot() that is unbreakable: 25 misses
-- a minute is 36,000 a day, so finding one code among 200 students takes
-- roughly 120 years and the head sees a wall of failed attempts long before.
--
-- Against get_student_notes() there is no counter at all. The attacker is not
-- hunting one specific code, they are hunting *any* valid one, so the keyspace
-- divides by the number of students enrolled: 887M / 200 ≈ 4.4M expected tries,
-- which at 100 requests a second is about twelve hours of a laptop and a for
-- loop. It gets faster with every centre that signs up, because every new
-- student makes the keyspace denser.
--
-- And a hit is not just the study material. It confirms a live code, which the
-- attacker then hands to get_student_snapshot() — name, parent's phone number,
-- home address, fee status, attendance, every test result. The throttled door
-- opens fine once you already know the code; the whole point of the throttle
-- was that you should not be able to find one.
--
-- Same sliding window, same numbers, same table as get_student_snapshot(), so
-- the two doors now share one budget rather than one guarding and one waving
-- traffic through.
--
-- While here: a pending student — signed up, not yet approved by the head —
-- was being served the class's notes. get_student_snapshot() already refuses
-- them everything but their own name. Study material is centre property and
-- approval is what grants it, so this now matches.
-- ---------------------------------------------------------------------------
create or replace function public.get_student_notes(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_fails int;
begin
  if length(coalesce(p_code,'')) < 4 then return '[]'::json; end if;

  select * into v_student from public.students where student_code = p_code;

  -- Invalid code: sliding-window throttle (valid codes skip this entirely).
  if v_student.id is null then
    select count(*) into v_fails from public.code_attempts where at > now() - interval '1 minute';
    if v_fails >= 25 then raise exception 'Too many attempts — please try again in a minute'; end if;
    insert into public.code_attempts default values;
    delete from public.code_attempts where at < now() - interval '5 minutes';
    return '[]'::json;
  end if;

  -- Real code, but not approved yet (or declined). No throttle — the code is
  -- genuine — and no material either.
  if v_student.status <> 'approved' then return '[]'::json; end if;

  return coalesce((select json_agg(json_build_object('title',n.title,'subject',n.subject,'body',n.body,'fileUrl',n.file_url,'linkUrl',n.link_url,'date',n.created_at) order by n.created_at desc)
    from public.notes n where n.class=v_student.class and n.centre_id=v_student.centre_id),'[]'::json);
end; $$;

-- create or replace keeps existing grants, but restate them so an environment
-- built from these files lands in the same place.
revoke all on function public.get_student_notes(text) from public;
grant execute on function public.get_student_notes(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Two trigger functions are published as REST endpoints.
--
-- 0016_data_integrity.sql added assert_marks_within_max() and
-- assert_max_marks_not_below_results() as SECURITY DEFINER trigger functions
-- and never revoked EXECUTE, so both inherited the default grant to PUBLIC and
-- PostgREST duly exposed them at /rest/v1/rpc/. Anyone on the internet can POST
-- to them without signing in.
--
-- Calling one raises "trigger functions can only be called as triggers", so
-- nothing is exploitable today — this is about surface, not a live hole. But a
-- SECURITY DEFINER function reachable by `anon` is exactly the thing that
-- becomes a hole the day somebody edits it without remembering who can reach
-- it. handle_new_user() and set_updated_at() from the baseline were revoked
-- properly; these two were the omission.
-- ---------------------------------------------------------------------------
revoke all on function public.assert_marks_within_max() from public, anon, authenticated;
revoke all on function public.assert_max_marks_not_below_results() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0019_notes_code_throttle')
  on conflict (version) do nothing;
