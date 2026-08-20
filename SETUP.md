# Second Skool — Setup & Operations Guide

Production setup for the tuition-management app. No manual database edits are ever
required after the one-time schema run — roles are handled in-app.

---

## 1. Prerequisites

- A [Supabase](https://supabase.com) project (free tier is fine).
- Google OAuth enabled in that project (for staff sign-in).
- Node 18+ locally, and a [Vercel](https://vercel.com) account for deploy.

---

## 2. Environment variables

Create `.env.local` in the project root (and set the same two in Vercel → Project →
Settings → Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
```

Find both under Supabase → Project Settings → **API**. The anon key is safe to expose —
all access is enforced by Row-Level Security and SECURITY DEFINER functions.

---

## 3. Database (one time)

1. Open Supabase → **SQL Editor**.
2. Run the files in [`supabase/migrations/`](supabase/migrations) in numeric
   order, starting with `0000_schema_migrations.sql`, then `0001_baseline.sql`,
   then the rest. One file at a time; each records itself in the ledger.
   - Every file is idempotent (`add column if not exists`, `create or replace`,
     `drop policy if exists`), so a re-run is safe.
   - Already running the old loose `.sql` files in production? Run
     `0000_schema_migrations.sql` and then
     [`supabase/adopt-existing-database.sql`](supabase/adopt-existing-database.sql)
     instead — it marks 0001–0014 as applied without touching your data.
3. That's it. No table edits, no manually setting anyone to "admin".

Full details, including how to add the next migration:
[`supabase/README.md`](supabase/README.md).

---

## 4. Google sign-in (one time)

1. Supabase → **Authentication → Providers → Google** → enable, paste your Google
   OAuth client ID/secret ([Google Cloud Console](https://console.cloud.google.com)).
2. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: your production URL (e.g. `https://your-app.vercel.app`).
   - **Redirect URLs**: add both `http://localhost:3000` and your production URL.
3. In Google Cloud → Credentials → your OAuth client → **Authorized redirect URIs**,
   add `https://<your-project-ref>.supabase.co/auth/v1/callback`.

---

## 5. Roles & access — how it works (no manual promotion)

| Who | How they get in | What they can do |
|-----|-----------------|------------------|
| **Head teacher** | Signs in with Google → taps **Head Teacher** on the register screen. The option only appears while **no head exists yet**, so the first person to set up the centre claims it. | Everything: approvals, staff, students, fees, branches, subjects, billing, all daily updates. |
| **Teacher** | Signs in with Google → taps **Teacher** → status **pending** → the head teacher approves them from **Admin → Staff access**. | Daily updates only: attendance, marks, assignments, reminders, timetable, view students. |
| **Student** | **No login.** The teacher adds them and shares their code. Student taps **"I'm a student"** on the landing screen and enters the code. | Sees only their own attendance, marks, fees, ranking, and their course's notices. |

- Promoting another teacher to head teacher: **Admin → Staff access → Make head teacher**
  (a teacher can also tap *Request head access*, which flags them in that list).
- A teacher's code/data access is enforced server-side: a **pending** teacher cannot
  read or write anything until approved.

---

## 6. Daily usage

1. **Head teacher** signs in first → becomes head → adds branches, subjects, students.
2. Each added student produces a **link code** (auto-generated and strong, e.g.
   `TUT-7X2K9Q`; a custom code is optional but less private — see Security).
3. Share each code with that student/parent. They open the app → *I'm a student* →
   enter code → done. The code is remembered on their device.
4. Teachers sign in, get approved by the head, then mark attendance / enter marks /
   set assignments. Students see updates immediately.

---

## 7. Run locally

```
npm install
npm run dev      # http://localhost:3000
npm run build    # production build check
```

---

## 8. Deploy (Vercel)

1. Push to GitHub, import the repo in Vercel.
2. Add the two env vars (section 2) for Production (and Preview if you want).
3. Deploy. Then set the deployed URL as Site URL + Redirect URL in Supabase (section 4).

---

## 9. Security model (what protects the data)

- **Row-Level Security on every table.** Only **approved** staff can read/write; a
  pending/rejected teacher gets nothing. Head-only tables (students-write, fees,
  branches, subjects, billing, staff records) require head teacher.
- **Students never authenticate.** Their data comes from one SECURITY DEFINER function,
  `get_student_snapshot(code)`, which returns *only* the single student matching the
  code. The code is the credential.
- **Codes are the student's password.** Auto-generated codes are long and random.
  **Custom codes you type (e.g. `10A-001`) are guessable** — anyone could try nearby
  codes and view another student's data. Prefer auto-generated codes; only use custom
  codes when convenience outweighs privacy.
- **Role changes go only through server functions** (`register_as_head`,
  `approve_teacher`, `grant_head`, …), each of which re-checks the caller is an approved
  head teacher. Clients cannot edit roles directly.

---

## 10. Not included in this version (future work)

- Real payment/billing (the Subscription screen is informational only).
- External reminders (WhatsApp/email/SMS) — reminders are in-app only.
- Student photo uploads (the app uses clean initial-avatars throughout).
- Teacher logins are by approval; there is no public teacher self-serve beyond that.
