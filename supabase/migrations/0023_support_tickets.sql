-- ============================================================================
-- 0023 — in-app support tickets
--
-- Any user reports a problem by answering four questions, and the operator
-- answers it from the developer console. Two audiences, two completely
-- different access models, because students are not authenticated users:
--
--   staff    — real auth.uid(), so ordinary RLS on their own rows.
--   students — no session at all. Identity is a student_code in localStorage,
--              so filing goes through anon security-definer RPCs, throttled on
--              the same sliding window that guards get_student_snapshot().
--
-- The operator reads everything with the service role through /api/dev. No
-- policy grants a cross-centre read to anyone holding a normal session, and
-- since e69b2f7 there is no way for support to open a centre at all — which is
-- why the answers and the screenshot have to carry the whole report.
-- ============================================================================

create table if not exists public.support_tickets (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Exactly one of these identifies the reporter. Staff have a profile;
  -- students have a row in students and no profile of their own.
  reporter_profile_id uuid references public.profiles(id) on delete set null,
  reporter_student_id uuid references public.students(id) on delete set null,

  -- Denormalised so the operator can read a ticket without a join, and so it
  -- survives the reporter's account being deleted. Staff let the default fill
  -- centre_id, exactly as students does; the student RPC passes it explicitly
  -- because there is no session for current_centre() to read.
  centre_id           uuid references public.centres(id) on delete set null default public.current_centre(),
  centre_name         text not null default '',
  reporter_name       text not null default '',
  reporter_role       text not null default '',

  -- The four answers. `intent` is also the inbox title, which is why there is
  -- no subject column: asking someone to write a headline *and* describe the
  -- problem gets you two vague sentences instead of one useful one.
  intent              text not null,
  outcome             text not null,
  area                text not null,
  frequency           text not null,

  -- Auto-captured: build sha, viewport, user agent, last uncaught error.
  diagnostics         jsonb not null default '{}'::jsonb,

  -- An optional screenshot as a downscaled JPEG data URL, the same way centre
  -- logos are stored. It is capped hard because it is *someone's students* on
  -- that screen, and it is set to null the moment the ticket is resolved.
  shot                text,

  status              text not null default 'open',

  constraint support_tickets_one_reporter check (
    (reporter_profile_id is not null) <> (reporter_student_id is not null)
  ),
  constraint support_tickets_status_valid    check (status in ('open','resolved')),
  constraint support_tickets_frequency_valid check (frequency in ('always','sometimes','first')),
  constraint support_tickets_area_len        check (length(area) between 1 and 40),
  constraint support_tickets_intent_len      check (length(intent) between 3 and 120),
  constraint support_tickets_outcome_len     check (length(outcome) between 3 and 1000),
  constraint support_tickets_shot_shape      check (
    shot is null or (shot like 'data:image/jpeg;base64,%' and length(shot) <= 400000)
  )
);

create table if not exists public.support_messages (
  id          uuid primary key default uuid_generate_v4(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- 'reporter' or 'operator'. Not a profile reference: the operator replies
  -- with the service role, and a deleted reporter must not erase the thread.
  author      text not null,
  body        text not null,
  constraint support_messages_author_valid check (author in ('reporter','operator')),
  constraint support_messages_body_len     check (length(body) between 1 and 4000)
);

-- The only index worth its write cost here. Every other lookup is a scan over
-- a table that will hold hundreds of rows, not millions.
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

create or replace trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

alter table public.support_tickets  enable row level security;
alter table public.support_messages enable row level security;

-- ─── STAFF (authenticated) ───────────────────────────────────────────────────
-- Own rows only. A head has no business reading a teacher's ticket about the
-- head, and nobody but the operator reads across centres.
drop policy if exists support_tickets_own_select on public.support_tickets;
create policy support_tickets_own_select on public.support_tickets
  for select to authenticated
  using (reporter_profile_id = (select auth.uid()));

drop policy if exists support_tickets_own_insert on public.support_tickets;
create policy support_tickets_own_insert on public.support_tickets
  for insert to authenticated
  with check (reporter_profile_id = (select auth.uid()) and reporter_student_id is null);

drop policy if exists support_messages_own_select on public.support_messages;
create policy support_messages_own_select on public.support_messages
  for select to authenticated
  using (exists (
    select 1 from public.support_tickets t
    where t.id = support_messages.ticket_id and t.reporter_profile_id = (select auth.uid())
  ));

drop policy if exists support_messages_own_insert on public.support_messages;
create policy support_messages_own_insert on public.support_messages
  for insert to authenticated
  with check (
    author = 'reporter'
    and exists (
      select 1 from public.support_tickets t
      where t.id = support_messages.ticket_id and t.reporter_profile_id = (select auth.uid())
    )
  );

-- No update or delete policy for anyone. A reporter cannot edit history and
-- cannot close their own ticket; the operator does both with the service role.

-- ─── STUDENTS (anon, by code) ────────────────────────────────────────────────
-- Shared throttle helper. A wrong code costs a slot in the same sliding window
-- get_student_notes() and get_student_snapshot() already share, so ticket
-- filing cannot be used as an unthrottled oracle for guessing student codes.
create or replace function public.support_student(p_code text)
returns public.students language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_fails int;
begin
  if length(coalesce(p_code,'')) < 4 then raise exception 'Not found'; end if;
  select * into v_student from public.students where student_code = p_code;
  if v_student.id is null then
    select count(*) into v_fails from public.code_attempts where at > now() - interval '1 minute';
    if v_fails >= 25 then raise exception 'Too many attempts — please try again in a minute'; end if;
    insert into public.code_attempts default values;
    delete from public.code_attempts where at < now() - interval '5 minutes';
    raise exception 'Not found';
  end if;
  -- A pending student has not been approved by the head. They can still report
  -- a problem — being stuck on the waiting screen is a legitimate thing to
  -- report — so status is deliberately not checked here.
  return v_student;
end $$;

revoke execute on function public.support_student(text) from anon, authenticated;

create or replace function public.file_ticket(
  p_code text, p_intent text, p_outcome text, p_area text, p_frequency text,
  p_shot text, p_diag jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_centre public.centres; v_id uuid; v_recent int;
begin
  v_student := public.support_student(p_code);

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

-- Tickets *with* their messages. One call instead of a list call plus a thread
-- call per ticket: a student has at most a handful of reports, so the whole
-- conversation fits in the response that draws the list.
create or replace function public.my_tickets(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students;
begin
  v_student := public.support_student(p_code);
  return coalesce((
    select json_agg(json_build_object(
      'id', t.id, 'intent', t.intent, 'outcome', t.outcome,
      'status', t.status, 'created_at', t.created_at,
      'messages', coalesce((
        select json_agg(json_build_object('author', m.author, 'body', m.body, 'created_at', m.created_at)
               order by m.created_at)
        from public.support_messages m where m.ticket_id = t.id
      ), '[]'::json)
    ) order by t.created_at desc)
    from public.support_tickets t where t.reporter_student_id = v_student.id
  ), '[]'::json);
end $$;

create or replace function public.reply_ticket(p_code text, p_ticket uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_recent int;
begin
  v_student := public.support_student(p_code);
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
end $$;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0023_support_tickets')
  on conflict (version) do nothing;
