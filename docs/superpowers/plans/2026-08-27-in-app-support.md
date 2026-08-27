# In-App Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any user — head, teacher, or student — answer four short questions and optionally attach a screenshot to report a problem from inside the app, and let the operator read, answer and close it from the developer console.

**Architecture:** One `support_tickets` table whose columns *are* the answers, plus a `support_messages` thread for the conversation that follows. Staff reach it through RLS on their own rows; students have no auth session at all, so they reach it through throttled anon RPCs keyed on their `student_code`, the same pattern `get_student_snapshot` already uses. The operator reads and replies with the service role through new `/api/dev` actions. A screenshot is downscaled in the browser and stored as a data URL in a text column — the same call that files the ticket — following the precedent `app/lib/image.ts` already set for centre logos.

**Tech Stack:** Next.js 16.3.1 (App Router, Turbopack), React 19.2.4, Tailwind v4 (`td-*` tokens), TypeScript 5 strict, Zustand 5.0.14 slice pattern, Supabase (Postgres 17), Vitest 4.1.9.

## Global Constraints

- **No zod.** Hand-validation at the boundary is this repo's documented convention. Match the existing style in `app/api/dev/route.ts`.
- **Never write to the live database from an agent.** Migrations are `.sql` files the operator runs himself in the Supabase SQL editor. Supabase MCP is read-only verification only.
- **Every migration ends with its ledger insert.** `insert into public.schema_migrations (version) values ('<filename minus .sql>') on conflict (version) do nothing;`
- **Every `security definer` function sets `search_path`.** `set search_path = public` — this is the 0008 hardening and dropping it is a regression.
- **Students are not authenticated.** There is no `auth.uid()` for a student. Anything a student calls must be an anon-callable `security definer` RPC that takes `p_code` and is rate-limited.
- **`notify` has two kinds only** — `'info' | 'error'`. There is no `'success'`.
- **Ponytail discipline applies.** No abstraction until there is a second implementation, no config nobody sets, no wrapper that only delegates, no column nothing reads.
- **Verify by exit code, never through a pipe.** `npx tsc --noEmit; echo "TSC_EXIT=$?"` — a pipe masks the failure.
- **Test files** live in `tests/*.test.ts`, run under vitest's `node` environment, and test pure functions.
- **Rate-limit copy** matches the existing throttle: `'Too many attempts — please try again in a minute'`.

---

## Why this shape

**1. Students have no auth session.** `studentSignup` in `app/store/slices/students.ts` calls an anon RPC, stores a `student_code` in localStorage, and that code is the student's entire identity. So "students can file tickets" cannot use RLS on `auth.uid()`, and the filing endpoint is reachable by anyone on the internet who guesses a code — which is why it shares the sliding window that already guards `get_student_notes`.

**2. The questions replace the free-text box, they do not sit on top of it.** "Attendance not working" is not triageable. *What were you trying to do / what happened instead / which part / does it happen every time* is. The first answer becomes the inbox title, so there is no separate subject field to write, validate, or store.

**3. A screenshot of the students screen contains every child's name and their parent's phone number.** That is exactly the data commit `e69b2f7` removed the operator's access to — except a screenshot is stored rather than viewed. It is still worth having, because it is the most useful thing a non-technical reporter can produce, but it is shaped for that fact: optional, one per ticket, the picker says out loud what the image will contain, it is downscaled and re-encoded in the browser (which also drops EXIF), and it is **erased the moment the ticket is marked resolved**.

**4. There is no support channel today.** A locked-out user has no path at all, which is why Task 5 puts a WhatsApp fallback on the auth screens: someone who cannot sign in cannot file an in-app ticket, and that is exactly the person who most needs to reach you.

---

## Ponytail pass — what this plan does NOT build

Recorded so a later reader does not "restore" them thinking they were forgotten.

- `delete:` **`subject` column.** The first answer *is* the title. Removes a form field, a validation rule, a column, and the awkward insert-ticket-then-insert-first-message two-step for staff.
- `delete:` **`kind` ('bug' | 'question') triage column.** Nothing queries or filters on it; the operator reads the ticket and answers it. A label you set and never read is decoration.
- `delete:` **`'answered'` status.** Derivable from the last message's author, and the reporter replying flipped it back anyway. Status is `open | resolved`.
- `delete:` **`/api/support/notify`, `app/lib/push-server.ts`, and the `notified_at` latch.** A new anon-reachable endpoint plus web-push plumbing, so a one-person operation learns about a ticket a few hours sooner. The console shows the open count. Add it back when checking the console daily stops being realistic.
- `delete:` **`ticket_thread` RPC and the `ticket` dev action.** `my_tickets` returns each ticket with its messages nested, and the staff path uses PostgREST's nested select. Opening a thread is now local state, not a network call.
- `delete:` **`screen`, `url`, `role` and `online` from the diagnostics block.** This is a single-route SPA, so `url` is a constant; `screen` at file time is always `support`; `role` is already `reporter_role` on the ticket; and a ticket that inserted successfully was obviously online. Four fields that would have looked like telemetry and carried no information. What is left — build sha, viewport, user agent, last error — all genuinely varies.
- `delete:` **a private storage bucket, its policies, `/api/support/upload`, and signed URLs.** The screenshot is a capped data URL in a text column, which `app/lib/image.ts` already established as this repo's pattern, and it rides in the RPC call that files the ticket. Erasing it on resolve is then one `set shot = null` instead of a storage delete.
- `yagni:` **separate `diagnostics.ts` and `support-validate.ts` modules.** Both describe the shape of a support report. One `app/lib/support.ts`, one `tests/support.test.ts`.
- `delete:` **four of the five indexes.** A table that will hold hundreds of rows does not need `status`, `centre_id`, `reporter_student_id` and `reporter_profile_id` indexed. Only the `support_messages` join path keeps one.

---

## File Structure

**Created**

| Path | Responsibility |
|---|---|
| `supabase/migrations/0023_support_tickets.sql` | Tables, RLS, and the three anon RPCs. Operator runs it manually. |
| `app/lib/support.ts` | The shape of a report: `AREAS`, `FREQUENCIES`, `validateReport`, `buildDiagnostics`. Pure. |
| `app/store/slices/support.ts` | Reporter-side state, and the `window.onerror` capture that feeds `lastError`. |
| `app/components/SupportScreens.tsx` | `support` (questions + my reports) and `supportThread` screens, shared by staff and students. |
| `tests/support.test.ts` | Validation bounds and the diagnostics block. |

**Modified**

| Path | Change |
|---|---|
| `app/lib/image.ts` | `fileToScreenshotDataUrl` — aspect-preserving downscale to JPEG, reusing the existing `loadImage`. |
| `app/store/types.ts` | `Screen` union gains `support`/`supportThread`; report types; `State` and `Actions` keys. |
| `app/store/initial-state.ts` | Defaults for the four new state keys. |
| `app/store.ts` | Compose `createSupportSlice`. |
| `app/page.tsx` | Route the two new screens; `SCREEN_TITLES` entries. |
| `app/components/UtilityScreens.tsx` | "Report a problem" row on the staff `more` screen. |
| `app/components/StudentScreens.tsx` | "Report a problem" row on `stuProfile`. |
| `app/components/AuthScreens.tsx` | WhatsApp fallback for users who cannot sign in. |
| `app/api/dev/route.ts` | Actions `tickets`, `ticketReply`, `ticketResolve`. |
| `app/store/slices/operator.ts` | Operator-side ticket actions. |
| `app/components/DevConsole.tsx` | Operator inbox: list, thread, diagnostics, screenshot, reply, resolve. |

---

## Task 1: Database — tables, RLS, and the anon RPCs

**Files:**
- Create: `supabase/migrations/0023_support_tickets.sql`

**Interfaces:**
- Consumes: `public.set_updated_at()`, `public.code_attempts`, `public.schema_migrations`.
- Produces: tables `public.support_tickets`, `public.support_messages`; RPCs `public.file_ticket(text,text,text,text,text,text,jsonb)`, `public.my_tickets(text)`, `public.reply_ticket(text,uuid,text)`.

- [ ] **Step 1: Write the migration**

```sql
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
  -- survives the reporter's account being deleted.
  centre_id           uuid references public.centres(id) on delete set null,
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
create policy support_tickets_own_select on public.support_tickets
  for select to authenticated
  using (reporter_profile_id = (select auth.uid()));

create policy support_tickets_own_insert on public.support_tickets
  for insert to authenticated
  with check (reporter_profile_id = (select auth.uid()) and reporter_student_id is null);

create policy support_messages_own_select on public.support_messages
  for select to authenticated
  using (exists (
    select 1 from public.support_tickets t
    where t.id = support_messages.ticket_id and t.reporter_profile_id = (select auth.uid())
  ));

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
```

- [ ] **Step 2: Check the file without running it**

The agent must NOT run this against the database. Confirm every `security definer` function carries `set search_path = public`:

Run: `grep -c "set search_path = public" supabase/migrations/0023_support_tickets.sql`
Expected: `4`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0023_support_tickets.sql
git commit -m "feat: support ticket tables, policies and student RPCs"
```

- [ ] **Step 4: Hand the migration to the operator**

Tell the user to run `supabase/migrations/0023_support_tickets.sql` in the Supabase SQL editor. Do not stop and wait — the rest of the plan is written so the app compiles and ships before the migration runs.

---

## Task 2: The shape of a report

**Files:**
- Create: `app/lib/support.ts`
- Create: `tests/support.test.ts`

**Interfaces:**
- Produces: `AREAS`, `FREQUENCIES`, `type Frequency`, `type ReportDraft`, `validateReport(d)`, `type Diagnostics`, `buildDiagnostics(i)`.

One module, because both halves answer the same question: what does a valid support report look like. Pure, so it tests under vitest's `node` environment with no DOM.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { validateReport, buildDiagnostics, AREAS, FREQUENCIES } from '../app/lib/support'

// The validation bounds are the client-side mirror of the CHECK constraints and
// the raise exceptions in 0023. If they drift, a reporter gets a raw Postgres
// error instead of a sentence telling them what to fix.

const ok = { intent: 'Mark attendance for Class 10', outcome: 'The save button does nothing', area: 'Attendance', frequency: 'always' as const }

describe('validateReport', () => {
  it('accepts an ordinary report', () => {
    expect(validateReport(ok)).toBeNull()
  })

  it('asks for the first answer when it is too short to act on', () => {
    expect(validateReport({ ...ok, intent: 'hi' })).toBe('Tell us what you were trying to do')
  })

  it('rejects a first answer past the column limit', () => {
    expect(validateReport({ ...ok, intent: 'x'.repeat(121) })).toBe('Tell us what you were trying to do')
  })

  it('counts trimmed length, so whitespace cannot pad an answer', () => {
    expect(validateReport({ ...ok, outcome: '   a   ' })).toBe('Tell us what happened instead')
  })

  it('requires an area, because the app cannot guess which feature broke', () => {
    expect(validateReport({ ...ok, area: '' })).toBe('Choose which part of the app')
  })

  it('offers areas in the words a teacher uses, and a way out', () => {
    expect(AREAS).toContain('Attendance')
    expect(AREAS).toContain('Something else')
    expect(FREQUENCIES.map(f => f.value)).toEqual(['always', 'sometimes', 'first'])
  })
})

// The diagnostics block exists so a report is answerable without opening the
// reporter's centre — which, since e69b2f7, is not possible at all. It must
// never become a second copy of their data, so it carries only facts about the
// build and the device.

describe('buildDiagnostics', () => {
  it('keeps the facts that identify a build and a device', () => {
    const d = buildDiagnostics({
      version: 'abc1234', userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      width: 412, height: 915, lastError: null,
    })
    expect(d).toEqual({
      version: 'abc1234', userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      viewport: '412x915', lastError: null,
    })
  })

  it('caps a runaway error string instead of storing a stack dump', () => {
    const d = buildDiagnostics({ version: 'a', userAgent: 'x', width: 1, height: 1, lastError: 'E'.repeat(5000) })
    expect(d.lastError!.length).toBe(300)
  })

  it('caps a user agent, which is attacker-controlled text', () => {
    const d = buildDiagnostics({ version: 'a', userAgent: 'U'.repeat(5000), width: 1, height: 1, lastError: null })
    expect(d.userAgent.length).toBe(200)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/support.test.ts`
Expected: FAIL — `Failed to resolve import "../app/lib/support"`

- [ ] **Step 3: Write the implementation**

```ts
// What a support report is made of.
//
// Four questions instead of a message box. "Attendance not working" is not
// something you can act on; "I was marking attendance for Class 10 / the save
// button does nothing / Attendance / every time" is answerable without a single
// follow-up. The first answer doubles as the ticket's title, which is why there
// is no subject field.

// The features in the words a teacher would use, not screen names. The last
// entry matters as much as the rest: without a way out, someone whose problem
// does not fit picks one at random and the answer becomes noise.
export const AREAS = [
  'Attendance', 'Fees', 'Results & tests', 'Timetable', 'Students',
  'Assignments', 'Study material', 'Reminders & notifications',
  'Signing in', 'Something else',
] as const

export type Frequency = 'always' | 'sometimes' | 'first'

// One tap, and the single best signal for telling a real defect from a fluke.
export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'always', label: 'Every time' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'first', label: 'First time' },
]

export type ReportDraft = {
  intent: string
  outcome: string
  area: string
  frequency: Frequency
}

// Mirrors the bounds in supabase/migrations/0023_support_tickets.sql. The
// database is the gate that matters; this exists so the reporter reads a
// sentence instead of a Postgres exception.
export function validateReport(d: ReportDraft): string | null {
  const intent = d.intent.trim()
  if (intent.length < 3 || intent.length > 120) return 'Tell us what you were trying to do'
  const outcome = d.outcome.trim()
  if (outcome.length < 3 || outcome.length > 1000) return 'Tell us what happened instead'
  if (!d.area.trim() || d.area.trim().length > 40) return 'Choose which part of the app'
  if (!FREQUENCIES.some(f => f.value === d.frequency)) return 'Tell us how often it happens'
  return null
}

// Deliberately four fields. The screen is always `support` by the time a report
// is filed, the URL never changes in a single-route app, and the role is
// already on the ticket — recording those would look like telemetry and tell
// you nothing. These four all actually vary between one reporter and the next.
export type Diagnostics = {
  version: string
  viewport: string
  userAgent: string
  lastError: string | null
}

export type DiagnosticsInput = {
  version: string
  userAgent: string
  width: number
  height: number
  lastError: string | null
}

export function buildDiagnostics(i: DiagnosticsInput): Diagnostics {
  return {
    version: i.version,
    viewport: `${i.width}x${i.height}`,
    userAgent: i.userAgent.slice(0, 200),
    lastError: i.lastError ? i.lastError.slice(0, 300) : null,
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/support.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add app/lib/support.ts tests/support.test.ts
git commit -m "feat: support report questions, validation and diagnostics"
```

---

## Task 3: Screenshot downscaling

**Files:**
- Modify: `app/lib/image.ts`

**Interfaces:**
- Consumes: the module-private `loadImage` already in that file.
- Produces: `export async function fileToScreenshotDataUrl(file: File): Promise<string>`

Added to `image.ts` rather than a new module because it reuses `loadImage` and is the same concern the file already owns: turning a user's picture into something small enough to put in a column.

- [ ] **Step 1: Add the function**

Append to `app/lib/image.ts`:

```ts
// A support screenshot. Long edge capped and re-encoded as JPEG, which drops
// EXIF (location, device serial) for free and keeps the data URL inside the
// 400,000-character CHECK on support_tickets.shot. Quality steps down rather
// than failing: a phone screenshot of a dense fees table at q0.7 is ~180KB,
// but a tablet screenshot can be twice that, and telling someone their bug
// report is too big is not an acceptable answer.
const SHOT_MAX_EDGE = 1000
const SHOT_MAX_CHARS = 400_000

export async function fileToScreenshotDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('That image is too large — under 5MB please')

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, SHOT_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process that image')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    for (const q of [0.7, 0.5, 0.35]) {
      const out = canvas.toDataURL('image/jpeg', q)
      if (out.length <= SHOT_MAX_CHARS) return out
    }
    throw new Error('That image is too detailed to attach — try cropping it')
  } finally {
    URL.revokeObjectURL(url)
  }
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit; echo "TSC_EXIT=$?"
```
Expected: `TSC_EXIT=0`

- [ ] **Step 3: Commit**

```bash
git add app/lib/image.ts
git commit -m "feat: downscale support screenshots in the browser"
```

---

## Task 4: Types and the reporter store slice

**Files:**
- Modify: `app/store/types.ts`
- Modify: `app/store/initial-state.ts`
- Create: `app/store/slices/support.ts`
- Modify: `app/store.ts`

**Interfaces:**
- Consumes: `buildDiagnostics`, `validateReport`, `ReportDraft`, `Frequency` (Task 2); `fileToScreenshotDataUrl` (Task 3); `Slice`, `supabase`, `readLocal`, `friendlyError`.
- Produces: on the store — `myTickets`, `openTicketId`, `reportDraft`, `reportShot`, `setReportDraft(patch)`, `setReportShot(file)`, `loadMyTickets()`, `fileReport()`, `openReport(id)`, `replyToReport(body)`.

- [ ] **Step 1: Add the types**

In `app/store/types.ts`, append to the staff line of the `Screen` union so both audiences can reach it (the two screens sit outside every role gate):

```ts
  | 'stuTeacher' | 'stuFees' | 'stuNotif' | 'stuProfile' | 'stuTimetable' | 'stuAssignments' | 'stuNotes'
  | 'support' | 'supportThread'
```

Add next to the other domain types:

```ts
export type SupportMessage = { author: 'reporter' | 'operator'; body: string; createdAt: string }
// `intent` is the title — see app/lib/support.ts for why there is no subject.
export interface SupportTicket {
  id: string
  intent: string
  outcome: string
  status: 'open' | 'resolved'
  createdAt: string
  messages: SupportMessage[]
}
```

Add to `State` (inside the interface ending at line 121):

```ts
  myTickets: SupportTicket[]
  openTicketId: string | null
  reportDraft: ReportDraft
  // The screenshot as a data URL, already downscaled. Held apart from the
  // draft because it is the one field a reporter attaches rather than types.
  reportShot: string | null
```

with `import type { ReportDraft } from '../lib/support'` at the top of the file, and to `Actions`:

```ts
  setReportDraft: (patch: Partial<ReportDraft>) => void
  setReportShot: (file: File | null) => Promise<void>
  loadMyTickets: () => Promise<void>
  fileReport: () => Promise<void>
  openReport: (id: string) => void
  replyToReport: (body: string) => Promise<void>
```

- [ ] **Step 2: Add the defaults**

In `app/store/initial-state.ts`, alongside the other draft defaults:

```ts
  myTickets: [], openTicketId: null, reportShot: null,
  reportDraft: { intent: '', outcome: '', area: '', frequency: 'always' },
```

- [ ] **Step 3: Write the slice**

Create `app/store/slices/support.ts`. The branch on `role === 'student'` is the whole point of this file: a student has no session, so their path is an RPC carrying a code, while staff use ordinary table access under RLS.

```ts
import { supabase } from '../../lib/supabase'
import { readLocal } from '../../lib/storage'
import { fileToScreenshotDataUrl } from '../../lib/image'
import { buildDiagnostics, validateReport } from '../../lib/support'
import { friendlyError } from '../errors'
import type { Slice } from '../slice'
import type { SupportTicket, SupportMessage } from '../types'

// Which deploy produced the report. Vercel exposes the commit sha; a local
// build has none and says so, which is itself worth knowing in a ticket.
const VERSION = process.env.NEXT_PUBLIC_COMMIT_SHA?.slice(0, 7) ?? 'dev'

// The last uncaught error the browser saw. This is the single most useful field
// in a ticket — it turns "it just stops" into a stack frame — and it is only
// worth having because something actually writes it, so the listeners are here
// rather than an exported setter with no callers.
let lastError: string | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('error', e => { lastError = `${e.message} @ ${e.filename}:${e.lineno}`.slice(0, 300) })
  window.addEventListener('unhandledrejection', e => { lastError = `unhandled: ${String(e.reason)}`.slice(0, 300) })
}

const diagnostics = () => buildDiagnostics({
  version: VERSION,
  userAgent: navigator.userAgent,
  width: window.innerWidth,
  height: window.innerHeight,
  lastError,
})

// PostgREST hands back snake_case rows; the store speaks camelCase.
type Row = Record<string, unknown>
const toMessages = (rows: unknown): SupportMessage[] =>
  (Array.isArray(rows) ? rows : []).map((m: Row) => ({
    author: m.author as SupportMessage['author'],
    body: m.body as string,
    createdAt: (m.created_at ?? m.createdAt) as string,
  })).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

const toTicket = (t: Row): SupportTicket => ({
  id: t.id as string,
  intent: t.intent as string,
  outcome: t.outcome as string,
  status: t.status as SupportTicket['status'],
  createdAt: (t.created_at ?? t.createdAt) as string,
  messages: toMessages(t.messages ?? t.support_messages),
})

type Keys =
  | 'myTickets' | 'openTicketId' | 'reportDraft' | 'reportShot'
  | 'setReportDraft' | 'setReportShot' | 'loadMyTickets' | 'fileReport' | 'openReport' | 'replyToReport'

export const createSupportSlice: Slice<Keys> = (set, get) => ({
  myTickets: [],
  openTicketId: null,
  reportDraft: { intent: '', outcome: '', area: '', frequency: 'always' },
  reportShot: null,

  setReportDraft: (patch) => set(s => ({ reportDraft: { ...s.reportDraft, ...patch } })),

  setReportShot: async (file) => {
    if (!file) { set({ reportShot: null }); return }
    try { set({ reportShot: await fileToScreenshotDataUrl(file) }) }
    catch (e) { get().notify(e instanceof Error ? e.message : 'Could not attach that image', 'error') }
  },

  loadMyTickets: async () => {
    if (get().role === 'student') {
      const code = readLocal('student_code')
      if (!code) return
      const { data, error } = await supabase.rpc('my_tickets', { p_code: code })
      if (error) { get().notify(friendlyError(error, 'load your reports'), 'error'); return }
      set({ myTickets: (Array.isArray(data) ? data : []).map(toTicket) })
      return
    }
    // One round trip for staff too: PostgREST embeds the thread through the
    // foreign key, so opening a report never touches the network.
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id,intent,outcome,status,created_at,support_messages(author,body,created_at)')
      .order('created_at', { ascending: false })
    if (error) { get().notify(friendlyError(error, 'load your reports'), 'error'); return }
    set({ myTickets: (data ?? []).map(r => toTicket(r as Row)) })
  },

  fileReport: async () => {
    const { reportDraft: d, reportShot, role, me, centreId, centreName, myName } = get()
    const problem = validateReport(d)
    if (problem) { get().notify(problem, 'error'); return }
    const diag = diagnostics()

    if (role === 'student') {
      const code = readLocal('student_code')
      if (!code) { get().notify('Sign in again to report a problem', 'error'); return }
      const { error } = await supabase.rpc('file_ticket', {
        p_code: code, p_intent: d.intent, p_outcome: d.outcome,
        p_area: d.area, p_frequency: d.frequency, p_shot: reportShot, p_diag: diag,
      })
      if (error) { get().notify(friendlyError(error, 'send your report'), 'error'); return }
    } else {
      const { error } = await supabase.from('support_tickets').insert({
        reporter_profile_id: me?.id ?? null,
        centre_id: centreId ?? null,
        centre_name: centreName ?? '',
        reporter_name: myName ?? '',
        reporter_role: role ?? '',
        intent: d.intent.trim(), outcome: d.outcome.trim(),
        area: d.area, frequency: d.frequency,
        shot: reportShot, diagnostics: diag,
      })
      if (error) { get().notify(friendlyError(error, 'send your report'), 'error'); return }
    }

    set({ reportDraft: { intent: '', outcome: '', area: '', frequency: 'always' }, reportShot: null })
    get().notify('Report sent — we will reply inside the app')
    await get().loadMyTickets()
  },

  // Local, because loadMyTickets already fetched the thread.
  openReport: (id) => set({ openTicketId: id, screen: 'supportThread' }),

  replyToReport: async (body) => {
    const id = get().openTicketId
    const text = body.trim()
    if (!id || !text) return
    if (get().role === 'student') {
      const code = readLocal('student_code')
      if (!code) return
      const { error } = await supabase.rpc('reply_ticket', { p_code: code, p_ticket: id, p_body: text })
      if (error) { get().notify(friendlyError(error, 'send that message'), 'error'); return }
    } else {
      const { error } = await supabase
        .from('support_messages').insert({ ticket_id: id, author: 'reporter', body: text })
      if (error) { get().notify(friendlyError(error, 'send that message'), 'error'); return }
    }
    await get().loadMyTickets()
  },
})
```

Note for the implementer: `me?.id`, `centreId` and `myName` are the store's existing names for the signed-in profile, its centre and its display name. Confirm the exact keys in `app/store/types.ts` before writing this file and use whatever is actually there — do not add new state for them.

- [ ] **Step 4: Compose the slice**

In `app/store.ts`, import `createSupportSlice` alongside the other slice imports and spread it into the store creator exactly as the neighbouring slices are spread. `Slice<Keys>` makes this fail to compile if a key is missed or duplicated.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit; echo "TSC_EXIT=$?"
```
Expected: `TSC_EXIT=0`

- [ ] **Step 6: Commit**

```bash
git add app/store/types.ts app/store/initial-state.ts app/store/slices/support.ts app/store.ts
git commit -m "feat: reporter-side support report state"
```

---

## Task 5: Reporter UI

**Files:**
- Create: `app/components/SupportScreens.tsx`
- Modify: `app/page.tsx`
- Modify: `app/components/UtilityScreens.tsx`
- Modify: `app/components/StudentScreens.tsx`
- Modify: `app/components/AuthScreens.tsx`

**Interfaces:**
- Consumes: `useDashboard`, `fmtDate`, `AREAS`, `FREQUENCIES`, and the Task 4 store keys.
- Produces: `export function SupportScreen()` and `export function SupportThreadScreen()`.

One component pair serves both audiences. The slice already branches on role, so the UI does not need to — which is why it is one file and not two.

- [ ] **Step 1: Build the two screens**

`SupportScreen` renders, in this order:

1. A line setting expectations: *"Four quick questions. We can already see which version of the app you are on and what device you are using — you do not need to explain that part."*
2. **"What were you trying to do?"** — a single-line input bound to `reportDraft.intent`, placeholder *"Mark attendance for Class 10"*.
3. **"What happened instead?"** — a textarea bound to `reportDraft.outcome`, placeholder *"The save button does nothing"*.
4. **"Which part of the app?"** — a `<select>` over `AREAS`, bound to `reportDraft.area`, starting on an empty `Choose one` option.
5. **"Does it happen every time?"** — three pill buttons from `FREQUENCIES`, the selected one filled `bg-td-primary text-white`, the others outlined.
6. **Screenshot (optional)** — a file input accepting `image/*`. The label must say what it does, verbatim: *"We will see whatever is on your screen, including student names. It is deleted when your report is closed."* When `reportShot` is set, show the image at `max-h-40 rounded-[12px]` with a "Remove" button calling `setReportShot(null)`.
7. A submit button calling `fileReport()`.
8. Below it, the `myTickets` list: each row shows `intent`, `fmtDate(createdAt)`, a status pill, and a reply badge when the last message's author is `'operator'`. Tapping a row calls `openReport(id)`.

Call `loadMyTickets()` in a `useEffect` on mount.

`SupportThreadScreen` reads the ticket out of `myTickets` by `openTicketId`, and renders: `intent` as the header with `outcome` beneath it in `text-td-muted`, then the messages as alternating bubbles keyed on `author` (operator messages visually distinct and labelled "Second Skool"), then a reply box calling `replyToReport`. If `openTicketId` is not in `myTickets`, render nothing and `go('support')`.

Match the existing visual language exactly: `rounded-[14px]` cards, `border-td-border`, `text-td-dark` / `text-td-muted`, `p-[13px]` inputs, `font-extrabold` buttons in `bg-td-primary`. Copy the input and card markup from `app/components/PeopleScreens.tsx` rather than inventing new ones.

Status pill colours, following the existing fee-badge convention:
- `open` — `#eaf1fc` background, `#2a6fdb` text
- `resolved` — `#f2f2f2` background, `#6b7280` text

- [ ] **Step 2: Route the screens**

In `app/page.tsx`, add to `SCREEN_TITLES`:

```ts
  support: 'Report a problem', supportThread: 'Your report',
```

and two cases to the `switch (screen)` block:

```tsx
    case 'support': return <SupportScreen />
    case 'supportThread': return <SupportThreadScreen />
```

They sit inside the existing gates, which is correct: an approved staff member or an approved student reaches them, and anyone who is *not* approved is on an auth screen where Step 4's WhatsApp link is the path instead.

- [ ] **Step 3: Add the entry points**

Staff — in `app/components/UtilityScreens.tsx`, `MoreScreen`. Not in the `daily` or `management` cards: those are the job. Add a third single-row card below them, rendered for every role:

```tsx
      {card([{ icon: 'help', label: 'Report a problem', tint: '#fdecea', screen: 'support' }])}
```

Use an existing `IconName` — check `app/components/Icon.tsx` and pick the closest one rather than adding a glyph.

Students — in `app/components/StudentScreens.tsx`, add the same row to `stuProfile`, styled as its neighbours, calling `goFrom('support', 'stuProfile', 'stuProfile')`.

- [ ] **Step 4: WhatsApp fallback for the locked out**

In `app/components/AuthScreens.tsx`, on the `denied`, `pending` and `register` screens, add a small line at the bottom:

```tsx
      <a
        href={whatsappShareUrl('918140081461', 'Hi, I need help with Second Skool.')}
        target="_blank" rel="noopener noreferrer"
        className="block text-center text-[12.5px] font-bold text-td-muted mt-5 no-underline"
      >
        Need help? Message us on WhatsApp
      </a>
```

Someone who cannot sign in cannot file an in-app report, and that is precisely the person who most needs to reach you.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit; echo "TSC_EXIT=$?"
npm run lint; echo "LINT_EXIT=$?"
npm run build; echo "BUILD_EXIT=$?"
```
Expected: all three `0`.

- [ ] **Step 6: Commit**

```bash
git add app/components/ app/page.tsx
git commit -m "feat: report a problem screens for staff and students"
```

---

## Task 6: Operator inbox

**Files:**
- Modify: `app/api/dev/route.ts`
- Modify: `app/store/slices/operator.ts`
- Modify: `app/components/DevConsole.tsx`

**Interfaces:**
- Consumes: the existing operator check, `admin` client, `nostore`, `logError`, `UUID` in `app/api/dev/route.ts`; `devFetch`/`devPost` in `app/store/slices/operator.ts`.
- Produces: `/api/dev` actions `tickets`, `ticketReply`, `ticketResolve`; store actions `devLoadTickets()`, `devReplyTicket(id, body)`, `devResolveTicket(id)`; store state `devTickets`.

- [ ] **Step 1: Add the three actions to `/api/dev`**

Insert before the `if (action === 'delete')` branch. These run after the existing operator check, so no extra auth is needed — but validate every input by hand, matching the file's existing style. Confirm the exact names of the response helper and the UUID regex in that file first and use them.

```ts
  // The whole inbox in one response, threads included. At this scale that is
  // one query rather than one plus N, and `shot` rides along because a report
  // without its screenshot is half a report.
  if (action === 'tickets') {
    const { data, error } = await admin
      .from('support_tickets')
      .select('id,intent,outcome,area,frequency,status,created_at,centre_name,reporter_name,reporter_role,diagnostics,shot,support_messages(author,body,created_at)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      logError('dev.tickets_failed', { uid, message: error.message })
      return nostore({ error: 'could not load reports' }, 500)
    }
    return nostore({ tickets: data ?? [] })
  }

  if (action === 'ticketReply') {
    const id = (body as { ticketId?: unknown }).ticketId
    const text = (body as { body?: unknown }).body
    if (typeof id !== 'string' || !UUID.test(id)) return nostore({ error: 'invalid report' }, 400)
    if (typeof text !== 'string' || text.trim().length < 1 || text.trim().length > 4000)
      return nostore({ error: 'invalid message' }, 400)

    const { error } = await admin
      .from('support_messages').insert({ ticket_id: id, author: 'operator', body: text.trim() })
    if (error) {
      logError('dev.ticket_reply_failed', { uid, message: error.message })
      return nostore({ error: 'could not send the reply' }, 500)
    }
    return nostore({ ok: true })
  }

  // Closing a report also erases its screenshot. That image is someone's
  // students — their names and their parents' phone numbers — and it was only
  // ever borrowed to answer one question. Once the question is answered there
  // is no reason for it to still exist, so this is the deletion, not a
  // scheduled job that might not run.
  if (action === 'ticketResolve') {
    const id = (body as { ticketId?: unknown }).ticketId
    if (typeof id !== 'string' || !UUID.test(id)) return nostore({ error: 'invalid report' }, 400)
    const { error } = await admin
      .from('support_tickets').update({ status: 'resolved', shot: null }).eq('id', id)
    if (error) {
      logError('dev.ticket_resolve_failed', { uid, message: error.message })
      return nostore({ error: 'could not close the report' }, 500)
    }
    return nostore({ ok: true })
  }
```

- [ ] **Step 2: Add the operator store actions**

In `app/store/slices/operator.ts`, add `devTickets` state plus three actions, each a thin `devFetch`/`devPost` call following the existing pattern. None of them reloads the page — unlike the seat actions that used to live here, none changes who the operator is.

```ts
  devLoadTickets: async () => {
    const json = await devFetch<{ tickets?: unknown[] }>('/api/dev?action=tickets')
    set({ devTickets: (json?.tickets ?? []) as DevTicket[] })
  },

  devReplyTicket: async (ticketId: string, body: string) => {
    await devPost({ action: 'ticketReply', ticketId, body })
    await get().devLoadTickets()
  },

  devResolveTicket: async (ticketId: string) => {
    await devPost({ action: 'ticketResolve', ticketId })
    await get().devLoadTickets()
  },
```

Note: `tickets` is a read, so route it the way the console's existing snapshot read is routed in that file — whether that is a GET with a query param or a POST body — rather than introducing a second convention.

- [ ] **Step 3: Build the console UI**

In `app/components/DevConsole.tsx`, add a "Reports" tab beside the existing `centres` / `people` tabs, with the open count in the tab label. Open reports sort first.

A collapsed row shows: `intent`, then `reporter_name · reporter_role · centre_name`, a status pill, and `area` + the frequency label as small chips. Expanded, it adds:

- `outcome` in full
- the diagnostics block as a two-column definition list — `version`, `viewport`, `userAgent`, `lastError` — with `lastError` in `text-td-red` and `font-mono text-[11px]` when present
- the screenshot, if `shot` is set, as `<img src={t.shot} className="w-full rounded-[12px] border border-td-border" />`
- the message thread
- a reply textarea and a "Send reply" button calling `devReplyTicket`
- a "Close report" button calling `devResolveTicket`, with the label beneath it: *"This also deletes the screenshot."*

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit; echo "TSC_EXIT=$?"
npm run lint; echo "LINT_EXIT=$?"
npx vitest run; echo "TEST_EXIT=$?"
npm run build; echo "BUILD_EXIT=$?"
```
Expected: all four `0`.

- [ ] **Step 5: Commit and push**

```bash
git add app/api/dev/route.ts app/store/slices/operator.ts app/store/types.ts app/store/initial-state.ts app/components/DevConsole.tsx
git commit -m "feat: operator support inbox with replies and screenshot erasure"
git push
```

---

## Self-Review

**Spec coverage**

| Requirement | Task |
|---|---|
| A support box with questions the reporter answers | 2 (the questions), 5 (the form) |
| A screenshot can be attached | 1 (`shot` column + bounds), 3 (downscale), 5 (picker), 6 (viewing + erasure) |
| Everyone including students can file | 1 (anon RPCs), 4 (role branch), 5 (both entry points) |
| Operator can read and reply | 6 |
| Tell a real defect from a misunderstanding | 2 (`frequency`, `lastError`), 6 (both shown in the row) |
| Reports route to the operator, not the centre head | 1 (no head-facing policy), 6 |
| Locked-out users can still reach support | 5 Step 4 (WhatsApp) |

**Known gaps, stated rather than hidden**

- **The operator is not notified.** He learns about a report when he opens the console. Deliberate — see the ponytail pass. The trigger to build it is the first time a report sits unread for a day.
- **A user who cannot sign in cannot file a report.** Covered by the WhatsApp fallback, not by the ticket system.
- **Per-student caps (5 reports/hour, 20 messages/hour) are a guess** and may need tuning once real usage exists.
- **A staff reporter can attach a screenshot that a later staff reporter cannot see** — correct, since RLS scopes reads to `reporter_profile_id = auth.uid()`, but worth stating because it means the head cannot review what their teacher sent.
- **`shot` is erased on resolve, not on a timer.** A report that is never closed keeps its screenshot indefinitely. If the inbox ever grows past what one person closes promptly, that becomes a scheduled delete — and until then a timer is a job nobody would notice failing.
