-- ============================================================================
-- 0027 — the reporter's name is the server's to write, not the client's
--
-- 0023 gave staff an ordinary RLS insert on support_tickets. The policy checks
-- one thing:
--
--   with check (reporter_profile_id = auth.uid() and reporter_student_id is null)
--
-- It never checks the four denormalised columns beside it. `centre_name`,
-- `reporter_name` and `reporter_role` were being sent from the browser, so any
-- signed-in staff user could file a ticket wearing another person's name, another
-- role, and another centre's name — and the operator console has no join to
-- contradict it, because those columns exist precisely so it does not need one.
-- An inbox where the reporter's identity is whatever the client typed is not an
-- inbox you can act on.
--
-- The student path never had this hole: file_ticket() is security definer and
-- reads the name and centre off the students row. This gives staff the same
-- shape, and then removes the direct insert so the RPC is the only way in.
--
-- Also folded in: `area` is trimmed here, the way the student path already
-- trimmed it, so ' Fees ' and 'Fees' stop being two different areas in the
-- inbox.
-- ============================================================================

create or replace function public.file_staff_ticket(
  p_intent text, p_outcome text, p_area text, p_frequency text,
  p_shot text, p_diag jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles; v_centre public.centres; v_id uuid; v_recent int;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then raise exception 'Sign in again to report a problem'; end if;

  -- Same four checks as file_ticket(), same wording. The table constraints would
  -- catch all of these too, but a constraint violation reaches the user as a
  -- Postgres error string, and the whole point of the four questions is that a
  -- bad answer gets a sentence a person can act on.
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

  -- The same 5-an-hour ceiling students get. A staff session is authenticated,
  -- not trusted: the screenshot column is 400KB and the inbox is one person's.
  select count(*) into v_recent from public.support_tickets
    where reporter_profile_id = v_profile.id and created_at > now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'You have reported several problems already — we will reply soon'; end if;

  select * into v_centre from public.centres where id = v_profile.centre_id;

  -- Every identity column comes off the profile row. Nothing the caller sent
  -- decides who they are.
  insert into public.support_tickets
    (reporter_profile_id, centre_id, centre_name, reporter_name, reporter_role,
     intent, outcome, area, frequency, shot, diagnostics)
  values
    (v_profile.id, v_profile.centre_id, coalesce(v_centre.name,''),
     coalesce(v_profile.full_name,''), v_profile.role,
     trim(p_intent), trim(p_outcome), trim(p_area), p_frequency, p_shot,
     coalesce(p_diag, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.file_staff_ticket(text,text,text,text,text,jsonb) from public, anon;
grant execute on function public.file_staff_ticket(text,text,text,text,text,jsonb) to authenticated;

-- The direct insert is what made the spoof possible, so it goes. Reading,
-- and replying on your own thread, are unchanged — neither carries a
-- denormalised identity column.
drop policy if exists support_tickets_own_insert on public.support_tickets;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0027_ticket_identity')
  on conflict (version) do nothing;
