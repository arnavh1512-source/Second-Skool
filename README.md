<div align="center">

<img src="app/icon.png" width="88" alt="Second Skool logo" />

# Second Skool

### Run your whole tuition centre from one screen.

*Attendance · Results · Fees · Timetable · Rankings · Study material · Push notifications*

<p>
<img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
<img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" />
<img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
<img alt="PWA" src="https://img.shields.io/badge/PWA-installable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" />
</p>

<img src="docs/screenshots/desktop.png" width="100%" alt="Second Skool — desktop sign-in" />

</div>

---

## 🎯 The problem

Most tuition centres in India still run on **WhatsApp groups, paper registers, and a fee diary**. Attendance gets lost. Parents ask "how is my child doing?" and nobody has a straight answer. Fees slip through the cracks.

**Second Skool replaces all of it with one app** — and every centre that signs up gets its own private, fully isolated space.

## 👥 Three apps in one

<table>
<tr>
<td width="33%" valign="top">

### 🏛️ Head
*The owner*

Creates the centre and runs it end to end — approves staff & students, manages branches, batches, subjects, fees, timetable, results, reports, and broadcasts.

</td>
<td width="33%" valign="top">

### 🧑‍🏫 Teacher
*The daily driver*

Takes attendance, enters results, sets homework, sends reminders, uploads notes and books parent meetings — on a phone, between classes.

Sees the timetable, the roster and every fee balance. Editing them, and anything to do with money or staff, stays with the head.

</td>
<td width="33%" valign="top">

### 🎓 Student
*No account needed*

Enters the private code their teacher gave them and instantly sees their attendance, marks, rank, fees, timetable and notes.

</td>
</tr>
</table>

## 📱 See it

<div align="center">

<img src="docs/screenshots/login.png" width="30%" alt="Sign in — staff use Google, students and parents use a code" />
&nbsp;
<img src="docs/screenshots/student-code.png" width="30%" alt="Student code entry" />
&nbsp;
<img src="docs/screenshots/stu-home.png" width="30%" alt="Parent dashboard home — fee due, attendance and class rank" />

<sub>Sign in · Code entry · Dashboard home</sub>

<img src="docs/screenshots/stu-attendance.png" width="30%" alt="Attendance history, day by day" />
&nbsp;
<img src="docs/screenshots/stu-results.png" width="30%" alt="Test results with grades per subject" />
&nbsp;
<img src="docs/screenshots/stu-ranking.png" width="30%" alt="Subject ranking within the class" />

<sub>Attendance · Results · Ranking</sub>

<img src="docs/screenshots/stu-fees.png" width="30%" alt="Fees — next instalment and payment history" />
&nbsp;
<img src="docs/screenshots/stu-timetable.png" width="30%" alt="Weekly timetable" />

<sub>Fees · Timetable</sub>

<sub>What a parent sees after typing their child's code. Real app screens on a phone viewport, filled with sample data.</sub>

</div>

## ✨ What's inside

| | Feature | What it does |
|:--:|---|---|
| 📋 | **Attendance** | Per-batch daily attendance, student-visible history |
| 📊 | **Results & rankings** | Test marks, subject-wise rankings, student report cards |
| 💰 | **Fees** | Per-student records with a full breakdown — what each balance is actually made of. Head can add a fee, mark it paid, or remove one entered by mistake |
| 🗓️ | **Timetable** | Class and batch timetables for staff and students |
| 📝 | **Homework** | Set work per class with a due date; the class is notified |
| 🤝 | **Parent meetings** | Book a slot with a parent, reschedule it, or cancel it |
| 📚 | **Study material** | Upload and share notes & files (MIME-validated) |
| 📢 | **Reminders** | Send a notice to a class or one student — with a log of what has already gone out, so nobody gets chased twice |
| 🔔 | **Notifications** | Web push to the lock screen + in-app bell for heads, teachers and students |
| 🏢 | **Multi-branch** | Branches, subjects and batches per centre |
| ✅ | **Approvals** | Head approves staff and student join requests |
| 📈 | **Reports** | Centre-wide insight for the owner |
| 👁️ | **Parent visibility** | A parent enters their child's private code and sees attendance, marks, rank, fees, timetable and notes. No account, nothing to install, nothing the child can quietly leave out |
| 📲 | **Installs like an app** | Add to home screen, opens full screen, and every save says plainly whether it saved — no silent failures on a weak signal |

## 🏗️ How it's built

```mermaid
graph TB
    subgraph client["📱 Client — installable PWA"]
        UI["Next.js 16 App Router<br/>React 19 · Tailwind v4"]
        Z["Zustand store<br/>code-split screens"]
        SW["Service worker<br/>web push"]
    end

    subgraph edge["▲ Vercel"]
        API["/api routes<br/>auth · validate · rate-limit"]
    end

    subgraph data["🗄️ Supabase"]
        AUTH["Auth<br/>Google OAuth + student code"]
        DB[("Postgres<br/>Row-Level Security")]
        RPC["SECURITY DEFINER RPCs<br/>pinned search_path"]
    end

    UI <--> Z
    Z <-->|"scoped by centre_id"| DB
    Z --> AUTH
    Z --> API
    API --> DB
    API --> SW
    DB --- RPC

    style client fill:#eff6ff,stroke:#2a6fdb,color:#1a2332
    style edge fill:#f8fafc,stroke:#334155,color:#1a2332
    style data fill:#ecfdf5,stroke:#3FCF8E,color:#1a2332
```

## 🔒 Multi-tenancy & security

Many centres share one deployment, so isolation is the whole ballgame. It's enforced **in the database, not in app code** — a compromised client still can't reach another centre's data.

```mermaid
flowchart LR
    A["👩‍🏫 Teacher<br/>Centre A"] -->|"JWT"| RLS{"Postgres RLS<br/>centre_id check"}
    B["👨‍🏫 Teacher<br/>Centre B"] -->|"JWT"| RLS
    RLS -->|"✅ allowed"| DA[("Centre A rows")]
    RLS -->|"✅ allowed"| DB2[("Centre B rows")]
    RLS -.->|"❌ blocked"| X["Cross-centre access"]

    style RLS fill:#fef3c7,stroke:#d97706,color:#1a2332
    style X fill:#fee2e2,stroke:#dc2626,color:#1a2332
```

- **Row-Level Security** on every tenant table, keyed by `centre_id`.
- **Sensitive reads** go through `SECURITY DEFINER` RPCs with a pinned `search_path`; invalid student-code lookups are **rate-limited in the database** to blunt brute-force — while valid codes always resolve, so real students are never locked out.
- **Security headers** — CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` — in [`next.config.ts`](next.config.ts).
- **Every server route is validated and rate-limited** (shared across serverless instances via Upstash Redis when it is configured):
  - [`/api/push`](app/api/push/route.ts) authenticates the caller and scopes every send to their centre.
  - [`/api/push/student-request`](app/api/push/student-request/route.ts) tells the head a student is waiting. It has no session, so the new student code authorises the send, and it stops working once the request is approved or rejected.
  - [`/api/log`](app/api/log/route.ts) collects client crash reports, including from the sign-in screen, with a strict size and shape check.
  - [`/api/dev`](app/api/dev/route.ts) is the operator console. It is gated to an allow-listed, confirmed Google identity, and it is the only place the service-role key is used for reads across centres.
- **Notification links** are relative-only, so a tapped notification can never redirect off-app.
- **Structured logging** is PII-safe by construction — the type system rejects dumping whole records into a log line.

## 📘 User guides

Printable PDF handouts for the people who actually use the app, drawn in the app's current look.

| Guide | For | What's in it |
|---|---|---|
| **How-To Guide** | Heads, teachers, parents | Step-by-step, no jargon. Start here. |
| **Complete Feature Guide** | Heads and teachers | Every feature, role by role, with phone screens. |
| **Parent Guide** | Parents | Signing in with the child's code and reading each tab. |

The PDFs are generated, not committed. Build the one you need:

```bash
pip install reportlab
python scripts/pdf/howto.py     # Second-Skool-How-To-Guide.pdf
python scripts/pdf/guide.py     # Second-Skool-Complete-Feature-Guide.pdf
python scripts/pdf/parents.py   # Second-Skool-Parent-Guide.pdf
```

They land in the repo root. See [`scripts/pdf/README.md`](scripts/pdf/README.md) before editing one.

## 🚀 Quick start

> Requires **Node 20.9+** (CI runs 24) and a Supabase project.

```bash
# 1 — install
npm install

# 2 — configure
cp .env.example .env.local        # then fill it in

# 3 — database
#     Run supabase/migrations/*.sql in numeric order, starting with
#     0000_schema_migrations.sql. See supabase/README.md.

# 4 — push keys
npx web-push generate-vapid-keys  # paste into .env.local

# 5 — go
npm run dev                       # → http://localhost:3000
```

## 🧰 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest suite |

## ⚙️ Configuration

Full list in [`.env.example`](.env.example).

| Variable | Required | Purpose |
|---|:--:|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` | ✅ | Client connection |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only, used by the `/api/*` routes. Never prefix it `NEXT_PUBLIC_` |
| `VAPID_*` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ✅ | Web push |
| `NEXT_PUBLIC_SITE_URL` | ➖ | Absolute base for OG images & manifest |

<sub>Optional vars are **dormant when unset** — the app runs fine without them and upgrades itself the moment they're added.</sub>

## 📦 Deployment

Deploys to **Vercel** with zero config. Add the environment variables to the Vercel project (Production **and** Preview), point it at your production Supabase, and attach a domain.

---

<div align="center">
<sub>Built for coaching classes and tuition centres. 🇮🇳</sub>
</div>
