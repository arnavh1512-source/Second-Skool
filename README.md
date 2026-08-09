<div align="center">

# 🎓 Second Skool

**Run your whole tuition centre from one screen.**

Attendance · Results · Fees · Timetable · Rankings · Study material · Push notifications

A multi-tenant SaaS for coaching classes and tuition centres — built mobile-first as an installable PWA, so heads, teachers, and students each get their own focused app on any phone.

</div>

---

## What it is

Second Skool is a complete management app for a tuition centre. One deployment serves many centres, each fully isolated from the others, with three roles:

- **Head (owner)** — creates the centre, approves staff & students, manages everything: students, teachers, batches, subjects, fees, timetable, results, reports, and broadcasts.
- **Teacher** — takes attendance, enters results, sets assignments & reminders, shares study material.
- **Student** — signs in with a private code to see their own attendance, results, rank, fees, timetable, assignments, notes, and notifications.

Everything is real-time, works offline-friendly as a PWA, and sends web push notifications (fee reminders, results published, announcements).

## Feature highlights

| Area | What it does |
|------|--------------|
| 📋 Attendance | Per-batch daily attendance, student-visible history |
| 📊 Results & rankings | Test marks, subject-wise rankings, student report cards |
| 💰 Fees | Fee plans, due/paid tracking, reminders |
| 🗓️ Timetable | Class/batch timetables for staff and students |
| 📝 Assignments & reminders | Set work and nudges per class |
| 📚 Study material | Upload & share notes/files (MIME-validated) |
| 🔔 Notifications | Web push + in-app bell for heads, teachers & students |
| 🏢 Multi-branch | Branches, subjects, and batches per centre |
| 👥 Approvals | Head approves staff and student join requests |

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Zustand** for client state (single-route client app + code-split screens)
- **Supabase** — Postgres, Auth (Google OAuth + code-based student login), Row-Level Security
- **Web Push** (VAPID) via a service worker
- **Vitest** test suite
- Deployed on **Vercel**

## Architecture notes

- **Multi-tenancy** is enforced in the database: every tenant row carries a `centre_id` and access is gated by **Postgres Row-Level Security** — not by app code. Cross-centre data access is impossible even if the client is compromised.
- **Sensitive reads** (a student's full snapshot) go through `SECURITY DEFINER` RPCs with a pinned `search_path`, and invalid student-code lookups are rate-limited at the DB to blunt brute-force.
- **Security headers** (CSP, HSTS, `X-Frame-Options`, etc.) are set in [`next.config.ts`](next.config.ts).
- The one server route, [`/api/push`](app/api/push/route.ts), authenticates the caller, scopes every send to their centre, validates input, and rate-limits per caller.

## Getting started

Requires Node 18+.

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local   # then fill in the values (see .env.example)

# 3. Set up the database
#    Run the SQL files in supabase/ against your Supabase project,
#    starting with schema.sql / production-schema.sql, then the feature
#    migrations. (These are applied manually, not via a migration CLI.)

# 4. Generate VAPID keys for web push
npx web-push generate-vapid-keys   # paste into .env.local

# 5. Run
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest suite |

## Environment variables

See [`.env.example`](.env.example) for the full list. Supabase + VAPID keys are required; `SENTRY_DSN` and Upstash Redis creds are optional and enable error monitoring and cross-instance rate limiting when set.

## Deployment

Deploys to **Vercel** with zero config. Set the environment variables from `.env.example` in the Vercel project, point your Supabase project at production, and add a custom domain.

---

<div align="center">
<sub>Built for coaching classes and tuition centres. 🇮🇳</sub>
</div>
