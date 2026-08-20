-- ============================================================================
-- PUSH SUBSCRIPTION OWNERSHIP — Second Skool
--
-- save_push_subscription() accepted `p_ref` on trust. It is SECURITY DEFINER
-- and granted to anon, so anyone who could reach the REST endpoint could
-- register THEIR OWN device against SOMEONE ELSE'S ref:
--
--   kind='profile' + a head teacher's profile UUID
--     → the attacker's phone starts receiving that head's notifications
--       (join requests, student names, fee notices). Profile UUIDs are not
--       secret within a centre — every teacher on the staff list has them —
--       so a pending or removed teacher could keep reading the head's alerts
--       indefinitely, with no signed-in session required at all.
--
--   kind='student' + another student's code
--     → the attacker's phone receives that student's reminders.
--
-- The sender (/api/push) is correctly centre-scoped, so this was never a
-- cross-centre leak — but within a centre it is a straightforward
-- notification-hijack, and it needed no privileges whatsoever.
--
-- Fix: the RPC now proves the caller owns the ref before storing it.
--   profile → must be the signed-in user's own id (auth.uid()).
--   student → the code must exist; knowing the code IS being that student,
--             which is the same trust model as get_student_snapshot.
-- It also populates centre_id, which the original insert left permanently
-- null, so the column is finally usable for scoping and cleanup.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_kind text, p_ref text
) returns void language plpgsql security definer set search_path = public as $$
declare v_centre uuid; v_ref text := trim(coalesce(p_ref, ''));
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
    -- Student device, identified by the login code. Unknown codes are rejected
    -- rather than stored: a typo used to create a permanently dead row that
    -- every future send would count and never deliver.
    select centre_id into v_centre from public.students where student_code = v_ref;
    if v_centre is null then raise exception 'Invalid code'; end if;
  end if;

  insert into public.push_subscriptions (endpoint, p256dh, auth, kind, ref, centre_id)
  values (p_endpoint, p_p256dh, p_auth, p_kind, v_ref, v_centre)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth,
        kind = excluded.kind, ref = excluded.ref,
        centre_id = excluded.centre_id, updated_at = now();
end; $$;

revoke all on function public.save_push_subscription(text,text,text,text,text) from public;
grant execute on function public.save_push_subscription(text,text,text,text,text) to anon, authenticated;

-- Back-fill centre_id on rows written before the fix, and drop any row whose
-- ref no longer resolves — those are undeliverable and only inflate the
-- "sent to N devices" count.
update public.push_subscriptions s
   set centre_id = p.centre_id
  from public.profiles p
 where s.kind = 'profile' and s.ref = p.id::text and s.centre_id is distinct from p.centre_id;

update public.push_subscriptions s
   set centre_id = st.centre_id
  from public.students st
 where s.kind = 'student' and s.ref = st.student_code and s.centre_id is distinct from st.centre_id;

delete from public.push_subscriptions s
 where (s.kind = 'profile' and not exists (select 1 from public.profiles p where p.id::text = s.ref))
    or (s.kind = 'student' and not exists (select 1 from public.students st where st.student_code = s.ref));

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0011_push_subscription_ownership')
  on conflict (version) do nothing;
