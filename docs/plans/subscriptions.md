# Subscriptions — build plan

Status: **ready, not started.** Build only when Arnav says go.

Source of truth for the numbers: the pricing sheet (`Documents/Second-Skool-Pricing.pdf`).

| | Free (Home Tutor) | Pro (Centre) | Business (Institute) |
|---|---|---|---|
| Price | ₹0 | ₹999/mo · ₹9,990/yr | ₹2,499/mo · ₹24,990/yr |
| Founding (first 20) | — | ₹499/mo · ₹4,999/yr, locked | — |
| Approved students | 25 | 150 | 500 |
| Staff (head counts) | 1 | 5 | unlimited |
| Branches | 1 | 1 | unlimited |
| Study material | 200 MB | 5 GB | 25 GB |
| Web push + reminder log | — | ✓ | ✓ |
| Rankings + report cards | — | ✓ | ✓ |
| Homework + parent meetings | — | ✓ | ✓ |
| Centre logo, no "Powered by" | — | ✓ | ✓ |
| Centre-wide reports | — | — | ✓ |
| Data export | — | — | ✓ |

Attendance, results, fees, timetable, notes, the parent dashboard and in-app
notifications stay free forever. They are the hook, and gating them would stop
teachers using the app at all.

## Rules the design follows

1. **The database enforces it, not the UI.** Clients write straight to
   Supabase under RLS, so a check that only lives in React is a suggestion.
   Every cap and every gated write is refused in Postgres. The UI just says so
   first and more politely.
2. **Gate writes, never reads.** A centre that downgrades or lapses keeps
   seeing everything it already has. Over-cap data is never deleted or hidden;
   only *new* adds are blocked. Nobody loses a register because a payment was
   late.
3. **Parents are never blocked.** Student self-signup (pending) is always
   accepted. The cap bites when staff *approve*, which is when the head can
   act on the upgrade prompt.
4. **Heads cannot upgrade themselves.** `centres` only grants UPDATE on
   `(name, logo_url)` to `authenticated` (0001 line 504). The new plan columns
   stay outside that grant; only the operator route (service role) writes them.
5. **No new teacher data entry.** Nothing here asks a teacher to type anything.
6. **No payment gateway at launch.** Founding centres pay by UPI on WhatsApp;
   the operator flips the plan in the console. Razorpay comes once manual
   renewals become a chore (roughly 20+ paying centres), not before.

## Phase 1 — Database (migration `0048_a_centre_has_a_plan.sql`)

- `centres` gains:
  - `plan text not null default 'free' check (plan in ('free','pro','business'))`
  - `plan_until date` — null for free; the paid-through date otherwise
  - `founding boolean not null default false`
  - `billing text check (billing in ('monthly','yearly'))`
- `public.centre_plan(c uuid) returns text` — the *effective* plan:
  - the stored plan while `plan_until + 7 days >= current_date`
  - otherwise `'free'`

  The 7 days are a grace period, so a late UPI transfer does not lock anyone
  out.
- `public.plan_limit(p text, what text) returns int` — the caps from the table
  above in one place. Null means unlimited.
- Caps, as BEFORE triggers raising `plan_limit:<what>`:
  - **students** — on insert with `status='approved'`, and on update when
    status changes to `'approved'`. Counts the centre's approved students. This
    covers `create_student`, the roster import and `approve_student` in one
    place.
  - **staff** — on `profiles` update when `staff_status` becomes `'approved'`
    with role `teacher` or `admin`. This covers `approve_teacher` and
    `grant_head`.
  - **branches** — on insert. `create_centre`'s main branch is number 1, which
    is fine.
- Feature gates, as BEFORE INSERT triggers raising `plan_feature:<what>`:
  - on `assignments`, `meetings` and `reminders` — pro or above
  - `logo_url` set to non-null on `centres` — pro or above
- Gated RPCs get a first-line check:
  - `centre_rankings` and the report card read — pro or above
  - `weekly_branch_report`, `weekly_student_reports` and
    `weekly_teacher_activity` — business
- Storage: the `notes` bucket insert policy also checks that the centre's
  summed object size plus the new file stays under the cap. First confirm that
  upload paths are prefixed by `centre_id` (`app/lib/upload.ts`).
- `my_centre()` also returns `plan`, `plan_until`, `founding` and live usage
  (students, staff, branches, storage MB), so the client makes one call.
- **Existing live centres** go to `plan='pro'`, `founding=true`,
  `plan_until = launch + 30 days`. That gives them a month to move to the
  founding price, rather than waking up capped at 25 students.
- The ledger insert goes last, as in every migration. The SQL is pasted in
  chat; Arnav runs it.

## Phase 2 — Server

- `app/api/push/route.ts` — refuse the send when `centre_plan` is free. This
  is server-side, so a free client cannot call the route directly.
- `app/api/dev/route.ts` — a new `setPlan` action:
  - hand-validated body: `centreId`, `plan`, `planUntil`, `billing`, `founding`
  - service role, operator-gated like the other actions
  - also enforces the founding cap of 20 server-side
- Data export (business): the head downloads a CSV/JSON of students,
  attendance, results and fees through an RPC. No new route.

## Phase 3 — Client

- `app/lib/plans.ts` — one `PLANS` constant (labels, prices, caps, features),
  plus:
  - `can(plan, feature)`
  - `limitOf(plan, what)`
  - `planError(err)`, which maps `plan_limit:*` / `plan_feature:*` to one
    human sentence ("You're at 25 students on Free. Pro takes 150.")
  
  All pure, so it can be tested.
- `centre` slice holds the plan and usage from `my_centre()`.
- **"Your plan" screen** (head only, from Settings):
  - current plan, and the renewal date
  - usage bars: students 18/25, staff, branches, storage
  - the founding badge
  - an Upgrade button that opens WhatsApp +918140081461 with a prefilled
    message (centre name + plan wanted)
- **Locked features stay visible:** a small lock tag and an upsell sheet
  instead of hiding the screen, because a hidden feature sells nothing.
- **Banners:**
  - 7 days before `plan_until`: "Renews on …"
  - in the grace period: "Payment due — features pause on …"
- Free parent dashboard shows "Powered by Second Skool". Pro+ shows the centre
  logo only.
- Colours come only from `td-*` tokens.

## Phase 4 — Operator console

- The centre list shows plan, paid-until, founding, and students against cap.
- A plan editor on each centre (plan, billing, until-date, founding), which
  calls `setPlan`.
- Header totals:
  - MRR, with yearly plans divided by 12
  - paying centres
  - founding slots used, out of 20
  - centres expiring this week

## Phase 5 — Tests and verification

- `tests/plans.test.ts` covers `can`, `limitOf`, `planError` and every tier
  boundary (25/26, 150/151, 500/501).
- `tests/operator.test.ts` covers `setPlan` validation, including bad plan,
  past date, and the 21st founding centre.
- RLS tests (`tests/rls/`):
  - a free head cannot insert the 26th approved student, an assignment, or a
    second branch
  - a head cannot update their own `plan` column
- Migration ledger test picks up 0048.
- The four checks (tsc, lint, vitest, build), exit codes read directly. Then
  ponytail over the diff.
- Browser pass: a free centre hits each cap and each lock, and gets the
  friendly message every time.

## Decisions to confirm before building

1. **Existing centres:** a 30-day Pro trial, then founding price. Or Pro free
   until a fixed date?
2. **Does the head count as staff?** The plan says yes: Free = the tutor
   alone, Pro = head + 4.
3. **Grace period:** 7 days?
4. **Payment:** manual UPI for now, Razorpay later. Correct?

## Out of scope for now

Razorpay/auto-renew, GST invoices (under the ₹20L threshold), a public
`/pricing` page, and per-branch billing.
