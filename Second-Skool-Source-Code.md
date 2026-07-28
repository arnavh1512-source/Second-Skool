# Second Skool — Full Source Code

Generated 2026-07-28 · commit `801834d` · fix: add Student requests to desktop sidebar


## .claude/launch.json

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000,
      "autoPort": false
    }
  ]
}
```

## .gitignore

```gitignore
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env files (can opt-in for committing if needed)
.env*

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

.vercel
```

## AGENTS.md

```md
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
```

## CLAUDE.md

```md
@AGENTS.md
```

## README.md

```md
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
```

## SETUP.md

```md
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
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and run it.
   - Safe to re-run on an existing database — the migration block is idempotent
     (`add column if not exists`, `create or replace`, `drop policy if exists`).
3. That's it. No table edits, no manually setting anyone to "admin".

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
```

## app/api/push/route.ts

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const runtime = 'nodejs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@secondskool.app'

if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

type Row = { endpoint: string; p256dh: string; auth: string }

// Best-effort per-caller rate limit (per serverless instance): 30 sends/min.
const RATE_LIMIT = 30, RATE_WINDOW_MS = 60_000
const callLog = new Map<string, number[]>()
function rateLimited(uid: string): boolean {
  const now = Date.now()
  const recent = (callLog.get(uid) ?? []).filter(t => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) { callLog.set(uid, recent); return true }
  recent.push(now); callLog.set(uid, recent)
  if (callLog.size > 1000) callLog.clear() // cap memory on long-lived instances
  return false
}

export async function POST(req: NextRequest) {
  if (!url || !serviceKey || !VAPID_PRIVATE) return NextResponse.json({ error: 'not configured' }, { status: 500 })

  // Authenticate the caller (any signed-in user) and read their centre.
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: userData } = await admin.auth.getUser(token)
  const uid = userData.user?.id
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (rateLimited(uid)) return NextResponse.json({ error: 'too many requests — slow down' }, { status: 429 })
  const { data: me } = await admin.from('profiles').select('centre_id, staff_status').eq('id', uid).single()
  const centre = me?.centre_id
  if (!centre) return NextResponse.json({ error: 'no centre' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { studentCodes, notifyHead, title, body: text, url: link } = body as {
    studentCodes?: string[]; notifyHead?: boolean; title?: string; body?: string; url?: string
  }
  if (!title || typeof title !== 'string' || title.length > 120) return NextResponse.json({ error: 'bad title' }, { status: 400 })
  if (text !== undefined && (typeof text !== 'string' || text.length > 500)) return NextResponse.json({ error: 'bad body' }, { status: 400 })
  if (studentCodes !== undefined && (!Array.isArray(studentCodes) || studentCodes.length > 1000 || studentCodes.some(c => typeof c !== 'string'))) {
    return NextResponse.json({ error: 'bad targets' }, { status: 400 })
  }

  const subs: Row[] = []

  // Student targets — approved staff only (pending teachers may only notifyHead),
  // and only students in the caller's centre.
  if (studentCodes?.length) {
    if (me?.staff_status !== 'approved') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const { data: students } = await admin.from('students').select('student_code').eq('centre_id', centre).in('student_code', studentCodes)
    const allowed = (students ?? []).map(s => s.student_code)
    if (allowed.length) {
      const { data } = await admin.from('push_subscriptions').select('endpoint,p256dh,auth').eq('kind', 'student').in('ref', allowed)
      subs.push(...(data ?? []))
    }
  }

  // Notify the centre's head (used when a teacher requests to join).
  if (notifyHead) {
    const { data: heads } = await admin.from('profiles').select('id').eq('centre_id', centre).eq('role', 'admin').eq('staff_status', 'approved')
    const ids = (heads ?? []).map(h => h.id)
    if (ids.length) {
      const { data } = await admin.from('push_subscriptions').select('endpoint,p256dh,auth').eq('kind', 'profile').in('ref', ids)
      subs.push(...(data ?? []))
    }
  }

  // Only same-app relative paths in notification links.
  const safeLink = typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : '/'
  const payload = JSON.stringify({ title, body: text ?? '', url: safeLink })
  const stale: string[] = []
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
    } catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) stale.push(s.endpoint) // expired subscription
    }
  }))
  if (stale.length) await admin.from('push_subscriptions').delete().in('endpoint', stale)

  return NextResponse.json({ sent: subs.length - stale.length })
}
```

## app/components/AdminScreens.tsx

```ts
'use client'

import { useEffect } from 'react'
import { useDashboard, initials, av } from '../store'
import { ScreenHeader } from './Shell'
import { supabase } from '../lib/supabase'
import { whatsappShareUrl, weeklyReportMessage, studentReportMessage } from '../lib/share'
import { useState } from 'react'


export function StaffApprovalsScreen() {
  const { back, staffList, loadStaff, loadMyCentre, joinCode, centreName, approveTeacher, rejectTeacher, grantHead, removeStaff, supabaseUserId, notify } = useDashboard()

  // Reload on open, and live-refresh whenever any profile changes (e.g. a new
  // teacher registers) so pending requests appear without leaving the screen.
  useEffect(() => {
    loadStaff(); loadMyCentre()
    const channel = supabase
      .channel('staff-approvals-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadStaff())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadStaff, loadMyCentre])

  const pending = staffList.filter(s => s.status === 'pending')
  const active = staffList.filter(s => s.status === 'approved')

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Staff access" onBack={back} />

      <div className="text-[13px] text-td-muted leading-relaxed mb-4 lg:max-w-2xl">Approve teachers so they can mark attendance and enter marks. Grant head access only to people you fully trust.</div>

      {joinCode && (
        <button onClick={() => { navigator.clipboard.writeText(joinCode); notify('Join code copied!') }} className="w-full lg:max-w-md text-left border-2 border-dashed border-td-primary bg-[#eaf1fc] rounded-[16px] p-3.5 mb-5 cursor-pointer flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-td-muted">{centreName || 'Your centre'} · JOIN CODE</div>
            <div className="text-[20px] font-extrabold text-td-primary tracking-[0.15em]">{joinCode}</div>
            <div className="text-[11px] text-td-muted mt-0.5">Share with teachers so they can join your centre.</div>
          </div>
          <div className="text-[11px] font-bold text-td-primary flex items-center gap-1 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </div>
        </button>
      )}

      <div className="text-sm font-extrabold text-td-dark mb-3">Pending approval {pending.length > 0 && <span className="text-td-red">· {pending.length}</span>}</div>
      {pending.length === 0 ? (
        <div className="text-center text-td-muted text-[13px] py-4 bg-white border border-td-border rounded-[16px] mb-6">No one waiting</div>
      ) : (
        <div className="flex flex-col gap-2.5 mb-6 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {pending.map((s, i) => (
            <div key={s.id} className="bg-white border border-td-border rounded-[16px] p-3.5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i) }}>{initials(s.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-td-dark truncate">{s.name}</div>
                  <div className="text-[11.5px] text-td-muted truncate">{s.email}</div>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => approveTeacher(s.id)} className="flex-1 border-none bg-td-green text-white text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer">Approve</button>
                <button onClick={() => rejectTeacher(s.id)} className="flex-1 border border-td-border bg-white text-td-muted text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-sm font-extrabold text-td-dark mb-3">Active staff</div>
      {active.length === 0 ? (
        <div className="text-center text-td-muted text-[13px] py-4 bg-white border border-td-border rounded-[16px]">No active staff yet</div>
      ) : (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {active.map((s, i) => {
            const isHead = s.role === 'admin'
            const isSelf = s.id === supabaseUserId
            return (
              <div key={s.id} className="bg-white border border-td-border rounded-[16px] p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i + 3) }}>{initials(s.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-td-dark truncate">{s.name}{isSelf && <span className="text-td-muted font-semibold"> · you</span>}</div>
                    <div className="text-[11.5px] text-td-muted truncate">{s.email}</div>
                  </div>
                  <span className="text-[10.5px] font-bold py-[5px] px-2.5 rounded-[20px]" style={{ color: isHead ? '#2a6fdb' : '#2fa36b', background: isHead ? '#eaf1fc' : '#e7f5ee' }}>{isHead ? 'Head' : 'Teacher'}</span>
                </div>
                {!isHead && (
                  <div className="flex gap-2.5 mt-3">
                    <button onClick={() => grantHead(s.id)} className="flex-1 border border-td-primary bg-white text-td-primary text-[12.5px] font-bold py-2.5 rounded-[12px] cursor-pointer">
                      {s.headRequested ? 'Grant head (requested)' : 'Make head teacher'}
                    </button>
                    <button onClick={() => removeStaff(s.id)} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12.5px] font-bold py-2.5 px-4 rounded-[12px] cursor-pointer">Remove</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Head/teacher review of self-registered students. Approve (optionally setting
// batch/branch + a first fee) turns their code live; reject declines it.
export function StudentRequestsScreen() {
  const { back, pendingStudents, branchesList, refreshData, approveStudent, rejectStudent, role, studentJoinCode, centreName, loadMyCentre, regenerateStudentCode, notify } = useDashboard()

  useEffect(() => { refreshData(); loadMyCentre() }, [refreshData, loadMyCentre])

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Student requests" onBack={back} />
      <div className="text-[13px] text-td-muted leading-relaxed mb-4 lg:max-w-2xl">Students who registered themselves. Review their details, set their batch and fee, then approve — their code only works once you do.</div>

      {studentJoinCode && (
        <div className="w-full lg:max-w-md border-2 border-dashed border-td-primary bg-[#eaf1fc] rounded-[16px] p-3.5 mb-5">
          <div className="flex items-start justify-between gap-3">
            <button onClick={() => { navigator.clipboard.writeText(studentJoinCode); notify('Student code copied!') }} className="text-left flex-1 min-w-0 cursor-pointer">
              <div className="text-[11px] font-bold text-td-muted">{centreName || 'Your centre'} · STUDENT CODE</div>
              <div className="text-[20px] font-extrabold text-td-primary tracking-[0.15em]">{studentJoinCode}</div>
              <div className="text-[11px] text-td-muted mt-0.5">Share with students so they can register themselves.</div>
            </button>
            <button onClick={() => { navigator.clipboard.writeText(studentJoinCode); notify('Student code copied!') }} className="text-[11px] font-bold text-td-primary flex items-center gap-1 shrink-0 cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
          </div>
          {role === 'admin' && (
            <button
              onClick={() => { if (confirm('Generate a new student code? The old one will stop working immediately.')) regenerateStudentCode() }}
              className="text-[11px] font-bold text-td-muted underline mt-2 cursor-pointer"
            >
              Generate a new code
            </button>
          )}
        </div>
      )}

      <div className="text-sm font-extrabold text-td-dark mb-3">Pending {pendingStudents.length > 0 && <span className="text-td-red">· {pendingStudents.length}</span>}</div>
      {pendingStudents.length === 0 ? (
        <div className="text-center text-td-muted text-[13px] py-6 bg-white border border-td-border rounded-[16px]">No requests waiting</div>
      ) : (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {pendingStudents.map((s, i) => (
            <StudentRequestCard key={s.dbId} s={s} idx={i} branches={branchesList} onApprove={approveStudent} onReject={rejectStudent} />
          ))}
        </div>
      )}
    </div>
  )
}

function StudentRequestCard({ s, idx, branches, onApprove, onReject }: {
  s: import('../store').PendingStudent
  idx: number
  branches: import('../store').BranchItem[]
  onApprove: (dbId: string, klass: string, branchId: string | null, fee: string, feeDue: string) => Promise<void>
  onReject: (dbId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [klass, setKlass] = useState(s.klass)
  const [branch, setBranch] = useState('')
  const [fee, setFee] = useState('')
  const [feeDue, setFeeDue] = useState('')

  const confirm = async () => {
    if (busy) return
    setBusy(true)
    const branchId = branch ? branches.find(b => b.name === branch)?.dbId ?? null : null
    await onApprove(s.dbId, klass, branchId, fee, feeDue)
    setBusy(false)
  }

  return (
    <div className="bg-white border border-td-border rounded-[16px] p-3.5 self-start">
      <div className="flex items-center gap-3 mb-2.5">
        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(idx) }}>{initials(s.name)}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-td-dark truncate">{s.name}</div>
          <div className="text-[11.5px] text-td-muted truncate">{s.klass} · {s.school}</div>
        </div>
        {s.when && <span className="text-[10.5px] text-td-subtle shrink-0">{s.when}</span>}
      </div>
      <div className="text-[12px] text-td-muted leading-relaxed mb-3 bg-[#f7f9fc] rounded-[10px] p-2.5">
        <div>Parent: <span className="font-semibold text-td-text">{s.parent || '—'}</span></div>
        {s.address && <div>Address: <span className="font-semibold text-td-text">{s.address}</span></div>}
        <div>Code: <span className="font-bold text-td-text tracking-wide">{s.code}</span></div>
      </div>

      {!open ? (
        <div className="flex gap-2.5">
          <button onClick={() => setOpen(true)} className="flex-1 border-none bg-td-green text-white text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer">Approve</button>
          <button onClick={() => onReject(s.dbId)} className="flex-1 border border-td-border bg-white text-td-muted text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer">Decline</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2.5">
            <div className="flex-1">
              <label className="text-[11px] font-bold text-td-muted">Batch / class</label>
              <input value={klass} onChange={e => setKlass(e.target.value)} className="w-full border border-td-border rounded-[10px] p-2.5 text-[13px] text-td-dark outline-none focus:border-td-primary mt-1" />
            </div>
            {branches.length > 0 && (
              <div className="flex-1">
                <label className="text-[11px] font-bold text-td-muted">Branch</label>
                <select value={branch} onChange={e => setBranch(e.target.value)} className="w-full border border-td-border rounded-[10px] p-2.5 text-[13px] text-td-dark outline-none focus:border-td-primary mt-1 bg-white">
                  <option value="">—</option>
                  {branches.map(b => <option key={b.dbId ?? b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2.5">
            <div className="flex-1">
              <label className="text-[11px] font-bold text-td-muted">Fee ₹ <span className="text-td-subtle font-semibold">(optional)</span></label>
              <input value={fee} onChange={e => setFee(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="e.g. 800" className="w-full border border-td-border rounded-[10px] p-2.5 text-[13px] text-td-dark outline-none focus:border-td-primary mt-1" />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-bold text-td-muted">Due date</label>
              <input type="date" value={feeDue} onChange={e => setFeeDue(e.target.value)} className="w-full border border-td-border rounded-[10px] p-2.5 text-[13px] text-td-dark outline-none focus:border-td-primary mt-1" />
            </div>
          </div>
          <div className="flex gap-2.5 mt-0.5">
            <button onClick={confirm} disabled={busy} className="flex-1 border-none bg-td-green text-white text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer disabled:opacity-60">{busy ? 'Approving…' : 'Confirm approval'}</button>
            <button onClick={() => setOpen(false)} className="border border-td-border bg-white text-td-muted text-[13px] font-bold py-2.5 px-4 rounded-[12px] cursor-pointer">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ReportsScreen() {
  const { back, weeklyReport: r, loadWeeklyReport, studentReports, loadStudentReports, teacherActivity, loadTeacherActivity, myPhone, centreName, loadMyCentre } = useDashboard()
  const [tab, setTab] = useState<'branches' | 'students' | 'teachers'>('branches')
  const [period, setPeriod] = useState<7 | 30>(7)
  useEffect(() => { loadWeeklyReport(period); loadStudentReports(period); loadTeacherActivity(period); loadMyCentre() }, [period, loadWeeklyReport, loadStudentReports, loadTeacherActivity, loadMyCentre])
  const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title={period === 7 ? 'Weekly Report' : 'Monthly Report'} onBack={back} right={
        <div className="flex bg-[#eef1f7] rounded-[12px] p-[3px]">
          {([7, 30] as const).map(d => (
            <button key={d} onClick={() => setPeriod(d)} className="text-[12px] font-bold py-[7px] px-3 rounded-[10px] cursor-pointer border-none" style={{ background: period === d ? '#fff' : 'transparent', color: period === d ? '#2a6fdb' : '#6b7689', boxShadow: period === d ? '0 1px 3px rgba(20,30,60,.12)' : 'none' }}>{d === 7 ? 'Week' : 'Month'}</button>
          ))}
        </div>
      } />

      <div className="flex gap-2 mb-4 lg:max-w-md">
        {(['branches', 'students', 'teachers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 text-[12.5px] font-bold py-2.5 rounded-[12px] cursor-pointer border capitalize" style={{ background: tab === t ? '#2a6fdb' : '#fff', color: tab === t ? '#fff' : '#3a4456', borderColor: tab === t ? '#2a6fdb' : '#e6eaf2' }}>{t}</button>
        ))}
      </div>

      {tab === 'teachers' ? (
        !teacherActivity ? (
          <div className="text-center text-td-muted text-sm py-12">Loading activity…</div>
        ) : teacherActivity.length === 0 ? (
          <div className="text-center text-td-muted text-sm py-10 bg-white border border-td-border rounded-[16px]">No approved staff yet.</div>
        ) : (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3">
            <div className="text-[12px] text-td-muted mb-1 lg:col-span-full">What each staff member logged in the last 7 days.</div>
            {teacherActivity.map(t => (
              <div key={t.email + t.name} className="bg-white border border-td-border rounded-[18px] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[14.5px] font-extrabold text-td-dark">{t.name || t.email}</div>
                    <div className="text-[11.5px] text-td-muted">{t.email}</div>
                  </div>
                  <span className="text-[10.5px] font-bold py-[5px] px-2.5 rounded-[20px]" style={{ color: t.is_head ? '#2a6fdb' : '#2fa36b', background: t.is_head ? '#eaf1fc' : '#e7f5ee' }}>{t.is_head ? 'Head' : 'Teacher'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { v: t.attendance_marks, l: 'Attendance' },
                    { v: t.tests_entered, l: 'Results' },
                    { v: t.assignments_created, l: 'Assignments' },
                  ].map(x => (
                    <div key={x.l} className="bg-[#f7f9fc] rounded-[12px] py-2.5">
                      <div className="text-[18px] font-extrabold text-td-dark leading-none">{x.v}</div>
                      <div className="text-[10.5px] text-td-muted mt-1 font-semibold">{x.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="text-[11px] text-td-subtle text-center leading-relaxed mt-1 lg:col-span-full">Activity is counted from when staff started using the app — older records aren&apos;t attributed.</div>
          </div>
        )
      ) : tab === 'students' ? (
        !studentReports ? (
          <div className="text-center text-td-muted text-sm py-12">Generating reports…</div>
        ) : studentReports.length === 0 ? (
          <div className="text-center text-td-muted text-sm py-10 bg-white border border-td-border rounded-[16px]">No students yet.</div>
        ) : (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3">
            <div className="text-[12px] text-td-muted mb-1 lg:col-span-full">Send each parent their child&apos;s weekly progress.</div>
            {studentReports.map(s => {
              const attPct = s.att_total > 0 ? Math.round((s.att_present / s.att_total) * 100) : null
              return (
                <div key={s.name + s.klass} className="bg-white border border-td-border rounded-[18px] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-[14.5px] font-extrabold text-td-dark">{s.name}</div>
                      <div className="text-[11.5px] text-td-muted">{s.klass}</div>
                    </div>
                    <span className="text-[10.5px] font-bold py-[5px] px-[9px] rounded-[20px]" style={{ color: s.fee_status === 'Paid' ? '#2fa36b' : '#e0962f', background: s.fee_status === 'Paid' ? '#e7f5ee' : '#fcf3e3' }}>{s.fee_status}</span>
                  </div>
                  <div className="text-[12px] text-td-muted mb-3">Attendance: <span className="font-bold text-td-text">{attPct === null ? '—' : `${attPct}%`}</span> · Tests: <span className="font-bold text-td-text">{s.tests}{s.tests > 0 ? ` (avg ${s.avg_pct}%)` : ''}</span></div>
                  <button onClick={() => window.open(whatsappShareUrl(s.parent, studentReportMessage(s, centreName || undefined, period)), '_blank')} disabled={!s.parent} className="w-full border-none bg-[#25D366] text-white text-[13px] font-extrabold py-2.5 rounded-[12px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                    {s.parent ? 'Send to parent' : 'No parent number'}
                  </button>
                </div>
              )
            })}
          </div>
        )
      ) : !r ? (
        <div className="text-center text-td-muted text-sm py-12">Generating report…</div>
      ) : (
        <>
          <div className="text-[12.5px] text-td-muted mb-4">Last {period} days · as of {new Date(r.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>

          {r.branches.length === 0 ? (
            <div className="text-center text-td-muted text-sm py-8 bg-white border border-td-border rounded-[16px] mb-4">No branches configured yet — add branches and assign students to see per-branch numbers.</div>
          ) : (
            <div className="flex flex-col gap-3 mb-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
              {r.branches.map(b => (
                <div key={b.name} className="bg-white border border-td-border rounded-[18px] p-4">
                  <div className="text-[15px] font-extrabold text-td-dark mb-3">{b.name}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Students', value: `${b.students}${b.new_students ? ` (+${b.new_students})` : ''}` },
                      { label: 'Staff', value: String(b.staff) },
                      { label: 'Attendance', value: `${b.att_pct}%` },
                      { label: 'Fees collected', value: inr(b.fees_collected) },
                      { label: 'Fees pending', value: inr(b.fees_pending) },
                    ].map(s => (
                      <div key={s.label}>
                        <div className="text-[17px] font-extrabold text-td-dark leading-none">{s.value}</div>
                        <div className="text-[11px] text-td-muted mt-1 font-semibold">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-[#f4f6fb] border border-[#e6eaf2] rounded-[14px] p-3.5 text-[12.5px] text-td-muted mb-4 lg:max-w-xl">
            {r.unassigned_students > 0 && <div>Unassigned students: <span className="font-bold text-td-text">{r.unassigned_students}</span></div>}
            <div>Tests conducted this {period === 7 ? 'week' : 'month'}: <span className="font-bold text-td-text">{r.tests_this_week}</span></div>
          </div>

          <button onClick={() => window.open(whatsappShareUrl(myPhone, weeklyReportMessage(r, centreName || undefined, period)), '_blank')} className="w-full lg:max-w-md border-none bg-[#25D366] text-white text-[14px] font-extrabold py-[14px] rounded-[14px] cursor-pointer flex items-center justify-center gap-2">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
            Send to WhatsApp
          </button>
          <div className="text-[11.5px] text-td-subtle text-center mt-3 leading-relaxed">Opens WhatsApp with the report ready to send to yourself or a co-owner.</div>
        </>
      )}
    </div>
  )
}
```

## app/components/AuthScreens.tsx

```ts
'use client'

import { useState, useEffect } from 'react'
import { useDashboard } from '../store'
import { supabase } from '../lib/supabase'
import { PrimaryButton } from './Shell'

const LOGO = (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/icon-512.png" alt="Second Skool" width={72} height={72} className="rounded-[18px] object-cover shadow-[0_2px_10px_rgba(20,30,60,.12)]" />
)

const CLASS_OPTIONS = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12']

export function LoginScreen() {
  const { authLoading, notify, loadStudentByCode, stuSignup, setStuSignup, studentSignup } = useDashboard()
  const [mode, setMode] = useState<'choose' | 'student' | 'register'>('choose')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) notify('Google sign-in failed')
  }

  const submitCode = async () => {
    if (busy) return
    setBusy(true)
    await loadStudentByCode(code)
    setBusy(false)
  }

  const submitSignup = async () => {
    if (busy) return
    setBusy(true)
    await studentSignup()
    setBusy(false)
  }

  if (authLoading) {
    return (
      <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col items-center justify-center">
        <div className="animate-pulse mb-4">{LOGO}</div>
        <div className="text-sm text-td-muted font-semibold">Loading...</div>
      </div>
    )
  }

  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col">
      {LOGO}
      <div className="text-[26px] font-extrabold text-td-dark tracking-tight mt-[22px]">Second Skool</div>

      {mode === 'choose' && (
        <>
          <div className="text-sm text-td-muted mt-2 leading-relaxed">Teachers sign in with Google. Students tap below and enter the code their teacher gave them — no account needed.</div>

          <button onClick={signInWithGoogle} className="w-full border border-[#dfe3ea] bg-white rounded-[14px] p-3.5 mt-8 flex items-center justify-center gap-[11px] cursor-pointer shadow-[0_1px_2px_rgba(20,30,60,.06)]">
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C3 17.3 2.2 20.6 2.2 24s.8 6.7 2.3 9.9l7.3-5.7z"/><path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"/></svg>
            <span className="text-[14.5px] font-bold text-td-text">Teacher — continue with Google</span>
          </button>

          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 h-px bg-[#e6eaf2]" />
            <span className="text-[11.5px] text-td-subtle font-semibold">or</span>
            <div className="flex-1 h-px bg-[#e6eaf2]" />
          </div>

          <button onClick={() => setMode('student')} className="w-full text-left border border-td-border rounded-[18px] p-[18px] mt-5 flex items-center gap-[15px] cursor-pointer bg-white">
            <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center bg-[#e7f5ee]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2fa36b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></svg>
            </div>
            <div className="flex-1">
              <div className="text-base font-extrabold text-td-dark">I&apos;m a student</div>
              <div className="text-[12.5px] text-td-muted mt-[3px]">Enter your code to see your updates</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c2cad8" strokeWidth="2.4" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>

          <div className="mt-auto text-[11.5px] text-td-subtle text-center leading-relaxed pt-6">Your tuition centre sets up teacher access. Students only ever need their code.</div>
        </>
      )}

      {mode === 'student' && (
        <>
          <div className="text-sm text-td-muted mt-2 leading-relaxed">Enter the code your teacher gave you. We&apos;ll remember it on this device.</div>
          <input
            autoFocus value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submitCode()}
            placeholder="e.g. TUT-7X2K9Q"
            className="w-full border border-td-border rounded-[14px] p-[15px] text-base text-td-dark outline-none focus:border-td-primary text-center tracking-[0.2em] font-bold mt-7"
          />
          <button onClick={submitCode} disabled={busy} className="w-full border-none bg-td-primary text-white text-[15px] font-extrabold py-[15px] rounded-2xl cursor-pointer mt-3 disabled:opacity-60">
            {busy ? 'Checking…' : 'View my updates'}
          </button>
          <button onClick={() => setMode('register')} className="w-full border border-td-border rounded-[14px] py-[13px] cursor-pointer bg-white text-[13.5px] font-bold text-td-primary mt-3">New here? Register yourself</button>
          <button onClick={() => { setMode('choose'); setCode('') }} className="w-full border-none bg-transparent text-td-muted text-[13px] font-bold py-3 cursor-pointer mt-1">Back</button>
          <div className="mt-auto text-[11.5px] text-td-subtle text-center leading-relaxed pt-6">Don&apos;t have a code? Register with your centre code and your teacher will approve you.</div>
        </>
      )}

      {mode === 'register' && (
        <>
          <div className="text-sm text-td-muted mt-2 leading-relaxed">Fill in your details. Your teacher reviews and approves them, then your code goes live.</div>
          <div className="flex flex-col gap-3 mt-6">
            <div>
              <label className="text-xs font-bold text-td-muted">Student code <span className="text-[#e8553c]">*</span></label>
              <input value={stuSignup.joinCode} onChange={e => setStuSignup({ joinCode: e.target.value.toUpperCase() })} placeholder="e.g. 7X2K9Q" className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-1.5 tracking-[0.15em] font-bold text-center" />
              <div className="text-[11px] text-td-subtle mt-1">The code your teacher shared with you to register.</div>
            </div>
            <div>
              <label className="text-xs font-bold text-td-muted">Full name <span className="text-[#e8553c]">*</span></label>
              <input value={stuSignup.name} onChange={e => setStuSignup({ name: e.target.value })} placeholder="Your full name" className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-1.5" />
            </div>
            <div>
              <label className="text-xs font-bold text-td-muted">Parent&apos;s phone <span className="text-[#e8553c]">*</span></label>
              <input value={stuSignup.parent} onChange={e => setStuSignup({ parent: e.target.value })} inputMode="tel" placeholder="e.g. +91 98765 43210" className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-1.5" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-bold text-td-muted">Class <span className="text-[#e8553c]">*</span></label>
                <select value={stuSignup.klass} onChange={e => setStuSignup({ klass: e.target.value })} className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-1.5 bg-white">
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-td-muted">School <span className="text-[#e8553c]">*</span></label>
                <input value={stuSignup.school} onChange={e => setStuSignup({ school: e.target.value })} placeholder="Your school" className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-1.5" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-td-muted">Address <span className="text-td-subtle font-semibold">(optional)</span></label>
              <input value={stuSignup.address} onChange={e => setStuSignup({ address: e.target.value })} placeholder="Home address" className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-1.5" />
            </div>
          </div>
          <button onClick={submitSignup} disabled={busy} className="w-full border-none bg-td-primary text-white text-[15px] font-extrabold py-[15px] rounded-2xl cursor-pointer mt-4 disabled:opacity-60">{busy ? 'Submitting…' : 'Submit for approval'}</button>
          <button onClick={() => setMode('student')} className="w-full border-none bg-transparent text-td-muted text-[13px] font-bold py-3 cursor-pointer mt-1">I already have a code</button>
        </>
      )}
    </div>
  )
}

// Shown after a student self-registers (or when a returning pending student
// opens the app). Polls their snapshot; the moment the head approves, the
// snapshot flips to 'approved' and routes them straight into the dashboard.
export function StuPendingScreen() {
  const { stuPending, signOut, loadStudentByCode, notify } = useDashboard()
  const [busy, setBusy] = useState(false)
  const code = stuPending?.code || (typeof window !== 'undefined' ? localStorage.getItem('student_code') ?? '' : '')

  useEffect(() => {
    if (!code) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') loadStudentByCode(code, false)
    }, 15000)
    return () => clearInterval(id)
  }, [code, loadStudentByCode])

  const checkNow = async () => {
    if (busy || !code) return
    setBusy(true)
    const ok = await loadStudentByCode(code, true)
    setBusy(false)
    if (!ok) notify('Still awaiting approval — hang tight')
  }

  const copyCode = () => {
    if (!code) return
    navigator.clipboard?.writeText(code).then(() => notify('Code copied'), () => {})
  }

  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col items-center justify-center text-center">
      <div className="w-[72px] h-[72px] rounded-[22px] bg-[#fcf3e3] flex items-center justify-center mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e0962f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
      </div>
      <div className="text-[20px] font-extrabold text-td-dark">You&apos;re on the list{stuPending?.name ? `, ${stuPending.name.split(' ')[0]}` : ''}!</div>
      <div className="text-sm text-td-muted mt-2 leading-relaxed max-w-[300px]">Your teacher{stuPending?.centre ? ` at ${stuPending.centre}` : ''} is reviewing your details. You&apos;ll get in the moment they approve you.</div>

      {code && (
        <button onClick={copyCode} className="mt-6 border border-td-border rounded-[14px] px-5 py-3 bg-white cursor-pointer">
          <div className="text-[11px] font-bold text-td-subtle uppercase tracking-wide">Your code — save it</div>
          <div className="text-lg font-extrabold text-td-dark tracking-[0.15em] mt-1">{code}</div>
        </button>
      )}

      <button onClick={checkNow} disabled={busy} className="border-none bg-td-primary text-white text-[14px] font-extrabold py-[13px] px-8 rounded-2xl cursor-pointer mt-6 disabled:opacity-60">{busy ? 'Checking…' : 'Check approval'}</button>
      <button onClick={signOut} className="text-[12.5px] text-td-muted font-bold py-3 cursor-pointer border-none bg-transparent mt-2">Use a different code</button>
    </div>
  )
}

export function RegisterScreen() {
  const { googleEmail, createCentre, joinCentre, signOut } = useDashboard()
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [centreName, setCentreName] = useState('')
  const [code, setCode] = useState('')

  const run = async (fn: () => Promise<void>) => { setBusy(true); await fn(); setBusy(false) }

  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col">
      {LOGO}
      <div className="text-[24px] font-extrabold text-td-dark tracking-tight mt-[22px]">Set up your access</div>
      <div className="text-sm text-td-muted mt-2 leading-relaxed">Signed in as <span className="font-bold text-td-text">{googleEmail}</span>.</div>

      {mode === 'choose' && (
        <div className="flex flex-col gap-[13px] mt-7">
          <button onClick={() => setMode('create')} className="text-left border rounded-[20px] p-[18px] flex items-center gap-[15px] cursor-pointer bg-white" style={{ borderColor: '#dbe6fa' }}>
            <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center bg-td-dark">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <div className="flex-1">
              <div className="text-base font-extrabold text-td-dark">Create a centre</div>
              <div className="text-[12.5px] text-td-muted mt-[3px]">Start your own — you&apos;ll be the head teacher.</div>
            </div>
          </button>
          <button onClick={() => setMode('join')} className="text-left border rounded-[20px] p-[18px] flex items-center gap-[15px] cursor-pointer bg-white" style={{ borderColor: '#e6eaf2' }}>
            <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center bg-[#eaf1fc]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            </div>
            <div className="flex-1">
              <div className="text-base font-extrabold text-td-dark">Join a centre</div>
              <div className="text-[12.5px] text-td-muted mt-[3px]">As a teacher, with your centre&apos;s join code.</div>
            </div>
          </button>
        </div>
      )}

      {mode === 'create' && (
        <div className="mt-7 flex flex-col gap-3">
          <label className="text-xs font-bold text-td-muted">Centre name</label>
          <input autoFocus value={centreName} onChange={e => setCentreName(e.target.value)} placeholder="e.g. Bright Future Tuition" className="w-full border border-td-border rounded-[14px] p-[14px] text-sm text-td-dark outline-none focus:border-td-primary" />
          <PrimaryButton onClick={() => centreName.trim().length >= 2 ? run(() => createCentre(centreName)) : undefined}>{busy ? 'Creating…' : 'Create centre'}</PrimaryButton>
          <button onClick={() => setMode('choose')} className="text-[13px] text-td-muted font-bold py-2 cursor-pointer border-none bg-transparent">Back</button>
        </div>
      )}

      {mode === 'join' && (
        <div className="mt-7 flex flex-col gap-3">
          <label className="text-xs font-bold text-td-muted">Centre join code</label>
          <input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. 7X2K9Q" className="w-full border border-td-border rounded-[14px] p-[14px] text-sm text-td-dark outline-none focus:border-td-primary text-center tracking-[0.2em] font-bold" />
          <PrimaryButton onClick={() => code.trim().length >= 4 ? run(() => joinCentre(code)) : undefined}>{busy ? 'Joining…' : 'Join centre'}</PrimaryButton>
          <div className="text-[12px] text-td-subtle leading-relaxed">Ask your head teacher for the centre&apos;s join code. You&apos;ll get access once they approve you.</div>
          <button onClick={() => setMode('choose')} className="text-[13px] text-td-muted font-bold py-2 cursor-pointer border-none bg-transparent">Back</button>
        </div>
      )}

      <button onClick={signOut} className="mt-auto text-[12.5px] text-td-muted font-bold py-3 cursor-pointer border-none bg-transparent">Sign out</button>
    </div>
  )
}

export function PendingScreen() {
  const { googleEmail, signOut } = useDashboard()

  // Auto-advance the moment the head teacher approves — no manual refresh.
  // Falls back gracefully to the "Check again" button if Realtime is off.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      channel = supabase
        .channel('approval-watch')
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          () => window.location.reload())
        .subscribe()
    })
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col items-center justify-center text-center">
      <div className="w-[72px] h-[72px] rounded-[22px] bg-[#fcf3e3] flex items-center justify-center mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e0962f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
      </div>
      <div className="text-[20px] font-extrabold text-td-dark">Waiting for approval</div>
      <div className="text-sm text-td-muted mt-2 leading-relaxed max-w-[300px]">Your head teacher needs to approve <span className="font-bold text-td-text">{googleEmail}</span> before you can start. You&apos;ll get in as soon as they do.</div>
      <button onClick={() => window.location.reload()} className="border-none bg-td-primary text-white text-[14px] font-extrabold py-[13px] px-8 rounded-2xl cursor-pointer mt-7">Check again</button>
      <button onClick={signOut} className="text-[12.5px] text-td-muted font-bold py-3 cursor-pointer border-none bg-transparent mt-2">Sign out</button>
    </div>
  )
}

export function DeniedScreen() {
  const { signOut, joinCentre } = useDashboard()
  const [mode, setMode] = useState<'view' | 'join'>('view')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (busy || code.trim().length < 4) return
    setBusy(true)
    await joinCentre(code)
    setBusy(false)
  }
  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col items-center justify-center text-center">
      <div className="w-[72px] h-[72px] rounded-[22px] bg-[#fdecea] flex items-center justify-center mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e8553c" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>
      </div>
      <div className="text-[20px] font-extrabold text-td-dark">Access not granted</div>

      {mode === 'view' && (
        <>
          <div className="text-sm text-td-muted mt-2 leading-relaxed max-w-[300px]">This account isn&apos;t part of a centre yet. Enter a join code to request access, or sign out and use a student code instead.</div>
          <button onClick={() => setMode('join')} className="border-none bg-td-primary text-white text-[14px] font-extrabold py-[13px] px-8 rounded-2xl cursor-pointer mt-7">Enter a join code</button>
          <button onClick={signOut} className="text-[12.5px] text-td-muted font-bold py-3 cursor-pointer border-none bg-transparent mt-2">Sign out</button>
        </>
      )}

      {mode === 'join' && (
        <div className="w-full max-w-[300px] mt-6 flex flex-col gap-3">
          <input
            autoFocus value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="e.g. 7X2K9Q"
            className="w-full border border-td-border rounded-[14px] p-[14px] text-sm text-td-dark outline-none focus:border-td-primary text-center tracking-[0.2em] font-bold"
          />
          <button onClick={submit} disabled={busy} className="w-full border-none bg-td-primary text-white text-[15px] font-extrabold py-[14px] rounded-2xl cursor-pointer disabled:opacity-60">{busy ? 'Requesting…' : 'Request access'}</button>
          <div className="text-[12px] text-td-subtle leading-relaxed">Ask your head teacher for the centre&apos;s join code. You&apos;ll get in once they approve you.</div>
          <button onClick={() => { setMode('view'); setCode('') }} className="text-[13px] text-td-muted font-bold py-2 cursor-pointer border-none bg-transparent">Back</button>
        </div>
      )}
    </div>
  )
}
```

## app/components/DesktopShell.tsx

```ts
'use client'

import { useEffect, useState } from 'react'
import { useDashboard, initials, type Screen, type Tab } from '../store'

// Desktop breakpoint (lg). Starts false so SSR/hydration match the phone
// layout; the media query resolves during the auth-loading phase, well before
// any staff screen paints, so there is no visible flash on a laptop.
export function useIsDesktop() {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return desktop
}

type NavItem = { icon: string; label: string; screen: Screen; tab?: Tab; active?: Screen[]; badge?: number }

function NavRow({ item }: { item: NavItem }) {
  const { screen, go } = useDashboard()
  const on = screen === item.screen || (item.active?.includes(screen) ?? false)
  return (
    <button
      onClick={() => go(item.screen, item.tab)}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-[13px] cursor-pointer transition-colors ${
        on ? 'bg-[#eaf1fc] text-td-primary' : 'text-td-text hover:bg-[#f4f6fb]'
      }`}
    >
      <span className="w-[30px] h-[30px] rounded-[9px] bg-white border border-td-border flex items-center justify-center text-[15px] shrink-0">{item.icon}</span>
      <span className={`flex-1 text-[13.5px] ${on ? 'font-extrabold' : 'font-bold'}`}>{item.label}</span>
      {!!item.badge && item.badge > 0 && (
        <span className="text-[11px] font-extrabold text-white bg-td-red rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">{item.badge}</span>
      )}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-extrabold text-td-muted uppercase tracking-wide px-3 mt-5 mb-1.5">{children}</div>
}

function Sidebar() {
  const { role, go, signOut, centreName, centreLogo, myName, googleEmail, staffList, pendingStudents, loadMyCentre } = useDashboard()
  const isAdmin = role === 'admin'
  useEffect(() => { if (!centreName) loadMyCentre() }, [centreName, loadMyCentre])
  const name = myName || googleEmail?.split('@')[0] || (isAdmin ? 'Head teacher' : 'Teacher')
  const pending = staffList.filter(s => s.status === 'pending').length
  const stuReq = pendingStudents.length

  const main: NavItem[] = [
    { icon: '🏠', label: 'Dashboard', screen: 'home', tab: 'home' },
    { icon: '📅', label: 'Timetable', screen: 'timetable', tab: 'timetable' },
    { icon: '👥', label: 'Students', screen: 'students', tab: 'students', active: ['addStudent', 'editStudent'] },
    ...(isAdmin ? [{ icon: '🧑‍🏫', label: 'Staff', screen: 'teachers' as Screen, tab: 'teachers' as Tab, active: ['addTeacher' as Screen] }] : []),
  ]
  const teaching: NavItem[] = [
    { icon: '✅', label: 'Attendance', screen: 'attendance' },
    { icon: '📊', label: 'Results', screen: 'results' },
    { icon: '📚', label: 'Homework', screen: 'assign' },
    { icon: '📄', label: 'Study material', screen: 'notes' },
    { icon: '🔔', label: 'Reminders', screen: 'reminder' },
  ]
  const manage: NavItem[] = [
    { icon: '🛡️', label: 'Approvals', screen: 'staffApprovals', badge: pending },
    { icon: '🙋', label: 'Student requests', screen: 'studentRequests', badge: stuReq },
    { icon: '📈', label: 'Reports', screen: 'reports' },
    { icon: '💳', label: 'Fees', screen: 'fees' },
    { icon: '🏆', label: 'Rankings', screen: 'rankings' },
    { icon: '📆', label: 'Meetings', screen: 'meetings' },
    { icon: '🏢', label: 'Branches', screen: 'branches' },
    { icon: '📖', label: 'Subjects', screen: 'subjects' },
  ]

  return (
    <aside className="w-[248px] shrink-0 h-[100dvh] sticky top-0 bg-white border-r border-td-border flex flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-4">
        {centreLogo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={centreLogo} alt={centreName || 'Centre'} className="w-9 h-9 rounded-[11px] object-cover shrink-0" />
          : <div className="w-9 h-9 rounded-[11px] flex items-center justify-center text-white font-extrabold text-[15px] shrink-0" style={{ background: 'linear-gradient(135deg,#2a6fdb,#5a93ef)' }}>S</div>}
        <div className="min-w-0">
          <div className="text-[14.5px] font-extrabold text-td-dark truncate">{centreName || 'Second Skool'}</div>
          <div className="text-[11px] text-td-muted font-semibold">{isAdmin ? 'Head teacher' : 'Teacher'}</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-3">
        {main.map(i => <NavRow key={i.screen} item={i} />)}
        <SectionLabel>Teaching</SectionLabel>
        {teaching.map(i => <NavRow key={i.screen} item={i} />)}
        {isAdmin && (
          <>
            <SectionLabel>Management</SectionLabel>
            {manage.map(i => <NavRow key={i.screen} item={i} />)}
          </>
        )}
      </nav>

      <div className="border-t border-td-border p-3">
        <button onClick={() => go('staffProfile')} className="w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-[12px] hover:bg-[#f4f6fb] cursor-pointer mb-1">
          <div className="w-9 h-9 rounded-[11px] flex items-center justify-center text-white font-bold text-[13px] shrink-0" style={{ background: 'linear-gradient(135deg,#2a6fdb,#5a93ef)' }}>{initials(name)}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-extrabold text-td-dark truncate">{name}</div>
            <div className="text-[11px] text-td-muted truncate">{googleEmail}</div>
          </div>
        </button>
        <button onClick={signOut} className="w-full border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[13px] font-extrabold py-2.5 rounded-[12px] cursor-pointer flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e8553c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}

function DesktopToast() {
  const toast = useDashboard(s => s.toast)
  if (!toast) return null
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-8 bg-td-dark text-white py-3.5 px-5 rounded-[14px] text-sm font-semibold text-center z-50 shadow-[0_14px_36px_rgba(0,0,0,.28)] animate-[toastIn_.25s_ease]">
      {toast}
    </div>
  )
}

export function DesktopShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-[#f6f8fc]">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto h-[100dvh]">
        <div className="max-w-[1180px] mx-auto w-full px-8 py-7 td-desktop">{children}</div>
      </main>
      <DesktopToast />
    </div>
  )
}

// Desktop shell for the pre-app screens (login / register / pending / denied).
// A split brand panel + a centered auth card, so a laptop never shows the tiny
// phone mockup floating in grey. The auth screens render unchanged inside.
const AUTH_FEATURES = [
  'Mark attendance & publish results in seconds',
  'Track fees and notify parents automatically',
  'Live rankings, reports and timetables — every branch',
]

export function DesktopAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] bg-white overflow-hidden">
      <aside className="hidden lg:flex flex-col justify-between w-[46%] max-w-[640px] p-14 text-white relative overflow-hidden" style={{ background: 'linear-gradient(150deg,#2a6fdb 0%,#1f56ad 58%,#173f88 100%)' }}>
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-[-6rem] left-[-4rem] w-72 h-72 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-512.png" alt="Second Skool" width={42} height={42} className="rounded-[12px] object-cover shadow-[0_2px_10px_rgba(0,0,0,.18)]" />
          <span className="text-[19px] font-extrabold tracking-tight">Second Skool</span>
        </div>

        <div className="relative">
          <h1 className="text-[38px] font-extrabold leading-[1.12] tracking-tight">Run your whole tuition centre from one screen.</h1>
          <p className="text-[15px] text-white/80 mt-5 max-w-[430px] leading-relaxed">Attendance, results, fees and parent updates — for every branch, every teacher, every student.</p>
          <ul className="mt-9 flex flex-col gap-[18px]">
            {AUTH_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-3.5">
                <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5"/></svg>
                </span>
                <span className="text-[14.5px] font-semibold text-white/95">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-[12.5px] text-white/60">Built for tuition centres to stay organised every day.</div>
      </aside>

      <main className="flex-1 flex items-center justify-center overflow-y-auto h-[100dvh] bg-[#f6f8fc] lg:bg-white px-5 py-8">
        <div className="w-full max-w-[440px] bg-white rounded-[28px] shadow-[0_18px_50px_-24px_rgba(20,30,60,.28)] lg:shadow-none lg:rounded-none">
          {children}
        </div>
      </main>
      <DesktopToast />
    </div>
  )
}
```

## app/components/ErrorBoundary.tsx

```ts
'use client'

import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface EState { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, EState> {
  state: EState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('App error:', error.message)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f4f6fb] p-6">
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 rounded-[20px] bg-[#fdecea] flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e8553c" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="0.5" fill="#e8553c"/></svg>
            </div>
            <div className="text-lg font-extrabold text-[#1a2332] mb-2">Something went wrong</div>
            <div className="text-sm text-[#6b7689] mb-5 leading-relaxed">{this.state.error?.message ?? 'An unexpected error occurred.'}</div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-[#2a6fdb] text-white text-sm font-bold py-3 px-8 rounded-2xl border-none cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
```

## app/components/HomeScreen.tsx

```ts
'use client'

import { useDashboard, initials, type Screen } from '../store'

export function HomeScreen() {
  const { role, go, schedule, students, branchesList, googleEmail, myName } = useDashboard()
  const isAdmin = role === 'admin'
  const mainBranch = branchesList.find(b => b.main) ?? branchesList[0]
  const displayName = myName || googleEmail?.split('@')[0] || (isAdmin ? 'Admin' : 'Teacher')
  const ini = initials(displayName)

  // Home = the four quick daily shortcuts (same for head and teacher, clean
  // grid). Timetable is a bottom tab; Study material + all management (fees,
  // rankings, meetings, branches, subjects, reports, staff) live in More.
  const quickActions: { icon: string; label: string; tint: string; screen: Screen; tab?: string }[] = [
    { icon: '✅', label: 'Attendance', tint: '#e7f5ee', screen: 'attendance' },
    { icon: '📊', label: 'Results', tint: '#eaf1fc', screen: 'results' },
    { icon: '📚', label: 'Assignment', tint: '#fcf3e3', screen: 'assign' },
    { icon: '🔔', label: 'Reminder', tint: '#fdecea', screen: 'reminder' },
  ]

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-[46px] h-[46px] rounded-2xl flex items-center justify-center text-white font-extrabold text-[17px]" style={{ background: 'linear-gradient(135deg,#2a6fdb,#5a93ef)' }}>{ini}</div>
          <div>
            <div className="text-xs text-td-muted font-semibold">{isAdmin ? 'Head Teacher' : 'Teacher'}</div>
            <div className="text-[17px] font-extrabold text-td-dark">{displayName}</div>
          </div>
        </div>
        <div className="w-[42px] h-[42px] rounded-[14px] border border-td-border bg-white flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a2332" strokeWidth="2" strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        </div>
      </div>

      {isAdmin ? (
        <button onClick={() => go('branches')} className="inline-flex items-center gap-[7px] bg-white border border-td-border rounded-[20px] py-[7px] px-[13px] mb-[18px] cursor-pointer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
          <span className="text-[12.5px] font-semibold text-td-text">{mainBranch?.name ?? 'No branch'}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9aa4b6" strokeWidth="2.4" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      ) : mainBranch ? (
        <div className="inline-flex items-center gap-[7px] bg-white border border-td-border rounded-[20px] py-[7px] px-[13px] mb-[18px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
          <span className="text-[12.5px] font-semibold text-td-text">{mainBranch.name}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 mb-3.5 lg:max-w-md">
        <div className="rounded-[18px] p-3.5 text-white" style={{ background: 'linear-gradient(135deg,#2a6fdb,#3f82ec)' }}>
          <div className="text-2xl font-extrabold leading-none">{schedule.length}</div>
          <div className="text-[11px] opacity-85 mt-1.5 font-semibold">Classes today</div>
        </div>
        <div className="bg-white border border-td-border rounded-[18px] p-3.5">
          <div className="text-2xl font-extrabold leading-none text-td-dark">{students.length}</div>
          <div className="text-[11px] text-td-muted mt-1.5 font-semibold">Students</div>
        </div>
      </div>

      <div className="text-base font-extrabold text-td-dark mb-[13px]">Quick actions</div>
      <div className="grid grid-cols-4 gap-[11px] mb-[26px] lg:max-w-2xl">
        {quickActions.map(a => (
          <button key={a.label} onClick={() => go(a.screen, (a.tab || 'home') as never)} className="border border-td-border bg-white rounded-[18px] py-3 px-1.5 cursor-pointer flex flex-col items-center gap-[7px]">
            <div className="w-[42px] h-[42px] rounded-[13px] flex items-center justify-center text-xl" style={{ background: a.tint }}>{a.icon}</div>
            <span className="text-[10.5px] font-bold text-td-text text-center leading-tight">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="text-base font-extrabold text-td-dark mb-[13px]">Today&apos;s schedule</div>
      {schedule.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No classes scheduled for today</div>
      ) : (
        <div className="flex flex-col gap-2.5 mb-[26px] lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {schedule.map((c, i) => (
            <div key={i} className="flex items-center gap-[13px] bg-white border border-td-border rounded-[18px] py-3.5 px-[15px]">
              <div className="text-center shrink-0 w-[52px]">
                <div className="text-sm font-extrabold text-td-primary">{c.time}</div>
                <div className="text-[10px] text-td-subtle font-semibold">{c.ampm}</div>
              </div>
              <div className="w-px h-[34px] bg-[#eef1f7]" />
              <div className="flex-1">
                <div className="text-[13.5px] font-bold text-td-dark">{c.subject}</div>
                <div className="text-xs text-td-muted mt-0.5">{c.klass} · {c.room}</div>
              </div>
              <span className="text-[11px] font-bold py-[5px] px-2.5 rounded-[20px]" style={{ color: c.statusColor, background: c.statusBg }}>{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

## app/components/NotesScreens.tsx

```ts
'use client'

import { useState, useEffect } from 'react'
import { useDashboard } from '../store'
import { ScreenHeader, PrimaryButton } from './Shell'
import { uploadNoteFile } from '../lib/upload'

const FileIcon = ({ url }: { url: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={url ? '#2a6fdb' : '#c2cad8'} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
)

// --- Staff: create & manage class notes ------------------------------------
export function NotesScreen() {
  const { back, subjects, notesList, loadNotes, addNote, deleteNote, notify, students } = useDashboard()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [klass, setKlass] = useState('')
  const classes = [...new Set(students.map(s => s.klass))].filter(Boolean)
  const selKlass = klass || classes[0] || ''
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { loadNotes() }, [loadNotes])

  const reset = () => { setTitle(''); setSubject(''); setBody(''); setLink(''); setFile(null); setShowForm(false) }

  const save = async () => {
    if (!title.trim()) { notify('Enter a title'); return }
    if (!selKlass) { notify('Add students first'); return }
    setBusy(true)
    let fileUrl = ''
    if (file) {
      const res = await uploadNoteFile(file)
      if (res.error) { notify(res.error); setBusy(false); return }
      fileUrl = res.url ?? ''
    }
    await addNote({ title, subject, klass: selKlass, body, fileUrl, linkUrl: link })
    setBusy(false); reset()
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Study Material" onBack={back} right={
        <button onClick={() => setShowForm(f => !f)} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
          <span className="text-base leading-none">{showForm ? '×' : '+'}</span> {showForm ? 'Close' : 'Share'}
        </button>
      } />

      {showForm && (
        <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 5 — Trigonometry notes" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <div className="grid grid-cols-2 gap-[11px]">
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Subject</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
                <option value="">General</option>
                {subjects.map(s => <option key={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Class</label>
              <select value={selKlass} onChange={e => setKlass(e.target.value)} disabled={classes.length === 0} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none disabled:opacity-60">
                {classes.length ? classes.map(c => <option key={c}>{c}</option>) : <option value="">Add students first</option>}
              </select>
            </div>
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Note <span className="text-td-subtle font-semibold">· type here (free)</span></label><textarea rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder="Write the note, or leave blank if attaching a file/link…" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none resize-none focus:border-td-primary" /></div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Attach PDF/image <span className="text-td-subtle font-semibold">· optional, max 10 MB</span></label>
            <input type="file" accept="application/pdf,image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} className="w-full text-[12.5px] text-td-muted file:mr-3 file:py-2 file:px-3 file:rounded-[10px] file:border-none file:bg-[#eaf1fc] file:text-td-primary file:font-bold file:text-[12px]" />
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Video link <span className="text-td-subtle font-semibold">· optional (YouTube / Drive)</span></label><input value={link} onChange={e => setLink(e.target.value)} placeholder="https://youtu.be/…" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <PrimaryButton onClick={busy ? () => {} : save}>{busy ? 'Sharing…' : 'Share with class'}</PrimaryButton>
        </div>
      )}

      {notesList.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-10 leading-relaxed">No study material yet.<br />Tap Share to send notes to a class.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {notesList.map(n => (
            <div key={n.dbId} className="bg-white border border-td-border rounded-[18px] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-extrabold text-td-dark">{n.title}</div>
                  <div className="text-[11.5px] text-td-muted mt-0.5">{n.klass}{n.subject ? ` · ${n.subject}` : ''}</div>
                </div>
                <button onClick={() => n.dbId && deleteNote(n.dbId)} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[11.5px] font-bold py-1.5 px-3 rounded-[11px] cursor-pointer shrink-0">Remove</button>
              </div>
              {n.body && <div className="text-[13px] text-td-text leading-relaxed mt-2">{n.body}</div>}
              <div className="flex gap-2 mt-2.5">
                {n.fileUrl && <a href={n.fileUrl} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-td-primary flex items-center gap-1.5"><FileIcon url={n.fileUrl} /> File</a>}
                {n.linkUrl && <a href={n.linkUrl} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-td-primary flex items-center gap-1.5">▶ Video</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Student: view class study material -------------------------------------
export function StuNotesScreen() {
  const { go, stuNotes, loadStudentNotes } = useDashboard()
  // Opening the screen clears the "new material" badge on Home.
  useEffect(() => {
    loadStudentNotes()
    if (typeof window !== 'undefined') localStorage.setItem('notes_seen_at', String(Date.now()))
  }, [loadStudentNotes])

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Study Material" onBack={() => go('stuHome', 'stuHome')} />

      {stuNotes.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-12 leading-relaxed">No study material yet.<br />Notes your teacher shares will appear here.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuNotes.map((n, i) => (
            <div key={i} className="bg-white border border-td-border rounded-[18px] p-4">
              <div className="flex items-center gap-[11px]">
                <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-lg bg-[#eaf1fc]">📄</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-extrabold text-td-dark">{n.title}</div>
                  {n.subject && <div className="text-[11.5px] text-td-muted mt-0.5">{n.subject}</div>}
                </div>
              </div>
              {n.body && <div className="text-[13px] text-td-text leading-relaxed mt-2.5">{n.body}</div>}
              <div className="flex gap-2.5 mt-2.5">
                {n.fileUrl && <a href={n.fileUrl} target="_blank" rel="noreferrer" className="flex-1 text-center border border-td-primary text-td-primary text-[12.5px] font-bold py-2 rounded-[12px]">Open file</a>}
                {n.linkUrl && <a href={n.linkUrl} target="_blank" rel="noreferrer" className="flex-1 text-center border-none bg-[#e8553c] text-white text-[12.5px] font-bold py-2 rounded-[12px]">▶ Watch video</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

## app/components/PeopleScreens.tsx

```ts
'use client'

import { useDashboard, initials, av, feeColor, GRADIENTS } from '../store'
import { ScreenHeader, PrimaryButton, BackButton, ChevronRight } from './Shell'
import { whatsappShareUrl, studentCodeMessage } from '../lib/share'

export function StudentsScreen() {
  const { students, role, origin, back, go, goFrom, set, searchQuery } = useDashboard()
  const isAdmin = role === 'admin'
  const filtered = searchQuery ? students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())) : students

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6 td-wide">
      <div className="flex items-center justify-between mt-1.5 mb-4">
        <div className="flex items-center gap-3">
          {origin === 'admin' && <BackButton onClick={back} />}
          <div className="text-2xl font-extrabold text-td-dark">Students</div>
        </div>
        {isAdmin && (
          <button onClick={() => origin === 'admin' ? goFrom('addStudent', 'students', 'admin') : go('addStudent', 'students')} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
            <span className="text-base leading-none">+</span> Add
          </button>
        )}
      </div>

      <div className="flex items-center gap-2.5 bg-white border border-td-border rounded-[14px] p-[11px] px-3.5 mb-[18px] lg:max-w-md">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9aa4b6" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>
        <input value={searchQuery} onChange={e => set({ searchQuery: e.target.value })} placeholder="Search students..." className="flex-1 text-[13.5px] text-td-dark outline-none bg-transparent" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">{students.length === 0 ? 'No students added yet' : 'No results'}</div>
      ) : (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s, i) => {
            const idx = students.indexOf(s)
            const f = feeColor(s.feeStatus)
            return (
              <button key={s.id || i} disabled={!isAdmin} onClick={() => set({ editIndex: idx, screen: 'editStudent', tab: 'students', ...(origin === 'admin' ? { origin: 'admin' } : {}) })} className={`text-left bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px] ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}>
                <div className="w-[46px] h-[46px] rounded-[14px] shrink-0 flex items-center justify-center text-white font-bold text-[15px]" style={{ background: av(idx) }}>{initials(s.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-td-dark">{s.name}</div>
                  <div className="text-xs text-td-muted mt-0.5">{s.klass} · {s.attendance}% attendance</div>
                </div>
                {isAdmin && <span className="text-[10.5px] font-bold py-[5px] px-[9px] rounded-[20px]" style={{ color: f.c, background: f.b }}>{s.feeStatus}</span>}
                {isAdmin && <ChevronRight />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function EditStudentScreen() {
  const { students, editIndex, origin, go, goFrom, setStudentField, deleteStudent, notify } = useDashboard()
  const st = students[editIndex]
  if (!st) return <div className="p-5 text-center text-td-muted">No student selected</div>

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Edit Student" onBack={() => origin === 'admin' ? goFrom('students', 'students', 'admin') : go('students', 'students')} right={
        <button onClick={deleteStudent} className="border-none bg-[#fdecea] text-td-red text-[12.5px] font-bold py-[9px] px-[13px] rounded-[13px] cursor-pointer">Remove</button>
      } />

      <div className="flex items-center gap-3.5 mb-3">
        <div className="w-16 h-16 rounded-[18px] shrink-0 flex items-center justify-center text-white font-extrabold text-[22px]" style={{ background: av(editIndex) }}>{initials(st.name)}</div>
        <div>
          <div className="text-[17px] font-extrabold text-td-dark">{st.name}</div>
          <div className="text-[12.5px] text-td-muted mt-0.5">{st.klass}</div>
        </div>
      </div>

      <button onClick={() => { navigator.clipboard.writeText(st.id); notify('Code copied!') }} className="w-full border border-dashed border-td-primary bg-[#eaf1fc] rounded-[14px] p-3 mb-2.5 cursor-pointer flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold text-td-muted">STUDENT LINK CODE</div>
          <div className="text-[18px] font-extrabold text-td-primary tracking-wider">{st.id}</div>
        </div>
        <div className="text-[11px] font-bold text-td-primary flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </div>
      </button>
      <button onClick={() => window.open(whatsappShareUrl(st.parent, studentCodeMessage(st.name, st.id)), '_blank')} className="w-full border-none bg-[#25D366] text-white text-[13px] font-extrabold py-3 rounded-[14px] mb-[22px] cursor-pointer flex items-center justify-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
        Send code on WhatsApp
      </button>

      <div className="flex flex-col gap-3.5 mb-[18px]">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Full name</label><input value={st.name} onChange={e => setStudentField({ name: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Class / batch</label><input value={st.klass} onChange={e => setStudentField({ klass: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Attendance %</label><input value={st.attendance} onChange={e => setStudentField({ attendance: Number(e.target.value) })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        </div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">School</label><input value={st.school} onChange={e => setStudentField({ school: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Parent contact</label><input value={st.parent} onChange={e => setStudentField({ parent: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div>
          <label className="text-xs font-bold text-td-muted mb-[7px] block">Fee status</label>
          <div className="flex gap-[9px]">
            {(['Paid', 'Due', 'Overdue'] as const).map(label => {
              const active = label === st.feeStatus
              const fc = feeColor(label)
              return (
                <button key={label} onClick={() => setStudentField({ feeStatus: label })} className="flex-1 border text-[13px] font-bold p-[11px] rounded-[13px] cursor-pointer" style={{ background: active ? fc.b : '#fff', color: active ? fc.c : '#9aa4b6', borderColor: active ? fc.c : '#e6eaf2' }}>{label}</button>
              )
            })}
          </div>
        </div>
      </div>
      <PrimaryButton onClick={() => {
        if (!st.name.trim()) { notify('Name is required'); return }
        if (st.parent && !/^\+?\d[\d\s\-]{6,}$/.test(st.parent)) { notify('Invalid phone number'); return }
        notify('Student record updated')
        if (origin === 'admin') goFrom('students', 'students', 'admin')
        else go('students', 'students')
      }}>Save changes</PrimaryButton>
    </div>
  )
}

export function AddStudentScreen() {
  const { go, goFrom, origin, newStudent, setNewStudent, addStudent, branchesList, lastAdded, set, notify } = useDashboard()
  const backToList = () => origin === 'admin' ? goFrom('students', 'students', 'admin') : go('students', 'students')

  if (lastAdded) {
    return (
      <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6 flex flex-col items-center justify-center min-h-[450px]">
        <div className="w-[72px] h-[72px] rounded-[22px] bg-[#e7f5ee] flex items-center justify-center mb-5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2fa36b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <div className="text-[18px] font-extrabold text-td-dark mb-2">Student added!</div>
        <div className="text-[13px] text-td-muted text-center leading-relaxed mb-5 max-w-[280px]">Share this code with the parent so the student can log in.</div>
        <div className="w-full max-w-[280px] border-2 border-dashed border-td-primary bg-[#eaf1fc] rounded-[16px] p-4 text-center mb-5">
          <div className="text-[11px] font-bold text-td-muted mb-1">STUDENT LINK CODE</div>
          <div className="text-[24px] font-extrabold text-td-primary tracking-[0.15em]">{lastAdded.code}</div>
        </div>
        <button onClick={() => window.open(whatsappShareUrl(lastAdded.parent, studentCodeMessage(lastAdded.name, lastAdded.code)), '_blank')} className="w-full max-w-[280px] border-none bg-[#25D366] text-white text-[14px] font-extrabold py-[13px] rounded-[14px] cursor-pointer mb-3 flex items-center justify-center gap-2">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
          Send on WhatsApp
        </button>
        <button onClick={() => { navigator.clipboard.writeText(lastAdded.code); notify('Code copied!') }} className="w-full max-w-[280px] border border-td-primary bg-white text-td-primary text-[14px] font-extrabold py-[13px] rounded-[14px] cursor-pointer mb-3 flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy code
        </button>
        <button onClick={() => { set({ lastAdded: null }); backToList() }} className="w-full max-w-[280px] border-none bg-td-primary text-white text-[14px] font-extrabold py-[13px] rounded-[14px] cursor-pointer">Done</button>
      </div>
    )
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Add Student" onBack={backToList} />

      <div className="flex flex-col gap-3.5 mb-[22px]">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Full name</label><input value={newStudent.name} onChange={e => setNewStudent({ name: e.target.value })} placeholder="Student name" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">School</label><input value={newStudent.school} onChange={e => setNewStudent({ school: e.target.value })} placeholder="School" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Standard</label>
            <select value={newStudent.klass} onChange={e => setNewStudent({ klass: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
              <option>Class 10</option><option>Class 9</option><option>Class 8</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Batch</label>
            <select value={newStudent.batch} onChange={e => setNewStudent({ batch: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
              <option>10-B</option><option>10-A</option><option>9-A</option><option>9-B</option>
            </select>
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Branch</label>
            <select value={newStudent.branch} onChange={e => setNewStudent({ branch: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
              {branchesList.length ? branchesList.map(b => <option key={b.name}>{b.name}</option>) : <option>No branches</option>}
            </select>
          </div>
        </div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Parent contact</label><input value={newStudent.parent} onChange={e => setNewStudent({ parent: e.target.value })} placeholder="+91" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Address</label><input value={newStudent.address} onChange={e => setNewStudent({ address: e.target.value })} placeholder="Address" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Monthly fee (&#8377;) <span className="text-td-subtle font-semibold">· optional</span></label><input type="number" value={newStudent.fee} onChange={e => setNewStudent({ fee: e.target.value })} placeholder="e.g. 2000" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Fee due date</label><input type="date" value={newStudent.feeDue} onChange={e => setNewStudent({ feeDue: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        </div>
        <div className="flex items-center gap-2.5 bg-[#eaf1fc] border border-[#dbe6fa] rounded-[14px] p-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span className="text-[12px] text-td-primary font-semibold">A secure login code is generated automatically and shown after you save.</span>
        </div>
      </div>
      <PrimaryButton onClick={addStudent}>Save student</PrimaryButton>
    </div>
  )
}

export function StaffScreen() {
  const { teachers, origin, back, go, goFrom, set, searchQuery } = useDashboard()
  const filtered = searchQuery ? teachers.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.subject.toLowerCase().includes(searchQuery.toLowerCase())) : teachers

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="flex items-center justify-between mt-1.5 mb-[18px]">
        <div className="flex items-center gap-3">
          {origin === 'admin' && <BackButton onClick={back} />}
          <div className="text-2xl font-extrabold text-td-dark">Staff</div>
        </div>
        <button onClick={() => origin === 'admin' ? goFrom('addTeacher', 'teachers', 'admin') : go('addTeacher', 'teachers')} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
          <span className="text-base leading-none">+</span> Add
        </button>
      </div>

      <div className="flex items-center gap-[11px] bg-white border border-td-border rounded-2xl p-[11px] px-[15px] mb-4 lg:max-w-md">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9aa4b6" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input value={searchQuery} onChange={e => set({ searchQuery: e.target.value })} placeholder="Search staff..." className="flex-1 text-[13.5px] text-td-dark outline-none bg-transparent" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">{searchQuery ? 'No matches' : 'No teachers added yet'}</div>
      ) : (
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t, i) => (
            <div key={t.name + i} className="bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-3.5">
              <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center text-white font-extrabold text-[17px]" style={{ background: GRADIENTS[i % GRADIENTS.length] }}>{initials(t.name)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-extrabold text-td-dark">{t.name}</div>
                <div className="text-[12.5px] text-td-primary font-bold mt-0.5">{t.subject}</div>
                <div className="text-[11.5px] text-td-muted mt-[3px]">{t.experience} yrs · {t.qualification}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AddTeacherScreen() {
  const { newTeacher: nt, subjects, branchesList, origin, go, goFrom, setNewTeacher, saveTeacher } = useDashboard()
  const subjectNames = subjects.map(s => s.name)
  const backToList = () => origin === 'admin' ? goFrom('teachers', 'teachers', 'admin') : go('teachers', 'teachers')

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Add Teacher" onBack={backToList} />

      <div className="flex flex-col gap-3.5 mb-[22px]">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Full name</label><input value={nt.name} onChange={e => setNewTeacher({ name: e.target.value })} placeholder="Teacher name" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Subject</label>
          <select value={nt.subject || subjectNames[0] || ''} onChange={e => setNewTeacher({ subject: e.target.value })} disabled={subjectNames.length === 0} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none disabled:opacity-60">
            {subjectNames.length ? subjectNames.map(s => <option key={s}>{s}</option>) : <option value="">Add subjects first</option>}
          </select>
        </div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Qualification</label><input value={nt.qualification} onChange={e => setNewTeacher({ qualification: e.target.value })} placeholder="e.g. M.Sc, B.Ed" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Years of exp.</label><input value={nt.experience} onChange={e => setNewTeacher({ experience: e.target.value })} placeholder="0" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Branch</label>
            <select value={nt.branch} onChange={e => setNewTeacher({ branch: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
              <option value="">All branches</option>
              {branchesList.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>
      <PrimaryButton onClick={saveTeacher}>Save teacher</PrimaryButton>
    </div>
  )
}
```

## app/components/Shell.tsx

```ts
'use client'

import { useRef, useCallback } from 'react'
import { useDashboard, type Screen, type Tab } from '../store'

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    // Mobile: fills the screen (no bezel). md+: framed phone mockup.
    <div className="min-h-[var(--app-h)] w-full flex md:items-center md:justify-center md:bg-[#dfe4ee] md:p-10">
      <div className="w-full flex md:max-w-[402px] md:bg-[#0b0d12] md:rounded-[56px] md:p-[13px] md:shadow-[0_40px_90px_-20px_rgba(20,30,60,.45)]">
        <div className="relative w-full app-frame md:aspect-[376/812] bg-td-bg md:rounded-[44px] overflow-hidden flex flex-col">
          <StatusBar />
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide pt-[env(safe-area-inset-top)] md:pt-0">{children}</div>
          <BottomTabBar />
          <Toast />
        </div>
      </div>
    </div>
  )
}

function StatusBar() {
  return (
    // Fake status bar is only for the desktop mockup; real phones have their own.
    <div className="hidden md:flex h-12 shrink-0 items-end justify-between px-7 pb-1.5 text-sm font-bold text-td-dark z-5">
      <span>9:41</span>
      <div className="absolute left-1/2 top-2 -translate-x-1/2 w-[118px] h-[30px] bg-[#0b0d12] rounded-[18px]" />
      <div className="flex items-center gap-1.5">
        <svg width="17" height="12" viewBox="0 0 17 12"><rect x="0" y="7" width="3" height="5" rx="1" fill="#1a2332"/><rect x="4.5" y="4.5" width="3" height="7.5" rx="1" fill="#1a2332"/><rect x="9" y="2" width="3" height="10" rx="1" fill="#1a2332"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="#1a2332"/></svg>
        <svg width="26" height="13" viewBox="0 0 26 13"><rect x="0.5" y="0.5" width="22" height="12" rx="3.5" fill="none" stroke="#1a2332" opacity="0.4"/><rect x="2.5" y="2.5" width="16" height="8" rx="1.5" fill="#1a2332"/><rect x="24" y="4" width="2" height="5" rx="1" fill="#1a2332" opacity="0.4"/></svg>
      </div>
    </div>
  )
}

function BottomTabBar() {
  const { role, tab, go, currentStudentDbId, staffStatus, supabaseUserId } = useDashboard()
  if (!role) return null
  // Unapproved Google staff (register/pending/denied) get no navigation.
  if (supabaseUserId && staffStatus !== 'approved') return null

  if (role === 'student') {
    if (!currentStudentDbId) return null
    const color = (t: Tab) => tab === t ? '#2a6fdb' : '#9aa4b6'
    const stuTabs: { key: Tab; label: string; screen: Screen; icon: (c: string) => React.ReactNode }[] = [
      { key: 'stuHome', label: 'Home', screen: 'stuHome', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg> },
      { key: 'stuResults', label: 'Results', screen: 'stuResults', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V9"/><path d="M12 21V4"/><path d="M19 21v-7"/></svg> },
      { key: 'stuRanking', label: 'Ranking', screen: 'stuRanking', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/></svg> },
      { key: 'stuTeachers', label: 'Teachers', screen: 'stuTeachers', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13A4 4 0 0 1 16 11"/></svg> },
      { key: 'stuProfile', label: 'Profile', screen: 'stuProfile', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></svg> },
    ]
    return (
      <div className="shrink-0 flex justify-around items-center pt-3 px-2.5 bg-white border-t border-[#eef1f7] pb-[max(env(safe-area-inset-bottom),16px)] md:pb-[26px]">
        {stuTabs.map(t => (
          <button key={t.key} onClick={() => go(t.screen, t.key)} className="border-none bg-transparent cursor-pointer flex flex-col items-center gap-[5px] px-2.5 py-1">
            {t.icon(color(t.key))}
            <span className="text-[10.5px] font-bold" style={{ color: color(t.key) }}>{t.label}</span>
          </button>
        ))}
      </div>
    )
  }

  const color = (t: Tab) => tab === t ? '#2a6fdb' : '#9aa4b6'
  const allTabs: { key: Tab; label: string; headOnly?: boolean; icon: (c: string) => React.ReactNode }[] = [
    { key: 'home', label: 'Home', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg> },
    { key: 'timetable', label: 'Timetable', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg> },
    { key: 'students', label: 'Students', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13A4 4 0 0 1 16 11"/></svg> },
    { key: 'teachers', label: 'Staff', headOnly: true, icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></svg> },
    { key: 'more', label: 'More', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg> },
  ]
  const tabs = allTabs.filter(t => role === 'admin' || !t.headOnly)

  return (
    <div className="shrink-0 flex justify-around items-center pt-3 pb-[26px] px-2.5 bg-white border-t border-[#eef1f7]">
      {tabs.map(t => (
        <button key={t.key} onClick={() => go(t.key === 'timetable' ? 'timetable' : t.key as Screen, t.key)} className="border-none bg-transparent cursor-pointer flex flex-col items-center gap-[5px] px-2.5 py-1">
          {t.icon(color(t.key))}
          <span className="text-[10.5px] font-bold" style={{ color: color(t.key) }}>{t.label}</span>
        </button>
      ))}
    </div>
  )
}

function Toast() {
  const toast = useDashboard(s => s.toast)
  if (!toast) return null
  return (
    <div className="absolute left-5 right-5 bottom-[104px] bg-td-dark text-white py-3.5 px-4 rounded-[14px] text-[13.5px] font-semibold text-center z-30 shadow-[0_14px_36px_rgba(0,0,0,.28)] animate-[toastIn_.25s_ease]">
      {toast}
    </div>
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-[42px] h-[42px] rounded-[14px] border border-td-border bg-white flex items-center justify-center cursor-pointer shrink-0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2332" strokeWidth="2.4" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>
  )
}

export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-[18px]">
      <div className="flex items-center gap-3.5">
        <BackButton onClick={onBack} />
        <div className="text-xl font-extrabold text-td-dark">{title}</div>
      </div>
      {right}
    </div>
  )
}

export function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const busy = useRef(false)
  const guard = useCallback(() => {
    if (busy.current) return
    busy.current = true
    onClick()
    setTimeout(() => { busy.current = false }, 800)
  }, [onClick])
  return (
    <button onClick={guard} className="w-full border-none bg-td-primary text-white text-[15px] font-extrabold py-[15px] rounded-2xl cursor-pointer">
      {children}
    </button>
  )
}

export function ChevronRight() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2cad8" strokeWidth="2.4" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
}
```

## app/components/StudentScreens.tsx

```ts
'use client'

import { useState, useEffect } from 'react'
import { useDashboard, GRADIENTS, initials, av, stuGrade } from '../store'
import { ScreenHeader, PrimaryButton, ChevronRight } from './Shell'
import { enablePush, pushSupported } from '../lib/push'

export function StuHomeScreen() {
  const { go, students, stuReminders, stuResults, stuAttendanceLog, stuPendingFee, currentStudentDbId, googleEmail, rankData, loadStudentByCode, stuMonthly, stuNotes, loadStudentNotes, centreName, centreLogo } = useDashboard()
  const [linkCode, setLinkCode] = useState('')
  const me = students.find(s => s.dbId === currentStudentDbId)

  // Cheap metadata load (no file bytes) so we can badge unseen study material.
  useEffect(() => { loadStudentNotes() }, [loadStudentNotes])
  const notesSeenAt = typeof window !== 'undefined' ? Number(localStorage.getItem('notes_seen_at') || 0) : 0
  const newNotes = stuNotes.filter(n => n.date && new Date(n.date).getTime() > notesSeenAt).length

  if (!currentStudentDbId) {
    return (
      <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6 flex flex-col items-center justify-center min-h-[450px]">
        <button onClick={() => { useDashboard.getState().signOut() }} className="self-start border-none bg-transparent cursor-pointer flex items-center gap-1.5 text-td-muted text-[13px] font-bold mb-6">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7689" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
        <div className="w-[72px] h-[72px] rounded-[22px] bg-[#eaf1fc] flex items-center justify-center mb-5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div className="text-[18px] font-extrabold text-td-dark mb-2">Link your account</div>
        <div className="text-[13px] text-td-muted text-center leading-relaxed mb-6 max-w-[280px]">Enter the student code your teacher gave you to link your account and see your data.</div>
        <input value={linkCode} onChange={e => setLinkCode(e.target.value.toUpperCase())} placeholder="e.g. TUT-1234" className="w-full max-w-[260px] border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary text-center tracking-wider font-bold mb-4" />
        <PrimaryButton onClick={() => loadStudentByCode(linkCode)}>Link account</PrimaryButton>
      </div>
    )
  }

  const displayName = me?.name ?? googleEmail?.split('@')[0] ?? 'Student'
  const ini = initials(displayName)
  const attendancePct = stuAttendanceLog.length > 0
    ? Math.round(stuAttendanceLog.filter(d => d.status === 'Present').length / stuAttendanceLog.length * 100)
    : 0
  const recentResults = stuResults.slice(0, 3)

  let rankInfo = { rank: 0, total: 0 }
  for (const entries of Object.values(rankData)) {
    const idx = entries.findIndex(([name]) => name === me?.name)
    if (idx >= 0 && (rankInfo.rank === 0 || idx + 1 < rankInfo.rank)) {
      rankInfo = { rank: idx + 1, total: entries.length }
    }
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 min-w-0">
          {centreLogo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={centreLogo} alt={centreName || 'Centre'} className="w-[46px] h-[46px] rounded-2xl object-cover border border-td-border shrink-0" />
            : <div className="w-[46px] h-[46px] rounded-2xl flex items-center justify-center text-white font-extrabold text-[17px] shrink-0" style={{ background: 'linear-gradient(135deg,#2fa36b,#56c48d)' }}>{ini}</div>}
          <div className="min-w-0">
            <div className="text-xs text-td-muted font-semibold truncate">{centreName || 'Good morning'}</div>
            <div className="text-[17px] font-extrabold text-td-dark truncate">{displayName}</div>
          </div>
        </div>
        <button onClick={() => go('stuNotif', 'stuHome')} className="relative w-[42px] h-[42px] rounded-[14px] border border-td-border bg-white flex items-center justify-center cursor-pointer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a2332" strokeWidth="2" strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
          <span className="absolute top-[9px] right-[10px] w-2 h-2 rounded-full bg-td-red border-2 border-white" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 mb-[18px]">
        <div className="inline-flex items-center gap-[7px] bg-white border border-td-border rounded-[20px] py-[7px] px-[13px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
          <span className="text-[12.5px] font-semibold text-td-text">{me?.school || 'Your branch'}</span>
        </div>
        {pushSupported() && me?.id && (
          <button onClick={async () => { const r = await enablePush('student', me.id); useDashboard.getState().notify(r.ok ? 'Alerts turned on' : (r.error || 'Could not enable')) }} className="inline-flex items-center gap-1.5 bg-[#eaf1fc] text-td-primary text-[12px] font-bold py-[7px] px-3 rounded-[20px] cursor-pointer border-none shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
            Alerts
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3.5">
        <button onClick={() => go('stuAttendance', 'stuHome')} className="rounded-[18px] p-3.5 text-white text-left border-none cursor-pointer" style={{ background: 'linear-gradient(135deg,#2a6fdb,#3f82ec)' }}>
          <div className="text-2xl font-extrabold leading-none">{attendancePct}%</div>
          <div className="text-[11px] opacity-85 mt-1.5 font-semibold">Attendance</div>
        </button>
        <button onClick={() => go('stuRanking', 'stuRanking')} className="bg-white border border-td-border rounded-[18px] p-3.5 text-left cursor-pointer">
          {rankInfo.rank > 0 ? (
            <>
              <div className="text-2xl font-extrabold leading-none text-td-dark">#{rankInfo.rank}<span className="text-sm text-td-muted font-semibold"> / {rankInfo.total}</span></div>
              <div className="text-[11px] text-td-muted mt-1.5 font-semibold">Class Rank</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-extrabold leading-none text-td-dark">&mdash;</div>
              <div className="text-[11px] text-td-muted mt-1.5 font-semibold">No rank yet</div>
            </>
          )}
        </button>
      </div>

      {stuMonthly && (stuMonthly.attTotal > 0 || stuMonthly.tests > 0) && (
        <div className="rounded-[18px] p-4 mb-3.5 text-white" style={{ background: 'linear-gradient(135deg,#2fa36b,#4db786)' }}>
          <div className="text-[11px] font-bold opacity-85 mb-2.5">THIS MONTH</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[19px] font-extrabold leading-none">{stuMonthly.attTotal > 0 ? `${Math.round((stuMonthly.attPresent / stuMonthly.attTotal) * 100)}%` : '—'}</div>
              <div className="text-[10.5px] opacity-80 mt-1 font-semibold">Attendance</div>
            </div>
            <div>
              <div className="text-[19px] font-extrabold leading-none">{stuMonthly.tests}</div>
              <div className="text-[10.5px] opacity-80 mt-1 font-semibold">Tests</div>
            </div>
            <div>
              <div className="text-[19px] font-extrabold leading-none">{stuMonthly.tests > 0 ? `${stuMonthly.avgPct}%` : '—'}</div>
              <div className="text-[10.5px] opacity-80 mt-1 font-semibold">Avg score</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <button onClick={() => go('stuTimetable', 'stuHome')} className="text-left bg-white border border-td-border rounded-[18px] p-3 cursor-pointer">
          <div className="w-[38px] h-[38px] rounded-[12px] bg-[#eef0fc] flex items-center justify-center text-lg mb-2">🗓️</div>
          <div className="text-[12.5px] font-extrabold text-td-dark leading-tight">Timetable</div>
        </button>
        <button onClick={() => go('stuAssignments', 'stuHome')} className="text-left bg-white border border-td-border rounded-[18px] p-3 cursor-pointer">
          <div className="w-[38px] h-[38px] rounded-[12px] bg-[#fcf3e3] flex items-center justify-center text-lg mb-2">📚</div>
          <div className="text-[12.5px] font-extrabold text-td-dark leading-tight">Homework</div>
        </button>
        <button onClick={() => go('stuNotes', 'stuHome')} className="relative text-left bg-white border border-td-border rounded-[18px] p-3 cursor-pointer">
          <div className="w-[38px] h-[38px] rounded-[12px] bg-[#e7f5ee] flex items-center justify-center text-lg mb-2">📄</div>
          <div className="text-[12.5px] font-extrabold text-td-dark leading-tight">Material</div>
          {newNotes > 0 && <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-td-red text-white text-[10.5px] font-extrabold flex items-center justify-center">{newNotes}</span>}
        </button>
      </div>

      {stuPendingFee && (
        <button onClick={() => go('stuFees', 'stuHome')} className="w-full text-left border-none cursor-pointer rounded-[18px] p-[15px] flex items-center gap-[13px] mb-5" style={{ background: 'linear-gradient(135deg,#e8553c,#ef7a64)' }}>
          <div className="w-[42px] h-[42px] rounded-[13px] bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-xl">💳</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-extrabold text-white">{stuPendingFee.amount} fee due</div>
            <div className="text-xs text-white/70 mt-0.5">Due by {stuPendingFee.dueDate}</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2.4" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}

      {stuReminders.length > 0 && (
        <>
          <div className="text-base font-extrabold text-td-dark mb-[13px]">Reminders</div>
          <div className="flex flex-col gap-2.5 mb-[22px]">
            {stuReminders.map(r => (
              <button key={r.title + r.when} onClick={() => go('stuNotif', 'stuHome')} className="w-full text-left bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px] cursor-pointer">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-lg" style={{ background: r.tint }}>{r.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold text-td-dark">{r.title}</div>
                  <div className="text-xs text-td-muted mt-0.5 truncate">{r.detail}</div>
                </div>
                <span className="text-[11px] text-td-subtle font-semibold shrink-0">{r.when}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2cad8" strokeWidth="2.4" strokeLinecap="round" className="shrink-0"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            ))}
          </div>
        </>
      )}

      {recentResults.length > 0 && (
        <>
          <div className="text-base font-extrabold text-td-dark mb-[13px]">Recent results</div>
          <div className="flex flex-col gap-2.5">
            {recentResults.map(r => {
              const pct = Math.round((r.marks / r.total) * 100)
              const g = stuGrade(pct)
              return (
                <div key={r.subject + r.test} className="bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px]">
                  <span className="text-[11px] font-extrabold py-[5px] px-2.5 rounded-[10px]" style={{ color: g.c, background: g.t }}>{g.g}</span>
                  <div className="flex-1">
                    <div className="text-[13.5px] font-bold text-td-dark">{r.subject}</div>
                    <div className="text-xs text-td-muted mt-0.5">{r.test} · {r.date}</div>
                  </div>
                  <div className="text-sm font-extrabold text-td-dark">{r.marks}/{r.total}</div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {stuReminders.length === 0 && recentResults.length === 0 && !stuPendingFee && (
        <div className="text-center text-td-muted text-sm py-8">No updates yet — check back later</div>
      )}
    </div>
  )
}

export function StuAttendanceScreen() {
  const { go, stuAttendanceLog } = useDashboard()
  const total = stuAttendanceLog.length
  const present = stuAttendanceLog.filter(d => d.status === 'Present').length
  const absent = stuAttendanceLog.filter(d => d.status === 'Absent').length
  const leaves = stuAttendanceLog.filter(d => d.status === 'Leave').length
  const pct = total > 0 ? Math.round((present / total) * 100) : 0
  const r = 42
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Attendance" onBack={() => go('stuHome', 'stuHome')} />

      <div className="rounded-[22px] p-5 text-white mb-5 flex items-center gap-5" style={{ background: 'linear-gradient(135deg,#2a6fdb,#3f82ec)' }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="7" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 50 50)" />
          <text x="50" y="46" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800">{pct}%</text>
          <text x="50" y="62" textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="9" fontWeight="600">Present</text>
        </svg>
        <div>
          <div className="text-[15px] font-extrabold">Present this term</div>
          <div className="text-[12.5px] opacity-80 mt-1.5 leading-relaxed">
            {total > 0 ? <>{present} of {total} class days attended.<br/>{absent} absences, {leaves} leaves.</> : 'No attendance data yet.'}
          </div>
        </div>
      </div>

      <div className="text-base font-extrabold text-td-dark mb-[13px]">Recent days</div>
      {stuAttendanceLog.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No attendance records yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuAttendanceLog.map(d => (
            <div key={d.date} className="bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px]">
              <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-lg" style={{ background: d.tint }}>{d.icon}</div>
              <div className="flex-1">
                <div className="text-[13.5px] font-bold text-td-dark">{d.day}</div>
                <div className="text-xs text-td-muted mt-0.5">{d.date}</div>
              </div>
              <span className="text-[11px] font-bold" style={{ color: d.color }}>{d.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function StuResultsScreen() {
  const { stuResults, students, currentStudentDbId } = useDashboard()
  const me = students.find(s => s.dbId === currentStudentDbId)
  const totalMarks = stuResults.reduce((a, r) => a + r.marks, 0)
  const totalMax = stuResults.reduce((a, r) => a + r.total, 0)
  const avg = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0
  const overall = stuGrade(avg)

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="text-2xl font-extrabold text-td-dark mt-1.5 mb-1">Test Results</div>
      <div className="text-[12.5px] text-td-muted mb-[18px]">{me?.klass ?? ''} · {me?.school ?? ''}</div>

      {stuResults.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No results available yet</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <div className="rounded-[18px] p-3.5 text-center" style={{ background: overall.t }}>
              <div className="text-2xl font-extrabold" style={{ color: overall.c }}>{overall.g}</div>
              <div className="text-[11px] font-semibold mt-1" style={{ color: overall.c, opacity: .7 }}>Overall grade</div>
            </div>
            <div className="bg-white border border-td-border rounded-[18px] p-3.5 text-center">
              <div className="text-2xl font-extrabold text-td-dark">{avg}%</div>
              <div className="text-[11px] text-td-muted font-semibold mt-1">Average</div>
            </div>
          </div>

          <div className="text-base font-extrabold text-td-dark mb-[13px]">All subjects</div>
          <div className="flex flex-col gap-2.5">
            {stuResults.map(r => {
              const pct = Math.round((r.marks / r.total) * 100)
              const g = stuGrade(pct)
              return (
                <div key={r.subject + r.test} className="bg-white border border-td-border rounded-[18px] p-3.5">
                  <div className="flex items-center gap-[13px] mb-2.5">
                    <span className="text-[11px] font-extrabold py-[5px] px-2.5 rounded-[10px]" style={{ color: g.c, background: g.t }}>{g.g}</span>
                    <div className="flex-1">
                      <div className="text-[13.5px] font-bold text-td-dark">{r.subject}</div>
                      <div className="text-xs text-td-muted mt-0.5">{r.test} · {r.date}</div>
                    </div>
                    <div className="text-sm font-extrabold text-td-dark">{r.marks}/{r.total}</div>
                  </div>
                  <div className="w-full h-[7px] bg-[#eef1f7] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.c }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function StuRankingScreen() {
  const { stuRankSubject, rankData, subjects: subjectsList, students, currentStudentDbId, set } = useDashboard()
  const me = students.find(s => s.dbId === currentStudentDbId)
  const subjectNames = subjectsList.length ? subjectsList.map(s => s.name) : Object.keys(rankData)
  const rows = (rankData[stuRankSubject] || []).map((r, i) => ({ rank: i + 1, name: r[0], score: r[1] }))
  const top3 = rows.slice(0, 3)
  const rest = rows.slice(3)
  const medals = ['🥈', '🥇', '🥉']
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3
  const podiumHeights = [88, 110, 72]
  const podiumBg = ['#c0cfe8', '#2a6fdb', '#d4c9a8']

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="text-2xl font-extrabold text-td-dark mt-1.5 mb-1">Ranking</div>
      <div className="text-[12.5px] text-td-muted mb-[18px]">{me?.klass ?? ''}{stuRankSubject ? ` · ${stuRankSubject}` : ''}</div>

      {subjectNames.length > 0 && (
        <div className="flex gap-[9px] overflow-x-auto mb-[22px] scrollbar-hide">
          {subjectNames.map(name => {
            const active = name === stuRankSubject
            return (
              <button key={name} onClick={() => set({ stuRankSubject: name })} className="shrink-0 text-[13px] font-bold py-[9px] px-4 rounded-[20px] cursor-pointer border" style={{ background: active ? '#2a6fdb' : '#fff', color: active ? '#fff' : '#3a4456', borderColor: active ? '#2a6fdb' : '#e6eaf2' }}>{name}</button>
            )
          })}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-10 leading-relaxed">No rankings published yet.<br />They&apos;ll appear once your teacher enters results.</div>
      ) : (
        <>
          {top3.length >= 3 && (
            <div className="flex justify-center items-end gap-[7px] mb-6">
              {podiumOrder.map((p, pi) => {
                const isYou = me?.name === p.name
                return (
                  <div key={p.name} className="flex flex-col items-center">
                    <div className="text-2xl mb-1">{medals[pi]}</div>
                    <div className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-white font-extrabold text-[17px] mb-1.5" style={{ background: GRADIENTS[pi] }}>{initials(p.name)}</div>
                    <div className="text-[11px] font-extrabold text-td-dark text-center leading-tight mb-0.5">{p.name.split(' ')[0]}{isYou && <span className="text-td-primary"> (You)</span>}</div>
                    <div className="text-[11px] font-bold text-td-primary mb-1.5">{p.score}%</div>
                    <div className="w-[72px] rounded-t-[10px]" style={{ height: podiumHeights[pi], background: podiumBg[pi] }} />
                  </div>
                )
              })}
            </div>
          )}

          <div className="text-[13px] font-extrabold text-td-dark mb-[11px]">Leaderboard</div>
          <div className="flex flex-col gap-[9px]">
            {rest.map(r => {
              const isYou = me?.name === r.name
              return (
                <div key={r.name} className="flex items-center gap-[13px] border rounded-2xl p-3 px-3.5" style={{ background: isYou ? '#eaf1fc' : '#fff', borderColor: isYou ? '#2a6fdb' : '#e6eaf2' }}>
                  <div className="w-[26px] text-center text-sm font-extrabold text-td-subtle">{r.rank}</div>
                  <div className="w-9 h-9 rounded-[11px] shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(r.rank) }}>{initials(r.name)}</div>
                  <div className="flex-1 text-[13.5px] font-bold text-td-dark">{r.name}{isYou && <span className="text-td-primary text-xs"> (You)</span>}</div>
                  <div className="text-sm font-extrabold text-td-dark">{r.score}%</div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function StuTeachersScreen() {
  const { teachers, set, go } = useDashboard()

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="text-2xl font-extrabold text-td-dark mt-1.5 mb-1">Teachers</div>
      <div className="text-[12.5px] text-td-muted mb-[18px]">{teachers.length} faculty at your branch</div>

      {teachers.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No teachers listed yet</div>
      ) : (
        <div className="flex flex-col gap-3">
          {teachers.map((t, i) => (
            <button key={t.name + i} onClick={() => { set({ stuTeacherIndex: i }); go('stuTeacher', 'stuTeachers') }} className="text-left bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-3.5 cursor-pointer">
              <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center text-white font-extrabold text-[17px]" style={{ background: GRADIENTS[i % GRADIENTS.length] }}>{initials(t.name)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-extrabold text-td-dark">{t.name}</div>
                <div className="text-[12.5px] text-td-primary font-bold mt-0.5">{t.subject}</div>
                <div className="text-[11.5px] text-td-muted mt-[3px]">{t.experience} yrs · {t.qualification}</div>
              </div>
              <ChevronRight />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function StuTeacherDetail() {
  const { teachers, stuTeacherIndex, go } = useDashboard()
  const t = teachers[stuTeacherIndex] || teachers[0]
  if (!t) return <div className="text-center text-td-muted py-8">No teacher data</div>

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Teacher Profile" onBack={() => go('stuTeachers', 'stuTeachers')} />

      <div className="flex flex-col items-center mb-5">
        <div className="w-[80px] h-[80px] rounded-3xl flex items-center justify-center text-white font-extrabold text-[28px] mb-3" style={{ background: GRADIENTS[stuTeacherIndex % GRADIENTS.length] }}>{initials(t.name)}</div>
        <div className="text-[20px] font-extrabold text-td-dark">{t.name}</div>
        <span className="text-[12px] font-bold text-td-primary bg-[#eaf1fc] py-[5px] px-3 rounded-[20px] mt-2">{t.subject}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <div className="bg-white border border-td-border rounded-[18px] p-3.5 text-center">
          <div className="text-2xl font-extrabold text-td-dark">{t.experience}</div>
          <div className="text-[11px] text-td-muted font-semibold mt-1">Years exp.</div>
        </div>
        <div className="bg-white border border-td-border rounded-[18px] p-3.5 text-center">
          <div className="text-2xl font-extrabold text-td-amber">⭐ {t.rating || '—'}</div>
          <div className="text-[11px] text-td-muted font-semibold mt-1">Rating</div>
        </div>
      </div>

      <div className="bg-white border border-td-border rounded-[18px] p-4 mb-3">
        <div className="text-[13px] font-extrabold text-td-dark mb-2">Qualification</div>
        <div className="text-[13px] text-td-muted">{t.qualification}</div>
      </div>

      {t.about && (
        <div className="bg-white border border-td-border rounded-[18px] p-4">
          <div className="text-[13px] font-extrabold text-td-dark mb-2">About</div>
          <div className="text-[13px] text-td-muted leading-relaxed">{t.about}</div>
        </div>
      )}
    </div>
  )
}

export function StuFeesScreen() {
  const { go, notify, stuFeeHistory, stuPendingFee } = useDashboard()

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Fees" onBack={() => go('stuHome', 'stuHome')} />

      {stuPendingFee ? (
        <div className="rounded-[22px] p-5 text-white mb-5" style={{ background: 'linear-gradient(135deg,#e8553c,#ef7a64)' }}>
          <div className="text-xs opacity-70 font-semibold">Amount due</div>
          <div className="text-[28px] font-extrabold mt-1">{stuPendingFee.amount}</div>
          <div className="text-[12.5px] opacity-80 mt-1">{stuPendingFee.period} · Due {stuPendingFee.dueDate}</div>
          <button onClick={() => notify('Contact your teacher to arrange payment')} className="w-full mt-4 border-none bg-white text-td-red text-sm font-extrabold py-3.5 rounded-[14px] cursor-pointer">Pay now</button>
        </div>
      ) : (
        <div className="rounded-[22px] p-5 text-white mb-5 text-center" style={{ background: 'linear-gradient(135deg,#2fa36b,#56c48d)' }}>
          <div className="text-[22px] font-extrabold">All clear!</div>
          <div className="text-[12.5px] opacity-80 mt-1">No pending fees</div>
        </div>
      )}

      <div className="text-base font-extrabold text-td-dark mb-[13px]">Payment history</div>
      {stuFeeHistory.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No payment history yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuFeeHistory.map(f => (
            <div key={f.period} className="bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px]">
              <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-[#e7f5ee]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2fa36b" strokeWidth="2.6" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
              </div>
              <div className="flex-1">
                <div className="text-[13.5px] font-bold text-td-dark">{f.period}</div>
                <div className="text-xs text-td-muted mt-0.5">Paid on {f.date}</div>
              </div>
              <div className="text-sm font-extrabold text-td-green">{f.amount}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function StuNotifScreen() {
  const { go, stuNotifications } = useDashboard()

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Notifications" onBack={() => go('stuHome', 'stuHome')} />

      {stuNotifications.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No notifications yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuNotifications.map(n => (
            <div key={n.title + n.when} className="bg-white border border-td-border rounded-[18px] p-3.5 flex items-start gap-[13px]">
              <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-lg mt-0.5" style={{ background: n.tint }}>{n.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-bold text-td-dark">{n.title}</div>
                <div className="text-xs text-td-muted mt-1 leading-relaxed">{n.detail}</div>
                <div className="text-[11px] text-td-subtle font-semibold mt-1.5">{n.when}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function StuTimetableScreen() {
  const { go, timetableData } = useDashboard()
  const dayNames: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' }
  const [day, setDay] = useState(['Mon', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()])
  const periods = timetableData[day] || []

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="My Timetable" onBack={() => go('stuHome', 'stuHome')} />

      <div className="flex gap-2 overflow-x-auto mb-[18px] scrollbar-hide">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => {
          const active = d === day
          return (
            <button key={d} onClick={() => setDay(d)} className="shrink-0 min-w-[48px] border rounded-[14px] py-[9px] px-3 cursor-pointer text-center" style={{ background: active ? '#2a6fdb' : '#fff', borderColor: active ? '#2a6fdb' : '#e6eaf2' }}>
              <div className="text-[12px] font-bold" style={{ color: active ? '#fff' : '#3a4456' }}>{d}</div>
            </button>
          )
        })}
      </div>

      <div className="text-[13px] text-td-muted font-semibold mb-3.5">{dayNames[day]} · {periods.length} {periods.length === 1 ? 'class' : 'classes'}</div>

      {periods.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-10">No classes scheduled for {dayNames[day]}</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {periods.map((p, i) => {
            const free = p[2] === 'Free period'
            return (
              <div key={i} className="bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px]">
                <div className="text-center shrink-0 w-[56px]">
                  <div className="text-[12.5px] font-extrabold text-td-primary">{p[0]}</div>
                  <div className="text-[10.5px] text-td-subtle font-semibold">{p[1]}</div>
                </div>
                <div className="w-px h-[34px] bg-[#eef1f7]" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold" style={{ color: free ? '#9aa4b6' : '#1a2332' }}>{p[2]}</div>
                  {p[4] && <div className="text-xs text-td-muted mt-0.5">{p[4]}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function StuAssignmentsScreen() {
  const { go, stuAssignments } = useDashboard()
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Homework" onBack={() => go('stuHome', 'stuHome')} />

      {stuAssignments.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-12 leading-relaxed">No homework assigned yet.<br />New assignments from your teacher will appear here.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuAssignments.map((a, i) => (
            <button key={i} onClick={() => setOpen(open === i ? null : i)} className="w-full text-left bg-white border border-td-border rounded-[18px] p-4 cursor-pointer">
              <div className="flex items-center gap-[13px]">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-lg bg-[#fcf3e3]">📚</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-extrabold text-td-dark">{a.title}</div>
                  <div className="text-[12px] text-td-muted mt-0.5">{a.subject}{a.due ? ` · due ${a.due}` : ''}</div>
                </div>
                {a.instructions && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2cad8" strokeWidth="2.4" strokeLinecap="round" className={`shrink-0 transition-transform ${open === i ? 'rotate-90' : ''}`}><path d="m9 18 6-6-6-6"/></svg>}
              </div>
              {open === i && a.instructions && <div className="text-[13px] text-td-text leading-relaxed mt-3 pt-3 border-t border-[#f0f2f7]">{a.instructions}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function StuProfileScreen() {
  const { go, signOut, students, currentStudentDbId, stuResults, googleEmail } = useDashboard()
  const me = students.find(s => s.dbId === currentStudentDbId)
  const displayName = me?.name ?? googleEmail?.split('@')[0] ?? 'Student'
  const ini = initials(displayName)
  const totalMarks = stuResults.reduce((a, r) => a + r.marks, 0)
  const totalMax = stuResults.reduce((a, r) => a + r.total, 0)
  const avg = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0
  const grade = stuGrade(avg)

  const fields = [
    { icon: '🏫', label: 'School', value: me?.school || '—', locked: true },
    { icon: '📚', label: 'Standard', value: me?.klass || '—', locked: true },
    { icon: '📱', label: 'Parent contact', value: me?.parent || '—', locked: false },
    { icon: '📍', label: 'Address', value: me?.address || '—', locked: false },
  ]

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="flex items-center justify-between mt-1.5 mb-[18px]">
        <div className="text-2xl font-extrabold text-td-dark">My Profile</div>
        <div className="flex gap-2">
          <button onClick={() => go('stuEditProfile', 'stuProfile')} className="border border-td-border bg-white text-td-primary text-[12.5px] font-bold py-2 px-3 rounded-[12px] cursor-pointer">Edit</button>
          <button onClick={signOut} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12.5px] font-bold py-2 px-3 rounded-[12px] cursor-pointer">Sign out</button>
        </div>
      </div>

      <div className="rounded-[22px] p-5 text-white flex items-center gap-4 mb-5" style={{ background: 'linear-gradient(135deg,#2a6fdb,#3f82ec)' }}>
        <div className="w-[64px] h-[64px] rounded-2xl bg-white/20 flex items-center justify-center text-white font-extrabold text-[22px] shrink-0">{ini}</div>
        <div>
          <div className="text-[18px] font-extrabold">{displayName}</div>
          <div className="text-[12.5px] opacity-80 mt-0.5">{me?.klass ?? ''}</div>
          {stuResults.length > 0 && (
            <span className="inline-block text-[10.5px] font-bold bg-white/20 py-1 px-2.5 rounded-[20px] mt-1.5">{grade.g} · {avg}%</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 mb-5">
        {fields.map(f => (
          <div key={f.label} className="bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px]">
            <span className="text-lg">{f.icon}</span>
            <div className="flex-1">
              <div className="text-[11px] text-td-subtle font-semibold">{f.label}</div>
              <div className="text-[13.5px] font-bold text-td-dark mt-0.5">{f.value}</div>
            </div>
            {f.locked && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c2cad8" strokeWidth="2.2" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>}
          </div>
        ))}
      </div>

      <div className="text-[11.5px] text-td-subtle text-center leading-relaxed">Fields marked with 🔒 are set by your tuition centre and cannot be changed.</div>
    </div>
  )
}

export function StuEditProfileScreen() {
  const { stuEdit, go, set, students, currentStudentDbId, stuResults, googleEmail, saveStudentProfile } = useDashboard()
  const me = students.find(s => s.dbId === currentStudentDbId)
  const displayName = me?.name ?? googleEmail?.split('@')[0] ?? 'Student'
  const ini = initials(displayName)
  const totalMarks = stuResults.reduce((a, r) => a + r.marks, 0)
  const totalMax = stuResults.reduce((a, r) => a + r.total, 0)
  const avg = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0
  const grade = stuGrade(avg)

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Edit Profile" onBack={() => go('stuProfile', 'stuProfile')} />

      <div className="flex flex-col items-center mb-5">
        <div className="w-[80px] h-[80px] rounded-3xl flex items-center justify-center text-white font-extrabold text-[28px] mb-2 relative" style={{ background: 'linear-gradient(135deg,#2fa36b,#56c48d)' }}>
          {ini}
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-td-primary flex items-center justify-center border-2 border-td-bg">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>
          </div>
        </div>
        <button className="text-[12px] text-td-primary font-bold mt-1 border-none bg-transparent cursor-pointer">Change photo</button>
      </div>

      <div className="flex flex-col gap-3.5 mb-5">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Full name</label><input value={stuEdit.name || displayName} onChange={e => set({ stuEdit: { ...stuEdit, name: e.target.value } })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Parent contact</label><input value={stuEdit.parentNumber || me?.parent || ''} onChange={e => set({ stuEdit: { ...stuEdit, parentNumber: e.target.value } })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Address</label><input value={stuEdit.address || me?.address || ''} onChange={e => set({ stuEdit: { ...stuEdit, address: e.target.value } })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
      </div>

      <div className="bg-[#f4f6fb] border border-td-border rounded-[18px] p-4 mb-5">
        <div className="text-[12px] font-bold text-td-subtle mb-2.5">Locked by tuition centre</div>
        <div className="flex flex-col gap-2">
          {[
            { l: 'School', v: me?.school || '—' },
            { l: 'Standard', v: me?.klass || '—' },
            { l: 'Performance', v: stuResults.length > 0 ? `${grade.g} · ${avg}%` : '—' },
          ].map(f => (
            <div key={f.l} className="flex items-center justify-between">
              <span className="text-[12.5px] text-td-muted">{f.l}</span>
              <span className="text-[12.5px] font-bold text-td-text">{f.v}</span>
            </div>
          ))}
        </div>
      </div>

      <PrimaryButton onClick={saveStudentProfile}>Save changes</PrimaryButton>
    </div>
  )
}
```

## app/components/SupabaseProvider.tsx

```ts
'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useDashboard, registerRefresh, type Role, type StaffStatus, type Teacher, type Student, type PendingStudent, type FeeStatus, type MeetingItem, type AssignmentItem, type BranchItem, type StuResultItem, type AttLogItem, type NotifItem, type FeeHistoryItem, type ScheduleItem } from '../store'

// Minimal shape of the Supabase rows this provider reads — the DB schema is the
// source of truth, and existing `??` fallbacks handle nullable columns.
type Row = {
  [key: string]: unknown
  id: string; name: string; address: string; is_main: boolean; branch_id: string
  date: string; title: string; time: string; meeting_type: string
  due_date: string; class: string
  day: string; start_time: string; end_time: string; subject: string; room: string
  test_id: string; subject_id: string; max_marks: number; marks: number
  student_id: string; status: string
  period: string; paid_date: string; amount: number
  icon: string; tint: string; detail: string; created_at: string
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, loadTeachers, loadStudents, set } = useDashboard()
  const lastRefresh = useRef(0)
  const role = useDashboard(s => s.role)
  const staffStatus = useDashboard(s => s.staffStatus)

  // Register the service worker so the app is installable (Add to Home Screen)
  // and can receive push notifications.
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  // Let store mutations request a fresh full-dataset pull (e.g. after saving
  // attendance) — but only for approved staff who actually load that dataset.
  useEffect(() => {
    registerRefresh(async () => {
      const st = useDashboard.getState()
      if (st.supabaseUserId && (st.role === 'admin' || st.role === 'teacher') && st.staffStatus === 'approved') {
        await fetchAllData().catch(() => {})
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- register once; fetchAllData reads fresh state via store actions
  }, [])

  // Head only: keep the pending list warm and alert the instant a teacher
  // requests access (realtime on profiles; RLS limits events to own centre).
  useEffect(() => {
    if (role !== 'admin' || staffStatus !== 'approved') return
    useDashboard.getState().loadStaff()
    const ch = supabase
      .channel('pending-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        const st = useDashboard.getState()
        const row = payload.new as { staff_status?: string; full_name?: string } | null
        const was = (payload.old as { staff_status?: string } | null)?.staff_status
        if (row?.staff_status === 'pending' && was !== 'pending') {
          st.notify(`${row.full_name || 'A teacher'} is requesting access — check Staff access`)
        }
        st.loadStaff()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [role, staffStatus])

  // Staff (head or teacher): alert + refresh the moment a student self-registers,
  // so pending requests surface live. RLS (students_staff) scopes events to the
  // caller's own centre.
  useEffect(() => {
    if ((role !== 'admin' && role !== 'teacher') || staffStatus !== 'approved') return
    const ch = supabase
      .channel('student-requests-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload) => {
        const st = useDashboard.getState()
        const row = payload.new as { status?: string; name?: string } | null
        const was = (payload.old as { status?: string } | null)?.status
        if (row?.status === 'pending' && was !== 'pending') {
          st.notify(`${row.name || 'A student'} requested to join — check Student requests`)
        }
        st.refreshData()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [role, staffStatus])

  // No Google session: a returning student may have a saved code; otherwise land on login.
  function resumeStudentOrLanding() {
    const code = typeof window !== 'undefined' ? localStorage.getItem('student_code') : null
    if (code) {
      useDashboard.getState().loadStudentByCode(code).then(ok => { if (!ok) set({ authLoading: false }) })
    } else {
      set({ authLoading: false })
    }
  }

  async function handleAuth(userId: string, email: string) {
    try {
      const { data: profile } = await supabase.from('profiles').select('role, staff_status, full_name, phone').eq('id', userId).single()
      const role = (profile?.role as Role) ?? 'student'
      const staffStatus = (profile?.staff_status as StaffStatus) ?? 'none'
      const { data: headExists } = await supabase.rpc('head_exists')
      setAuth(userId, role, email, staffStatus, !!headExists, (profile?.full_name as string) ?? '', (profile?.phone as string) ?? '')
      // Only approved staff load the centre's full dataset. dataLoading gates the
      // UI so Home never flashes zeros before the first fetch completes.
      if ((role === 'admin' || role === 'teacher') && staffStatus === 'approved') {
        set({ dataLoading: true })
        try { await fetchAllData() }
        catch { useDashboard.getState().notify('Could not load data — check your connection and refresh') }
        finally { set({ dataLoading: false }) }
      }
    } catch {
      // Network/unexpected failure before we resolved the role: never strand the
      // user on the splash spinner — clear loading so the UI can recover.
      set({ authLoading: false, dataLoading: false })
      useDashboard.getState().notify('Connection problem — please refresh')
    }
  }

  async function fetchAllData() {
    const [
      { data: teachers },
      { data: students },
      { data: branches },
      { data: meetings },
      { data: assignments },
      { data: timetable },
      { data: fees },
      { data: tests },
      { data: results },
      { data: notifications },
      { data: subjects },
      { data: attendance },
    ] = await Promise.all([
      // Defensive caps: orderings put the newest rows first, so a centre that
      // outgrows a cap loses only the oldest tail, never current data.
      supabase.from('teachers').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('students').select('id,name,class,school,parent_contact,student_code,fee_status,address,branch_id,profile_id,status,created_at').order('created_at', { ascending: false }).limit(2000),
      supabase.from('branches').select('*').order('is_main', { ascending: false }).limit(50),
      supabase.from('meetings').select('*').order('date', { ascending: false }).limit(200),
      supabase.from('assignments').select('*').order('due_date', { ascending: false }).limit(500),
      supabase.from('timetable').select('*').order('start_time', { ascending: true }).limit(1000),
      supabase.from('fees').select('*').order('due_date', { ascending: false }).limit(5000),
      supabase.from('tests').select('*').order('date', { ascending: false }).limit(1000),
      supabase.from('results').select('*').limit(20000),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('subjects').select('*').limit(100),
      supabase.from('attendance').select('*').order('date', { ascending: false }).limit(20000),
    ])

    const mappedTeachers = (teachers ?? []).map(mapTeacher)
    // Per-student attendance % from the fetched attendance rows (mapStudent
    // alone can't know it — without this every student shows 0%).
    const attByStudent: Record<string, { p: number; t: number }> = {}
    for (const a of (attendance ?? []) as Row[]) {
      const k = a.student_id as string
      if (!attByStudent[k]) attByStudent[k] = { p: 0, t: 0 }
      attByStudent[k].t++
      if (a.status === 'Present') attByStudent[k].p++
    }
    // Self-registered students awaiting approval are held out of the roster (and
    // every count/ranking derived from it) until the head approves them.
    const approvedRows = (students ?? []).filter((s) => ((s.status as string) ?? 'approved') === 'approved')
    const pendingRows = (students ?? []).filter((s) => (s.status as string) === 'pending')
    const mappedStudents = approvedRows.map((row) => {
      const st = mapStudent(row)
      const att = attByStudent[st.dbId ?? '']
      return att && att.t > 0 ? { ...st, attendance: Math.round((att.p / att.t) * 100) } : st
    })
    const pendingStudents: PendingStudent[] = pendingRows.map((s) => ({
      dbId: s.id as string, name: (s.name as string) ?? '', klass: (s.class as string) ?? '',
      school: (s.school as string) ?? '', parent: (s.parent_contact as string) ?? '',
      address: (s.address as string) ?? '', code: (s.student_code as string) ?? '',
      when: timeAgo(s.created_at as string),
    }))
    const subjectList = (subjects ?? []).map((s: Row) => ({ name: s.name as string, dbId: s.id as string }))
    const subjectMap = Object.fromEntries(subjectList.map(s => [s.dbId, s.name]))
    const studentMap = Object.fromEntries(mappedStudents.map(s => [s.dbId, s]))

    loadTeachers(mappedTeachers)
    loadStudents(mappedStudents)

    // Branches — count per-branch
    const branchesList: BranchItem[] = (branches ?? []).map((b: Row) => ({
      name: b.name, address: b.address ?? '', main: !!b.is_main,
      students: approvedRows.filter((s) => s.branch_id === b.id).length,
      staff: (teachers ?? []).filter((t: Row) => t.branch_id === b.id).length,
      dbId: b.id,
    }))

    // Meetings
    const meetingsList: MeetingItem[] = (meetings ?? []).map((m: Row) => {
      const d = new Date(m.date)
      return {
        day: String(d.getDate()).padStart(2, '0'),
        mon: d.toLocaleString('en', { month: 'short' }),
        title: m.title, time: m.time ?? '', kind: m.meeting_type ?? 'Staff',
        dbId: m.id,
      }
    })

    // Assignments
    const assignmentsList: AssignmentItem[] = (assignments ?? []).map((a: Row) => {
      const d = new Date(a.due_date)
      return {
        title: a.title, klass: a.class ?? '',
        due: `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`,
        submitted: 0, total: mappedStudents.filter(s => s.klass === (a.class ?? '')).length,
        dbId: a.id,
      }
    })

    // Timetable grouped by day
    const timetableData: Record<string, string[][]> = {}
    for (const t of (timetable ?? []) as Row[]) {
      const day = t.day as string
      if (!timetableData[day]) timetableData[day] = []
      timetableData[day].push([t.start_time, t.end_time, t.subject ?? '', t.class ?? '', t.room ?? ''])
    }

    // Today's schedule
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const today = days[new Date().getDay()]
    const todayEntries = timetableData[today] ?? []
    const now = new Date()
    const schedule: ScheduleItem[] = todayEntries.map(([start, end, subject, klass, room]) => {
      const [h] = start.split(':').map(Number)
      const ampm = h >= 12 ? 'PM' : 'AM'
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      const startH = new Date(); startH.setHours(h, 0, 0, 0)
      const [eh] = end.split(':').map(Number)
      const endH = new Date(); endH.setHours(eh, 0, 0, 0)
      const status = now > endH ? 'Done' : now >= startH ? 'Ongoing' : `${hour12}:00 ${ampm}`
      const statusColor = status === 'Done' ? '#2fa36b' : status === 'Ongoing' ? '#2a6fdb' : '#6b7689'
      const statusBg = status === 'Done' ? '#e7f5ee' : status === 'Ongoing' ? '#eaf1fc' : '#eef1f7'
      return { time: `${hour12}:00`, ampm, subject, klass, room, status, statusColor, statusBg }
    })

    // Subjects
    const subjectItems = subjectList

    // Results + Rankings
    const testMap: Record<string, Row> = Object.fromEntries((tests ?? []).map((t: Row) => [t.id, t]))
    const stuResults: StuResultItem[] = (results ?? []).map((r: Row) => {
      const test = testMap[r.test_id]
      return {
        subject: subjectMap[test?.subject_id] ?? 'Unknown',
        test: test?.name ?? 'Test', date: test?.date ?? '',
        marks: r.marks ?? 0, total: test?.max_marks ?? 100,
      }
    })

    // Compute rankings per subject from results
    const rankData: Record<string, [string, number][]> = {}
    const resultsBySubjectStudent: Record<string, Record<string, { total: number; max: number }>> = {}
    for (const r of (results ?? []) as Row[]) {
      const test = testMap[r.test_id]
      if (!test) continue
      const subjectName = subjectMap[test.subject_id] ?? 'Unknown'
      const student = studentMap[r.student_id]
      const studentName = student?.name ?? 'Unknown'
      if (!resultsBySubjectStudent[subjectName]) resultsBySubjectStudent[subjectName] = {}
      if (!resultsBySubjectStudent[subjectName][studentName]) resultsBySubjectStudent[subjectName][studentName] = { total: 0, max: 0 }
      resultsBySubjectStudent[subjectName][studentName].total += r.marks ?? 0
      resultsBySubjectStudent[subjectName][studentName].max += test.max_marks ?? 100
    }
    for (const [subject, students] of Object.entries(resultsBySubjectStudent)) {
      rankData[subject] = Object.entries(students)
        .map(([name, { total, max }]) => [name, max > 0 ? Math.round((total / max) * 100) : 0] as [string, number])
        .sort((a, b) => b[1] - a[1])
    }

    // Attendance log (for student view)
    const statusIcons: Record<string, { icon: string; tint: string; color: string }> = {
      Present: { icon: '✅', tint: '#e7f5ee', color: '#2fa36b' },
      Absent: { icon: '❌', tint: '#fdecea', color: '#e8553c' },
      Leave: { icon: '📋', tint: '#fcf3e3', color: '#e0962f' },
    }
    const stuAttendanceLog: AttLogItem[] = (attendance ?? []).slice(0, 15).map((a: Row) => {
      const d = new Date(a.date)
      const si = statusIcons[a.status] ?? statusIcons.Present
      return {
        day: d.toLocaleString('en', { weekday: 'long' }),
        date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        status: a.status, ...si,
      }
    })

    // Fee history + pending fee (for student view)
    const stuFeeHistory: FeeHistoryItem[] = (fees ?? []).filter((f: Row) => f.status === 'Paid').map((f: Row) => ({
      period: f.period ?? '',
      date: f.paid_date ? new Date(f.paid_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
      amount: `₹${(f.amount ?? 0).toLocaleString('en-IN')}`,
    }))
    const pendingFee = (fees ?? []).find((f: Row) => f.status !== 'Paid')
    const stuPendingFee = pendingFee ? {
      amount: `₹${(pendingFee.amount ?? 0).toLocaleString('en-IN')}`,
      period: pendingFee.period ?? '',
      dueDate: pendingFee.due_date ? new Date(pendingFee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
    } : null

    // Notifications (for student view)
    const stuNotifications: NotifItem[] = (notifications ?? []).map((n: Row) => ({
      icon: n.icon ?? '📢', tint: n.tint ?? '#eaf1fc',
      title: n.title ?? '', detail: n.detail ?? '',
      when: timeAgo(n.created_at), dbId: n.id,
    }))

    // Reminders as notifications
    const stuReminders: NotifItem[] = stuNotifications.slice(0, 3)

    set({
      branchesList, meetingsList, assignmentsList, timetableData, schedule,
      rankData, subjects: subjectItems, stuResults, stuAttendanceLog,
      stuFeeHistory, stuPendingFee, stuNotifications, stuReminders, pendingStudents,
    })
  }

  useEffect(() => {
    // If Google/Supabase rejected the sign-in, the reason comes back in the URL
    // (query OR hash) as ?error=...&error_description=... — surface it instead of
    // silently bouncing the user back to the login screen.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    const err = query.get('error_description') || query.get('error') || hash.get('error_description') || hash.get('error')
    if (err) {
      const msg = decodeURIComponent(err).replace(/\+/g, ' ')
      console.error('OAuth callback error:', msg)
      useDashboard.getState().notify(`Sign-in failed: ${msg}`)
      // Clean the URL so a refresh doesn't re-trigger the toast.
      window.history.replaceState({}, '', window.location.pathname)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleAuth(session.user.id, session.user.email ?? '')
      else resumeStudentOrLanding()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) handleAuth(session.user.id, session.user.email ?? '')
      else resumeStudentOrLanding()
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; auth listener must not rebind per render
  }, [])

  // Pull fresh data for whoever is signed in — approved staff get the full
  // dataset; a code-access student re-pulls their snapshot. Best-effort.
  const refreshCurrentData = () => {
    const st = useDashboard.getState()
    if (st.supabaseUserId && (st.role === 'admin' || st.role === 'teacher') && st.staffStatus === 'approved') {
      fetchAllData().catch(() => {}) // ignore transient failures
    } else if (!st.supabaseUserId && st.currentStudentDbId) {
      const code = localStorage.getItem('student_code')
      if (code) st.loadStudentByCode(code, false) // refresh without navigating
    }
  }

  // Refresh-on-focus: re-pull fresh data whenever the user returns to the app
  // (tab/app regains focus). Throttled so quick tab-switches don't spam queries.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRefresh.current < 8000) return
      lastRefresh.current = Date.now()
      refreshCurrentData()
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; focus listener reads fresh state via getState()
  }, [])

  // Instant in-app update: the push service worker posts a 'refresh' message the
  // moment a notification arrives, so a reminder appears in-app right away without
  // waiting for a focus change or reload (covers users sitting in the foreground).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'refresh') refreshCurrentData() }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; handler reads fresh state via getState()
  }, [])

  // Foreground poll (students only): a code-access student's snapshot is a single
  // cheap RPC, so re-pull it periodically while the app is visible — the fallback
  // for students who haven't enabled push (they get no service-worker message).
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const st = useDashboard.getState()
      if (!st.supabaseUserId && st.currentStudentDbId) {
        const code = localStorage.getItem('student_code')
        if (code) st.loadStudentByCode(code, false)
      }
    }, 60000)
    return () => clearInterval(id)
  }, [])

  return <>{children}</>
}

function mapTeacher(t: Record<string, unknown>): Teacher {
  return {
    name: t.name as string, subject: t.subject as string,
    experience: (t.experience as number) ?? 0, qualification: (t.qualification as string) ?? '—',
    rating: t.rating != null ? String(t.rating) : undefined,
    about: (t.about as string) ?? undefined, dbId: t.id as string,
  }
}

function mapStudent(s: Record<string, unknown>): Student {
  return {
    name: s.name as string, klass: (s.class as string) ?? '',
    attendance: 0, feeStatus: ((s.fee_status as string) ?? 'Due') as FeeStatus,
    school: (s.school as string) ?? '', parent: (s.parent_contact as string) ?? '',
    id: (s.student_code as string) ?? '', address: (s.address as string) ?? '',
    dbId: s.id as string, status: (s.status as string) ?? 'approved',
  }
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
```

## app/components/TeachingScreens.tsx

```ts
'use client'

import { useState } from 'react'
import { useDashboard, REMINDER_TEMPLATES, initials, av } from '../store'
import { ScreenHeader, PrimaryButton } from './Shell'

export function TimetableScreen() {
  const { ttDay, timetableData, back, set, addTimetableEntry, deleteTimetableEntry, updateTimetableEntry, subjects, students, role } = useDashboard()
  const isAdmin = role === 'admin'
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string[] | null>(null) // the original period being edited
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [subject, setSubject] = useState('')
  const [klass, setKlass] = useState('')
  const [room, setRoom] = useState('')
  const classes = [...new Set([...students.map(s => s.klass), ...(klass ? [klass] : [])])].filter(Boolean)
  const selKlass = klass || classes[0] || ''
  const days = (() => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)) // back to this week's Monday
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((s, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i)
      return { s, d: String(d.getDate()) }
    })
  })()
  const dayNames: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' }
  const periods = timetableData[ttDay] || []
  const subjectNames = subjects.map(s => s.name)

  const resetForm = () => { setStartTime('09:00'); setEndTime('10:00'); setSubject(''); setKlass(''); setRoom(''); setShowForm(false); setEditing(null) }

  const handleAdd = () => {
    if (!selKlass) return
    const subj = subject || subjectNames[0] || 'Free period'
    if (editing) updateTimetableEntry(ttDay, editing, startTime, endTime, subj, selKlass, room)
    else addTimetableEntry(ttDay, startTime, endTime, subj, selKlass, room)
    resetForm()
  }

  const startEdit = (p: string[]) => {
    setStartTime(p[0]); setEndTime(p[1]); setSubject(p[2]); setKlass(p[3]); setRoom(p[4] ?? '')
    setEditing(p); setShowForm(true)
  }

  const periodStyle = (p: string[]) => {
    const free = p[2] === 'Free period'
    const special = p[2].includes('Test') || p[2].includes('meeting') || p[2].includes('Doubt')
    return {
      dot: free ? '#c2cad8' : special ? '#e0962f' : '#2a6fdb',
      bg: free ? '#f4f6fb' : '#fff',
      border: free ? '#e6eaf2' : special ? '#f0e2c4' : '#dbe6fa',
      titleColor: free ? '#9aa4b6' : '#1a2332',
      tag: free ? 'Free' : special ? 'Special' : 'Class',
      pillColor: free ? '#9aa4b6' : special ? '#e0962f' : '#2a6fdb',
      pillBg: free ? '#eef1f7' : special ? '#fcf3e3' : '#eaf1fc',
    }
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6 td-wide">
      <ScreenHeader title="Timetable" onBack={back} right={isAdmin ? (
        <button onClick={() => (showForm ? resetForm() : setShowForm(true))} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
          <span className="text-base leading-none">{showForm ? '×' : '+'}</span> {showForm ? 'Close' : 'Add'}
        </button>
      ) : undefined} />

      <div className="flex gap-2 overflow-x-auto mb-[18px] scrollbar-hide lg:hidden">
        {days.map(d => {
          const active = d.s === ttDay
          return (
            <button key={d.s} onClick={() => set({ ttDay: d.s })} className="shrink-0 min-w-[48px] border rounded-[14px] py-[9px] px-1.5 cursor-pointer text-center" style={{ background: active ? '#2a6fdb' : '#fff', borderColor: active ? '#2a6fdb' : '#e6eaf2' }}>
              <div className="text-[11px] font-bold" style={{ color: active ? '#fff' : '#3a4456' }}>{d.s}</div>
              <div className="text-sm font-extrabold mt-0.5" style={{ color: active ? '#fff' : '#3a4456' }}>{d.d}</div>
            </button>
          )
        })}
      </div>

      {isAdmin && showForm && (
        <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5 lg:max-w-lg">
          <div className="text-sm font-extrabold text-td-dark">{editing ? 'Edit' : 'Add'} period — {dayNames[ttDay]}</div>
          <div className="grid grid-cols-2 gap-[11px]">
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Start</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
            </div>
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">End</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
            </div>
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Subject</label>
            <select value={subject || subjectNames[0] || 'Free period'} onChange={e => setSubject(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
              {subjectNames.map(s => <option key={s}>{s}</option>)}
              <option>Free period</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-[11px]">
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Class</label>
              <select value={selKlass} onChange={e => setKlass(e.target.value)} disabled={classes.length === 0} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none disabled:opacity-60">
                {classes.length ? classes.map(c => <option key={c}>{c}</option>) : <option value="">Add students first</option>}
              </select>
            </div>
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Room</label>
              <input value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Room 1" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
            </div>
          </div>
          <PrimaryButton onClick={handleAdd}>{editing ? 'Save changes' : 'Add period'}</PrimaryButton>
        </div>
      )}

      {/* Desktop: full Mon–Sat week grid. Click a day header to target it for
          adding; edit/delete act on that day's period directly. */}
      <div className="hidden lg:grid grid-cols-6 gap-3">
        {days.map(d => {
          const ps = timetableData[d.s] || []
          return (
            <div key={d.s} className={`rounded-2xl border p-2.5 min-h-[130px] ${d.s === ttDay ? 'border-td-primary bg-[#f7faff]' : 'border-td-border bg-white'}`}>
              <button onClick={() => set({ ttDay: d.s })} className="w-full text-center mb-2 cursor-pointer bg-transparent border-none">
                <div className="text-[11px] font-bold text-td-muted">{d.s}</div>
                <div className="text-[15px] font-extrabold text-td-dark">{d.d}</div>
              </button>
              {ps.length === 0 ? (
                <div className="text-center text-td-subtle text-[11px] py-3">—</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {ps.map((p, i) => {
                    const s = periodStyle(p)
                    return (
                      <div key={i} className="rounded-[11px] border p-2" style={{ background: s.bg, borderColor: s.border }}>
                        <div className="text-[10.5px] font-bold text-td-muted">{p[0]}–{p[1]}</div>
                        <div className="text-[12px] font-extrabold leading-tight mt-0.5" style={{ color: s.titleColor }}>{p[2]}</div>
                        <div className="text-[10.5px] text-td-muted mt-0.5">{p[3]}{p[4] ? ` · ${p[4]}` : ''}</div>
                        {isAdmin && (
                          <div className="flex gap-1 mt-1.5">
                            <button onClick={() => { set({ ttDay: d.s }); startEdit(p) }} className="flex-1 h-6 rounded-lg border border-[#dbe6fa] bg-[#eaf1fc] text-td-primary text-[11px] cursor-pointer">✎</button>
                            <button onClick={() => deleteTimetableEntry(d.s, p)} className="flex-1 h-6 rounded-lg border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12px] cursor-pointer">×</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="lg:hidden">
      <div className="text-[13px] text-td-muted font-semibold mb-3.5">{dayNames[ttDay]} · {periods.length} periods</div>

      {periods.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No periods scheduled for {dayNames[ttDay]}</div>
      ) : (
        <div className="flex flex-col">
          {periods.map((p, i) => {
            const s = periodStyle(p)
            return (
              <div key={i} className="flex gap-[13px] items-stretch">
                <div className="shrink-0 w-[58px] text-right pt-1">
                  <div className="text-[12.5px] font-extrabold text-td-dark">{p[0]}</div>
                  <div className="text-[10.5px] text-td-subtle font-semibold">{p[1]}</div>
                </div>
                <div className="shrink-0 flex flex-col items-center">
                  <div className="w-[11px] h-[11px] rounded-full border-2 border-white" style={{ background: s.dot, boxShadow: `0 0 0 2px ${s.dot}` }} />
                  <div className="flex-1 w-0.5 bg-td-border" />
                </div>
                <div className="flex-1 pb-3.5">
                  <div className="rounded-2xl p-[13px] px-[15px] border" style={{ background: s.bg, borderColor: s.border }}>
                    <div className="flex justify-between items-center gap-2">
                      <div className="text-sm font-extrabold" style={{ color: s.titleColor }}>{p[2]}</div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10.5px] font-bold py-1 px-[9px] rounded-[20px]" style={{ color: s.pillColor, background: s.pillBg }}>{s.tag}</span>
                        {isAdmin && <button onClick={() => startEdit(p)} className="w-6 h-6 rounded-full border border-[#dbe6fa] bg-[#eaf1fc] text-td-primary flex items-center justify-center cursor-pointer text-[12px] leading-none">✎</button>}
                        {isAdmin && <button onClick={() => deleteTimetableEntry(ttDay, p)} className="w-6 h-6 rounded-full border border-[#f4d8cf] bg-[#fdf3f0] text-td-red flex items-center justify-center cursor-pointer text-[15px] leading-none">×</button>}
                      </div>
                    </div>
                    <div className="text-xs text-td-muted mt-1">{p[3]} · {p[4]}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}

export function AttendanceScreen() {
  const { attClass, att, students, back, set, toggleAtt, saveAttendance } = useDashboard()
  const classes = [...new Set(students.map(s => s.klass))].filter(Boolean)
  const roster = students.filter(s => s.klass === attClass).map(s => s.name)
  const absentCount = roster.reduce((a, _, i) => a + (att[i] === 'absent' ? 1 : 0), 0)
  const presentCount = roster.length - absentCount

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6 td-wide">
      <div className="flex items-center gap-3.5 mb-[18px]">
        <button onClick={back} className="w-[42px] h-[42px] rounded-[14px] border border-td-border bg-white flex items-center justify-center cursor-pointer shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2332" strokeWidth="2.4" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div>
          <div className="text-xl font-extrabold text-td-dark">Mark Attendance</div>
          <div className="text-xs text-td-muted">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No students added yet</div>
      ) : (
        <>
          <div className="flex gap-[9px] overflow-x-auto mb-4 scrollbar-hide">
            {classes.map(name => {
              const active = name === attClass
              return (
                <button key={name} onClick={() => set({ attClass: name, att: {} })} className="shrink-0 text-[13px] font-bold py-[9px] px-4 rounded-[20px] cursor-pointer border" style={{ background: active ? '#2a6fdb' : '#fff', color: active ? '#fff' : '#3a4456', borderColor: active ? '#2a6fdb' : '#e6eaf2' }}>{name}</button>
              )
            })}
          </div>

          <div className="flex gap-2.5 mb-4">
            <div className="flex-1 bg-[#e7f5ee] rounded-[14px] p-3 text-center">
              <div className="text-[22px] font-extrabold text-td-green">{presentCount}</div>
              <div className="text-[11px] text-[#5a8a72] font-semibold">Present</div>
            </div>
            <div className="flex-1 bg-[#fdecea] rounded-[14px] p-3 text-center">
              <div className="text-[22px] font-extrabold text-td-red">{absentCount}</div>
              <div className="text-[11px] text-[#a35545] font-semibold">Absent</div>
            </div>
          </div>

          <div className="text-xs text-td-subtle font-semibold mb-2.5">Tap a student to toggle present / absent</div>
          <div className="flex flex-col gap-[9px] mb-5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
            {roster.map((name, i) => {
              const absent = att[i] === 'absent'
              return (
                <button key={name} onClick={() => toggleAtt(i)} className="text-left border rounded-2xl p-3 px-3.5 flex items-center gap-[13px] cursor-pointer" style={{ background: absent ? '#fdecea' : '#fff', borderColor: absent ? '#f4c4bc' : '#e6eaf2' }}>
                  <div className="w-[38px] h-[38px] rounded-[11px] shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i) }}>{initials(name)}</div>
                  <div className="flex-1 text-[13.5px] font-bold text-td-dark">{name}</div>
                  <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: absent ? '#e8553c' : '#2fa36b' }}>
                    <span className="w-[9px] h-[9px] rounded-full" style={{ background: absent ? '#e8553c' : '#2fa36b' }} />
                    {absent ? 'Absent' : 'Present'}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="lg:max-w-xs"><PrimaryButton onClick={() => saveAttendance(roster)}>Save attendance</PrimaryButton></div>
        </>
      )}
    </div>
  )
}

export function ResultsScreen() {
  const { students, subjects, back, notify } = useDashboard()
  const [klass, setKlass] = useState('')
  const [subject, setSubject] = useState('')
  const [testName, setTestName] = useState('Unit Test')
  const [maxMarks, setMaxMarks] = useState('50')
  const [marks, setMarks] = useState<Record<number, string>>({})
  const classes = [...new Set(students.map(s => s.klass))].filter(Boolean)
  const selKlass = klass || classes[0] || ''
  const roster = students.filter(s => s.klass === selKlass).map(s => s.name)
  const subjectNames = subjects.map(s => s.name)
  const selSubject = subject || subjectNames[0] || ''

  const handlePublish = async () => {
    if (!testName.trim()) { notify('Enter test name'); return }
    if (!selKlass) { notify('Add students first'); return }
    if (!selSubject) { notify('Add a subject first (More → Subjects)'); return }
    const { supabase } = await import('../lib/supabase')
    const subjectId = useDashboard.getState().subjects.find(s => s.name === selSubject)?.dbId
    const { data: test, error } = await supabase.from('tests').insert({
      name: testName, subject_id: subjectId ?? null, class: selKlass,
      max_marks: Number(maxMarks) || 50, date: new Date().toISOString().split('T')[0],
    }).select().single()
    if (error || !test) { notify('Could not publish — try again'); return }
    const resultRows = Object.entries(marks).map(([idx, m]) => {
      const student = students.filter(s => s.klass === selKlass)[Number(idx)]
      if (!student?.dbId || !m) return null
      return { test_id: test.id, student_id: student.dbId, marks: Number(m) }
    }).filter((r): r is NonNullable<typeof r> => r !== null)
    if (resultRows.length) {
      await supabase.from('results').insert(resultRows)
      useDashboard.getState().notifyClass(selKlass, 'New results published', `${testName} · ${selSubject} — check your marks in the app`, '📊')
    }
    notify('Results published & parents notified')
    setMarks({})
  }

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Enter Results" onBack={back} />

      <div className="grid grid-cols-2 gap-[11px] mb-[13px]">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Class</label>
          <select value={selKlass} onChange={e => setKlass(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
            {classes.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Subject</label>
          <select value={selSubject} onChange={e => setSubject(e.target.value)} disabled={subjectNames.length === 0} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none disabled:opacity-60">
            {subjectNames.length ? subjectNames.map(s => <option key={s}>{s}</option>) : <option value="">Add subjects first</option>}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-[11px] mb-[18px]">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Test name</label><input value={testName} onChange={e => setTestName(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Max</label><input value={maxMarks} onChange={e => setMaxMarks(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] text-td-dark outline-none focus:border-td-primary" /></div>
      </div>

      <div className="text-sm font-extrabold text-td-dark mb-3">Enter marks</div>
      {roster.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No students in {selKlass || 'this class'}</div>
      ) : (
        <div className="flex flex-col gap-[9px] mb-5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {roster.map((name, i) => (
            <div key={name} className="border border-td-border bg-white rounded-2xl p-[11px] px-3.5 flex items-center gap-[13px]">
              <div className="w-9 h-9 rounded-[11px] shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i) }}>{initials(name)}</div>
              <div className="flex-1 text-[13.5px] font-bold text-td-dark">{name}</div>
              <input value={marks[i] ?? ''} onChange={e => setMarks(m => ({ ...m, [i]: e.target.value }))} placeholder="—" className="w-[62px] text-center border border-td-border rounded-[11px] py-[9px] px-1.5 text-sm font-bold text-td-dark outline-none focus:border-td-primary" />
              <span className="text-[13px] text-td-subtle font-semibold">/{maxMarks}</span>
            </div>
          ))}
        </div>
      )}
      <div className="lg:max-w-xs"><PrimaryButton onClick={handlePublish}>Publish results</PrimaryButton></div>
    </div>
  )
}

export function AssignmentsScreen() {
  const { back, assignmentsList, saveAssignment, subjects, students } = useDashboard()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [klass, setKlass] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [instructions, setInstructions] = useState('')
  const subjectNames = subjects.map(s => s.name)
  const selSubject = subject || subjectNames[0] || ''
  const classes = [...new Set(students.map(s => s.klass))].filter(Boolean)
  const selKlass = klass || classes[0] || ''

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="New Assignment" onBack={back} />

      <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[22px] flex flex-col gap-3.5">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Algebra worksheet 5" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Subject</label>
            <select value={selSubject} onChange={e => setSubject(e.target.value)} disabled={subjectNames.length === 0} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none disabled:opacity-60">
              {subjectNames.length ? subjectNames.map(s => <option key={s}>{s}</option>) : <option value="">Add subjects first</option>}
            </select>
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Class</label>
            <select value={selKlass} onChange={e => setKlass(e.target.value)} disabled={classes.length === 0} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none disabled:opacity-60">
              {classes.length ? classes.map(c => <option key={c}>{c}</option>) : <option value="">Add students first</option>}
            </select>
          </div>
        </div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Due date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Instructions</label><textarea rows={3} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Describe the task..." className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none resize-none focus:border-td-primary" /></div>
        <PrimaryButton onClick={() => { if (!selKlass) return; saveAssignment(title, selSubject, selKlass, dueDate, instructions); setTitle(''); setInstructions('') }}>Create &amp; notify class</PrimaryButton>
      </div>

      <div className="text-[15px] font-extrabold text-td-dark mb-3">Active assignments</div>
      {assignmentsList.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-4">No assignments yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {assignmentsList.map(a => (
            <div key={a.title + a.due} className="bg-white border border-td-border rounded-2xl p-3.5">
              <div className="flex justify-between items-start">
                <div className="text-[13.5px] font-bold text-td-dark">{a.title}</div>
                <span className="text-[11px] font-bold text-td-amber bg-[#fcf3e3] py-1 px-[9px] rounded-[20px] whitespace-nowrap">Due {a.due}</span>
              </div>
              <div className="text-xs text-td-muted mt-[5px]">{a.klass} · {a.total} students</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RemindersScreen() {
  const { reminderType, back, set, saveReminder } = useDashboard()
  const [message, setMessage] = useState(REMINDER_TEMPLATES[reminderType] ?? '')
  const [filter, setFilter] = useState('all')
  const types = [
    { key: 'Test', label: 'Test', icon: '📝' },
    { key: 'Absence', label: 'Absence', icon: '🟡' },
    { key: 'Fee', label: 'Fee', icon: '💳' },
    { key: 'Homework', label: 'Homework', icon: '📚' },
  ]

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Send Reminder" onBack={back} />

      <label className="text-xs font-bold text-td-muted mb-2.5 block">Type</label>
      <div className="grid grid-cols-2 gap-2.5 mb-[18px]">
        {types.map(r => {
          const active = r.key === reminderType
          return (
            <button key={r.key} onClick={() => { set({ reminderType: r.key }); setMessage(REMINDER_TEMPLATES[r.key] ?? '') }} className="border rounded-2xl p-3.5 cursor-pointer flex items-center gap-[11px]" style={{ background: active ? '#eaf1fc' : '#fff', borderColor: active ? '#2a6fdb' : '#e6eaf2' }}>
              <span className="text-xl">{r.icon}</span>
              <span className="text-[13.5px] font-bold" style={{ color: active ? '#2a6fdb' : '#3a4456' }}>{r.label}</span>
            </button>
          )
        })}
      </div>

      <label className="text-xs font-bold text-td-muted mb-[7px] block">Send to</label>
      <select value={filter} onChange={e => setFilter(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none mb-4">
        <option value="all">All students</option>
        <option value="absentees">Absentees only</option>
        <option value="fees_due">Students with fees due</option>
      </select>

      <label className="text-xs font-bold text-td-muted mb-[7px] block">Message</label>
      <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none resize-none mb-[18px] focus:border-td-primary" />

      <PrimaryButton onClick={() => saveReminder(reminderType, message, 'all', filter)}>Send to students</PrimaryButton>
    </div>
  )
}
```

## app/components/UtilityScreens.tsx

```ts
'use client'

import { useState, useEffect, useRef } from 'react'
import { useDashboard, REMINDER_TEMPLATES, initials, av, feeColor, type Screen } from '../store'
import { ScreenHeader, PrimaryButton, ChevronRight } from './Shell'
import { enablePush, pushSupported } from '../lib/push'
import { fileToLogoDataUrl } from '../lib/image'

export function FeesScreen() {
  const { students, back, notify, addFee, toggleFeeStatus, saveReminder } = useDashboard()
  const [showForm, setShowForm] = useState(false)
  const [selStudent, setSelStudent] = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState('')
  const [dueDate, setDueDate] = useState('')
  const paidCount = students.filter(s => s.feeStatus === 'Paid').length
  const pendingCount = students.filter(s => s.feeStatus !== 'Paid').length
  const rows = [...students.filter(d => d.feeStatus !== 'Paid'), ...students.filter(d => d.feeStatus === 'Paid')]

  const handleAdd = () => {
    if (!selStudent) { notify('Select a student'); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { notify('Enter a valid amount'); return }
    if (!period.trim()) { notify('Enter the fee period'); return }
    if (!dueDate) { notify('Select a due date'); return }
    addFee(selStudent, amt, period.trim(), dueDate)
    setSelStudent(''); setAmount(''); setPeriod(''); setDueDate(''); setShowForm(false)
  }

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Fees" onBack={back} right={
        <button onClick={() => setShowForm(f => !f)} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
          <span className="text-base leading-none">{showForm ? '×' : '+'}</span> {showForm ? 'Close' : 'Add fee'}
        </button>
      } />

      <div className="flex gap-2.5 mb-[18px] lg:max-w-md">
        <div className="flex-1 bg-[#e7f5ee] rounded-2xl p-3.5">
          <div className="text-[22px] font-extrabold text-td-green">{paidCount}</div>
          <div className="text-[11px] text-[#5a8a72] font-semibold mt-[3px]">Paid</div>
        </div>
        <div className="flex-1 bg-[#fdecea] rounded-2xl p-3.5">
          <div className="text-[22px] font-extrabold text-td-red">{pendingCount}</div>
          <div className="text-[11px] text-[#a35545] font-semibold mt-[3px]">Pending</div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5 lg:max-w-lg">
          <div className="text-sm font-extrabold text-td-dark">Add fee record</div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Student</label>
            <select value={selStudent} onChange={e => setSelStudent(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
              <option value="">Select student</option>
              {students.map(s => <option key={s.dbId ?? s.id} value={s.dbId ?? ''}>{s.name} — {s.klass}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-[11px]">
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Amount (&#8377;)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
            </div>
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Period</label>
              <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. July 2026" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
            </div>
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Due date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
          </div>
          <PrimaryButton onClick={handleAdd}>Add fee record</PrimaryButton>
        </div>
      )}

      <button onClick={() => { if (pendingCount === 0) { notify('No pending fees'); return } saveReminder('Fee', REMINDER_TEMPLATES.Fee, 'all', 'fees_due') }} className="w-full lg:max-w-md border border-td-red bg-white text-td-red text-sm font-extrabold p-[13px] rounded-[14px] cursor-pointer mb-[18px]">Send alert to all pending</button>

      {rows.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No students added yet</div>
      ) : (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {rows.map(d => {
            const realIdx = students.findIndex(s => s.id === d.id)
            const f = feeColor(d.feeStatus)
            return (
              <div key={d.id} className="bg-white border border-td-border rounded-2xl p-[13px] px-3.5 flex items-center gap-[13px]">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(realIdx) }}>{initials(d.name)}</div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-bold text-td-dark">{d.name}</div>
                  <div className="text-xs text-td-muted mt-0.5">{d.klass}</div>
                </div>
                <button onClick={() => toggleFeeStatus(realIdx)} className="text-[10.5px] font-bold py-[5px] px-2.5 rounded-[20px] border-none cursor-pointer" style={{ color: f.c, background: f.b }}>{d.feeStatus}</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MeetingsScreen() {
  const { back, meetingsList, saveMeeting } = useDashboard()
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Parent-teacher meeting')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('11:00 AM')

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Meetings" onBack={back} />

      <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[22px] flex flex-col gap-3.5">
        <div className="text-sm font-extrabold text-td-dark">Schedule new</div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Parent-teacher meeting" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
            <option>Parent-teacher meeting</option><option>Staff meeting</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Time</label><input value={time} onChange={e => setTime(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        </div>
        <PrimaryButton onClick={() => { saveMeeting(title, type, date, time); setTitle(''); setDate('') }}>Schedule &amp; invite</PrimaryButton>
      </div>

      <div className="text-[15px] font-extrabold text-td-dark mb-3">Upcoming</div>
      {meetingsList.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-4">No meetings scheduled</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {meetingsList.map(m => (
            <div key={m.title + m.day} className="bg-white border border-td-border rounded-2xl p-3.5 flex items-center gap-[13px]">
              <div className="w-[46px] text-center shrink-0 bg-[#eaf1fc] rounded-xl py-2">
                <div className="text-base font-extrabold text-td-primary leading-none">{m.day}</div>
                <div className="text-[10px] text-td-primary font-semibold mt-0.5">{m.mon}</div>
              </div>
              <div className="flex-1">
                <div className="text-[13.5px] font-bold text-td-dark">{m.title}</div>
                <div className="text-xs text-td-muted mt-0.5">{m.time} · {m.kind}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RankingsScreen() {
  const { rankSubject, rankData, subjects, back, set, go } = useDashboard()
  const subjectNames = subjects.map(s => s.name)
  const rows = (rankData[rankSubject] || []).map((r, i) => ({ rank: i + 1, name: r[0], score: r[1] }))

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Rankings" onBack={back} />

      {subjectNames.length === 0 && (
        <button onClick={() => go('subjects', 'more')} className="w-full text-left bg-[#eaf1fc] border border-[#dbe6fa] rounded-[14px] p-3.5 cursor-pointer text-[12.5px] text-td-primary font-semibold">Add subjects first (More → Subjects) so rankings can be grouped by subject.</button>
      )}

      <div className="flex gap-[9px] overflow-x-auto mb-[18px] scrollbar-hide">
        {subjectNames.map(name => {
          const active = name === rankSubject
          return (
            <button key={name} onClick={() => set({ rankSubject: name })} className="shrink-0 text-[13px] font-bold py-[9px] px-4 rounded-[20px] cursor-pointer border" style={{ background: active ? '#2a6fdb' : '#fff', color: active ? '#fff' : '#3a4456', borderColor: active ? '#2a6fdb' : '#e6eaf2' }}>{name}</button>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">{rankSubject ? `No results entered for ${rankSubject} yet` : 'Enter results to generate rankings'}</div>
      ) : (
        <div className="flex flex-col gap-[9px] mb-5">
          {rows.map((r, i) => (
            <div key={r.name} className="flex items-center gap-[13px] bg-white border border-td-border rounded-2xl p-3 px-3.5">
              <div className="w-[26px] text-center text-sm font-extrabold" style={{ color: i < 3 ? '#e0962f' : '#9aa4b6' }}>{r.rank}</div>
              <div className="w-9 h-9 rounded-[11px] shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i) }}>{initials(r.name)}</div>
              <div className="flex-1 text-[13.5px] font-bold text-td-dark">{r.name}</div>
              <div className="text-sm font-extrabold text-td-dark">{r.score}%</div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2.5 bg-[#eaf1fc] border border-[#dbe6fa] rounded-[14px] p-3.5 mt-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>
        <span className="text-[12.5px] text-td-primary font-semibold">Rankings update automatically — students always see the latest.</span>
      </div>
    </div>
  )
}

export function BranchesScreen() {
  const { back, branchesList, addBranch, deleteBranch } = useDashboard()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [isMain, setIsMain] = useState(false)

  const handleAdd = () => {
    if (!name.trim()) { useDashboard.getState().notify('Enter branch name'); return }
    addBranch(name.trim(), address.trim(), isMain)
    setName(''); setAddress(''); setIsMain(false); setShowForm(false)
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Branches" onBack={back} right={
        <button onClick={() => setShowForm(f => !f)} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
          <span className="text-base leading-none">{showForm ? '×' : '+'}</span> {showForm ? 'Close' : 'Add'}
        </button>
      } />

      {showForm && (
        <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5">
          <div className="text-sm font-extrabold text-td-dark">New branch</div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Branch name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Satellite Centre" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 123 Main Street" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isMain} onChange={e => setIsMain(e.target.checked)} className="w-5 h-5 accent-[#2a6fdb] rounded" />
            <span className="text-[13px] font-bold text-td-dark">Set as main branch</span>
          </label>
          <PrimaryButton onClick={handleAdd}>Add branch</PrimaryButton>
        </div>
      )}

      {branchesList.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No branches configured</div>
      ) : (
        <div className="flex flex-col gap-3">
          {branchesList.map(b => (
            <div key={b.name} className="bg-white border border-td-border rounded-[18px] p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-[15px] font-extrabold text-td-dark">{b.name}</div>
                {b.main && <span className="text-[10px] font-bold text-td-primary bg-[#eaf1fc] py-1 px-[9px] rounded-[20px]">Main</span>}
              </div>
              <div className="text-[12.5px] text-td-muted mb-3">{b.address}</div>
              <div className="flex items-center justify-between">
                <div className="flex gap-[18px]">
                  <div><div className="text-base font-extrabold text-td-dark">{b.students}</div><div className="text-[11px] text-td-subtle font-semibold">Students</div></div>
                  <div><div className="text-base font-extrabold text-td-dark">{b.staff}</div><div className="text-[11px] text-td-subtle font-semibold">Staff</div></div>
                </div>
                {b.dbId && <button onClick={() => deleteBranch(b.dbId!)} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12px] font-bold py-2 px-3.5 rounded-[12px] cursor-pointer">Remove</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SubjectsScreen() {
  const { subjects, back, addSubject, deleteSubject } = useDashboard()
  const [name, setName] = useState('')

  const handleAdd = () => {
    if (!name.trim()) { useDashboard.getState().notify('Enter subject name'); return }
    addSubject(name.trim())
    setName('')
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Subjects" onBack={back} />

      <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5">
        <div className="text-sm font-extrabold text-td-dark">Add subject</div>
        <div className="flex gap-[11px]">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mathematics" className="flex-1 border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} className="border-none bg-td-primary text-white text-sm font-bold py-[13px] px-5 rounded-[14px] cursor-pointer shrink-0">Add</button>
        </div>
      </div>

      <div className="text-[15px] font-extrabold text-td-dark mb-3">All subjects ({subjects.length})</div>
      {subjects.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No subjects added yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {subjects.map((s, i) => (
            <div key={s.name} className="bg-white border border-td-border rounded-2xl p-[13px] px-[15px] flex items-center gap-[13px]">
              <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[14px]" style={{ background: av(i) }}>{s.name[0]}</div>
              <div className="flex-1 text-[14px] font-bold text-td-dark">{s.name}</div>
              {s.dbId && <button onClick={() => { if (window.confirm(`Remove "${s.name}" everywhere? Its tests, results and timetable periods will be deleted too.`)) deleteSubject(s.dbId!) }} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12px] font-bold py-1.5 px-3 rounded-[11px] cursor-pointer">Remove</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type MoreItem = { icon: string; label: string; tint: string; screen: Screen; badge?: number }

export function MoreScreen() {
  const { go, signOut, role, myName, googleEmail, staffList, loadStaff, pendingStudents } = useDashboard()
  const isAdmin = role === 'admin'
  const profileName = myName || googleEmail?.split('@')[0] || (isAdmin ? 'Head teacher' : 'Teacher')

  // Head: keep the approvals badge fresh (Admin Dashboard now lives here).
  useEffect(() => { if (isAdmin) loadStaff() }, [isAdmin, loadStaff])
  const pendingCount = staffList.filter(s => s.status === 'pending').length
  const studentRequestCount = pendingStudents.length

  const daily: MoreItem[] = [
    { icon: '🙋', label: 'Student requests', tint: '#e7f5ee', screen: 'studentRequests', badge: studentRequestCount },
    { icon: '✅', label: 'Mark attendance', tint: '#e7f5ee', screen: 'attendance' },
    { icon: '📊', label: 'Enter results', tint: '#eaf1fc', screen: 'results' },
    { icon: '📚', label: 'Assignments', tint: '#fcf3e3', screen: 'assign' },
    { icon: '📄', label: 'Study material', tint: '#eef0fc', screen: 'notes' },
    { icon: '🔔', label: 'Send reminders', tint: '#fdecea', screen: 'reminder' },
  ]
  const management: MoreItem[] = [
    { icon: '🛡️', label: 'Staff access & approvals', tint: '#eef0fc', screen: 'staffApprovals', badge: pendingCount },
    { icon: '📈', label: 'Weekly report', tint: '#e7f5ee', screen: 'reports' },
    { icon: '💳', label: 'Fees & alerts', tint: '#e7f5ee', screen: 'fees' },
    { icon: '🏆', label: 'Rankings', tint: '#fcf3e3', screen: 'rankings' },
    { icon: '📅', label: 'Meetings', tint: '#eaf1fc', screen: 'meetings' },
    { icon: '🏢', label: 'Branches', tint: '#eef0fc', screen: 'branches' },
    { icon: '📖', label: 'Subjects', tint: '#eaf1fc', screen: 'subjects' },
  ]

  const card = (list: MoreItem[]) => (
    <div className="bg-white border border-td-border rounded-[20px] overflow-hidden">
      {list.map(m => (
        <button key={m.label} onClick={() => go(m.screen, 'more')} className="w-full text-left border-none bg-transparent border-b border-[#f0f2f7] p-[15px] px-[17px] flex items-center gap-3.5 cursor-pointer last:border-b-0">
          <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-lg" style={{ background: m.tint }}>{m.icon}</div>
          <div className="flex-1 text-sm font-bold text-td-dark">{m.label}</div>
          {!!m.badge && m.badge > 0 && <span className="text-[11px] font-extrabold text-white bg-td-red rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">{m.badge}</span>}
          <ChevronRight />
        </button>
      ))}
    </div>
  )

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="text-2xl font-extrabold text-td-dark mt-1.5 mb-[18px]">More tools</div>

      <button onClick={() => go('staffProfile', 'more')} className="w-full text-left bg-white border border-td-border rounded-[20px] p-3.5 flex items-center gap-3.5 cursor-pointer mb-4">
        <div className="w-[46px] h-[46px] rounded-[14px] shrink-0 flex items-center justify-center text-white font-bold text-[15px]" style={{ background: av(0) }}>{initials(profileName)}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-td-dark truncate">{profileName}</div>
          <div className="text-xs text-td-muted mt-0.5 truncate">{googleEmail} · {isAdmin ? 'Head teacher' : 'Teacher'}</div>
        </div>
        <ChevronRight />
      </button>

      {card(daily)}

      {isAdmin && (
        <>
          <div className="text-[13px] font-extrabold text-td-muted mt-5 mb-[11px] px-1">Management</div>
          {card(management)}
        </>
      )}

      <button onClick={signOut} className="w-full border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-sm font-extrabold p-[15px] rounded-2xl cursor-pointer mt-4 flex items-center justify-center gap-[9px]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e8553c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
        Sign out
      </button>
    </div>
  )
}

export function StaffProfileScreen() {
  const { go, role, myName, myPhone, googleEmail, saveStaffProfile, signOut, centreName, centreLogo, loadMyCentre, renameCentre, saveCentreLogo, supabaseUserId, notify } = useDashboard()
  const isAdmin = role === 'admin'
  const logoInput = useRef<HTMLInputElement>(null)
  const [logoBusy, setLogoBusy] = useState(false)
  const pickLogo = async (file?: File) => {
    if (!file) return
    setLogoBusy(true)
    try { await saveCentreLogo(await fileToLogoDataUrl(file)) }
    catch (e) { notify(e instanceof Error ? e.message : 'Could not use that image') }
    finally { setLogoBusy(false); if (logoInput.current) logoInput.current.value = '' }
  }
  const [pushOn, setPushOn] = useState(false)
  const enableNotifs = async () => {
    if (!supabaseUserId) return
    const res = await enablePush('profile', supabaseUserId)
    if (res.ok) { setPushOn(true); notify('Notifications on for this device') }
    else notify(res.error || 'Could not enable')
  }
  const [name, setName] = useState(myName)
  const [phone, setPhone] = useState(myPhone)
  const [centre, setCentre] = useState(centreName)
  const [busy, setBusy] = useState(false)
  const displayName = name || googleEmail?.split('@')[0] || (isAdmin ? 'Head teacher' : 'Teacher')

  useEffect(() => { if (isAdmin && !centreName) loadMyCentre() }, [isAdmin, centreName, loadMyCentre])

  // Sync the input when the centre name arrives (adjust-during-render pattern).
  const [prevCentreName, setPrevCentreName] = useState(centreName)
  if (centreName !== prevCentreName) { setPrevCentreName(centreName); setCentre(centreName) }

  const save = async () => {
    setBusy(true)
    await saveStaffProfile(name, phone)
    if (isAdmin && centre.trim() && centre.trim() !== centreName) await renameCentre(centre)
    setBusy(false)
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="My Profile" onBack={() => go('more', 'more')} />

      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-[76px] h-[76px] rounded-[24px] flex items-center justify-center text-white font-extrabold text-[26px] mb-3" style={{ background: av(0) }}>{initials(displayName)}</div>
        <div className="text-[18px] font-extrabold text-td-dark">{displayName}</div>
        <div className="text-[12.5px] text-td-muted mt-0.5">{googleEmail}</div>
        <div className="inline-flex items-center gap-[6px] bg-[#e7f5ee] rounded-[20px] py-[5px] px-[11px] mt-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-td-green" />
          <span className="text-[11px] font-bold text-td-green">{isAdmin ? 'Head teacher' : 'Teacher'}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 mb-[18px]">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Full name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        {isAdmin && (
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Centre name</label><input value={centre} onChange={e => setCentre(e.target.value)} placeholder="e.g. Bright Future Tuition" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        )}
        {isAdmin && (
          <div>
            <label className="text-xs font-bold text-td-muted mb-[7px] block">Centre logo</label>
            <div className="flex items-center gap-3.5 border border-td-border rounded-[14px] p-3">
              <div className="w-14 h-14 rounded-[14px] overflow-hidden shrink-0 flex items-center justify-center bg-[#f4f6fb] border border-td-border">
                {centreLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={centreLogo} alt="Centre logo" className="w-full h-full object-cover" />
                  : <span className="font-extrabold text-td-primary text-xl">{initials(centre || centreName || 'S')}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex gap-2">
                  <button onClick={() => logoInput.current?.click()} disabled={logoBusy} className="border border-td-border bg-white text-td-dark text-[12.5px] font-extrabold py-2 px-3.5 rounded-[11px] cursor-pointer disabled:opacity-60">{logoBusy ? 'Uploading…' : centreLogo ? 'Change' : 'Upload'}</button>
                  {centreLogo && !logoBusy && (
                    <button onClick={() => saveCentreLogo('')} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12.5px] font-extrabold py-2 px-3.5 rounded-[11px] cursor-pointer">Remove</button>
                  )}
                </div>
                <p className="text-[11.5px] text-td-muted mt-1.5 leading-snug">Students who log in with your centre code see this logo.</p>
              </div>
              <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={e => pickLogo(e.target.files?.[0])} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2.5 bg-[#f4f6fb] border border-[#e6eaf2] rounded-[14px] p-3">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa4b6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          <span className="text-[12px] text-td-muted">Your email is managed by Google and can&apos;t be changed here.</span>
        </div>
      </div>

      <PrimaryButton onClick={busy ? () => {} : save}>{busy ? 'Saving…' : 'Save changes'}</PrimaryButton>

      {pushSupported() && (
        <button onClick={enableNotifs} disabled={pushOn} className="w-full border border-td-border bg-white text-td-dark text-sm font-extrabold p-[15px] rounded-2xl cursor-pointer mt-3 flex items-center justify-center gap-2 disabled:opacity-60">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
          {pushOn ? 'Notifications enabled' : 'Enable notifications'}
        </button>
      )}

      <button onClick={signOut} className="w-full border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-sm font-extrabold p-[15px] rounded-2xl cursor-pointer mt-3 flex items-center justify-center gap-[9px]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e8553c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
        Sign out
      </button>
    </div>
  )
}
```

## app/globals.css

```css
@import "tailwindcss";

@theme {
  --color-td-primary: #2a6fdb;
  --color-td-dark: #1a2332;
  --color-td-green: #2fa36b;
  --color-td-red: #e8553c;
  --color-td-amber: #e0962f;
  --color-td-bg: #f4f6fb;
  --color-td-border: #e6eaf2;
  --color-td-muted: #6b7689;
  --color-td-subtle: #9aa4b6;
  --color-td-text: #3a4456;
  --color-td-pink: #d94f8a;
  --color-td-teal: #3aa0c4;
}

*, *::before, *::after { box-sizing: border-box; }
/* JS sets --app-h to the exact visible innerHeight; 100dvh is the pre-hydration
   fallback. Android Chrome updates dvh unreliably when the URL bar toggles on a
   refresh, so the shell height is driven by --app-h instead (see layout.tsx). */
:root { --app-h: 100dvh; }
html, body { margin: 0; padding: 0; height: 100%; }
body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
/* Mobile: lock the document so ONLY the app shell's inner area scrolls. Stops the
   URL bar show/hide — and the browser's reload scroll-restoration — from pushing
   the bottom nav and action buttons below the fold after a refresh. */
@media (max-width: 767px) {
  body { overflow: hidden; overscroll-behavior: none; }
}
/* Phone shell height tracks the real visible viewport on mobile; the desktop
   mockup uses its fixed aspect ratio instead. */
.app-frame { height: var(--app-h); }
@media (min-width: 768px) { .app-frame { height: auto; } }

@keyframes pop {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}

@keyframes toastIn {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: none; }
}

.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { scrollbar-width: none; }

/* Desktop staff console: every screen renders as a readable centered column by
   default (forms, lists), while data-heavy screens opt into full width with the
   .td-wide class. Only applies inside the desktop shell — the phone layout and
   the student app are never touched. */
.td-desktop > * { max-width: 760px; margin-inline: auto; }
.td-desktop > .td-wide { max-width: none; }
```

## app/layout.tsx

```ts
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Second Skool',
  description: 'Second Skool — attendance, results, fees, rankings & more.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Second Skool', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover', // lets the app use safe-area insets on notched phones
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Drive the app-shell height from the real visible viewport height.
            Runs before paint (no flash) and re-syncs when the URL bar toggles,
            the keyboard opens, or the device rotates — so a refresh never leaves
            the bottom nav / buttons below the fold. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function s(){document.documentElement.style.setProperty('--app-h',window.innerHeight+'px')}s();addEventListener('resize',s);addEventListener('orientationchange',s);window.visualViewport&&visualViewport.addEventListener('resize',s)})()",
          }}
        />
      </head>
      <body className={jakarta.className}>{children}</body>
    </html>
  )
}
```

## app/lib/database.types.ts

```ts
export type Role = 'admin' | 'teacher' | 'student'
export type FeeStatus = 'Paid' | 'Due' | 'Overdue'
export type AttendanceStatus = 'Present' | 'Absent' | 'Leave'
export type ReminderType = 'Test' | 'Absence' | 'Fee' | 'Homework'
export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
export type PlanType = 'Monthly' | 'Half-yearly' | 'Yearly'
export type SubStatus = 'active' | 'cancelled' | 'expired'

export interface Profile {
  id: string
  role: Role
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  branch_id: string | null
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  name: string
  address: string | null
  is_main: boolean
  created_at: string
}

export interface Teacher {
  id: string
  profile_id: string | null
  name: string
  subject: string
  experience: number
  qualification: string | null
  rating: number | null
  about: string | null
  branch_id: string | null
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  profile_id: string | null
  student_code: string
  name: string
  class: string
  school: string | null
  parent_contact: string | null
  address: string | null
  fee_status: FeeStatus
  branch_id: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface Attendance {
  id: string
  student_id: string
  date: string
  status: AttendanceStatus
  marked_by: string | null
  created_at: string
}

export interface Subject {
  id: string
  name: string
  created_at: string
}

export interface Test {
  id: string
  name: string
  subject_id: string
  class: string
  max_marks: number
  date: string
  created_by: string | null
  created_at: string
}

export interface Result {
  id: string
  test_id: string
  student_id: string
  marks: number
  created_at: string
}

export interface Assignment {
  id: string
  title: string
  subject_id: string | null
  class: string
  due_date: string
  instructions: string | null
  created_by: string | null
  created_at: string
}

export interface Fee {
  id: string
  student_id: string
  amount: number
  period: string
  due_date: string
  paid_date: string | null
  status: FeeStatus
  created_at: string
}

export interface Meeting {
  id: string
  title: string
  meeting_type: string | null
  date: string
  time: string | null
  description: string | null
  created_by: string | null
  branch_id: string | null
  created_at: string
}

export interface Reminder {
  id: string
  type: ReminderType
  message: string
  target_class: string | null
  sent_by: string | null
  created_at: string
}

export interface Notification {
  id: string
  student_id: string
  title: string
  detail: string | null
  icon: string
  read: boolean
  created_at: string
}

export interface TimetableEntry {
  id: string
  day: Day
  start_time: string
  end_time: string
  subject: string
  class: string
  room: string | null
  teacher_id: string | null
  branch_id: string | null
  created_at: string
}

export interface Subscription {
  id: string
  branch_id: string
  plan: PlanType
  price: number
  starts_at: string
  renews_at: string
  status: SubStatus
  created_at: string
}
```

## app/lib/image.ts

```ts
// Client-side logo processing. Centre logos are stored as small data-URLs in
// the DB (no storage bucket needed for the pilot), so the source image is
// downscaled to a square and re-encoded to keep the payload tiny.

const MAX_SOURCE_BYTES = 5 * 1024 * 1024 // reject > 5MB uploads before decoding
const OUT_SIZE = 256 // final logo edge, px

// Decode an image File, center-crop to a square, downscale to OUT_SIZE, and
// return a PNG data-URL (PNG keeps logo transparency). Rejects non-images and
// oversized files with a user-friendly message.
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Image is too large — pick one under 5MB')

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const sx = (img.naturalWidth - side) / 2
    const sy = (img.naturalHeight - side) / 2

    const canvas = document.createElement('canvas')
    canvas.width = OUT_SIZE
    canvas.height = OUT_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process the image')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, side, side, 0, 0, OUT_SIZE, OUT_SIZE)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = src
  })
```

## app/lib/push.ts

```ts
import { supabase } from './supabase'

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID
}

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from(Array.from(raw).map(c => c.charCodeAt(0)))
}

// Ask permission, register the service worker, subscribe, and store it.
// kind='profile' → ref is the profile id (staff); kind='student' → ref is the code.
export async function enablePush(kind: 'profile' | 'student', ref: string): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: 'Notifications aren’t supported on this device/browser' }
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return { ok: false, error: 'Notification permission was blocked' }
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID) as unknown as BufferSource })
    const json = sub.toJSON()
    const { error } = await supabase.rpc('save_push_subscription', {
      p_endpoint: sub.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth, p_kind: kind, p_ref: ref,
    })
    if (error) return { ok: false, error: 'Could not save subscription' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not enable notifications' }
  }
}

// Fire a push send request to our API route. Returns how many devices were
// pushed (or a short error string) so the caller can surface a diagnostic.
export async function sendPush(payload: { studentCodes?: string[]; notifyHead?: boolean; title: string; body: string; url?: string }): Promise<{ sent?: number; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'not signed in' }
    const res = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { error: json.error || `http ${res.status}` }
    return { sent: json.sent ?? 0 }
  } catch {
    return { error: 'request failed' }
  }
}
```

## app/lib/share.ts

```ts
// Sharing helpers for handing a student their login code.
// Students never sign in with Google — they enter a per-student code — so the
// teacher needs a frictionless way to deliver that code to the parent.

const FALLBACK_ORIGIN = 'https://tution-management-taupe.vercel.app'

// Prefer the live origin so custom domains / localhost share the right link.
export function appOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : FALLBACK_ORIGIN
}

// The message a parent receives, with the code and exactly how to use it.
export function studentCodeMessage(name: string, code: string): string {
  const who = name.trim() ? name.trim() : 'your child'
  return [
    `Hi! Here is the login code for ${who} at Second Skool.`,
    '',
    `Code: ${code}`,
    '',
    `Open ${appOrigin()} → tap "I'm a student" → enter this code to view attendance, marks, fees and reminders.`,
  ].join('\n')
}

import type { WeeklyReport, StudentReport } from '../store'

const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`

// Formats the weekly branch report as a WhatsApp-friendly message (*bold* via
// asterisks, • bullets). Sent by the head to themselves or a co-owner.
export function weeklyReportMessage(r: WeeklyReport, centreName = 'Second Skool', days = 7): string {
  const period = days === 7 ? 'week' : 'month'
  const date = new Date(r.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const lines: string[] = [`*${centreName} — ${days === 7 ? 'Weekly' : 'Monthly'} Report*`, `As of ${date}`, '']
  if (r.branches.length === 0) lines.push('No branches configured yet.')
  for (const b of r.branches) {
    lines.push(`*${b.name}*`)
    lines.push(`• Students: ${b.students}${b.new_students ? ` (+${b.new_students} new this ${period})` : ''}`)
    lines.push(`• Staff: ${b.staff}`)
    lines.push(`• Attendance (${days}d): ${b.att_pct}%`)
    lines.push(`• Fees collected (${days}d): ${inr(b.fees_collected)}`)
    lines.push(`• Fees pending: ${inr(b.fees_pending)}`)
    lines.push('')
  }
  if (r.unassigned_students) lines.push(`Unassigned students: ${r.unassigned_students}`)
  lines.push(`Tests conducted this ${period}: ${r.tests_this_week}`)
  return lines.join('\n')
}

// A per-student progress note for the parent's WhatsApp (weekly or monthly).
export function studentReportMessage(s: StudentReport, centreName = 'Second Skool', days = 7): string {
  const period = days === 7 ? 'week' : 'month'
  const attPct = s.att_total > 0 ? Math.round((s.att_present / s.att_total) * 100) : null
  const lines: string[] = [`*${centreName} — ${days === 7 ? 'Weekly' : 'Monthly'} update*`, `*${s.name}* · ${s.klass}`, '']
  lines.push(`• Attendance: ${attPct === null ? `no classes marked this ${period}` : `${attPct}% (${s.att_present}/${s.att_total})`}`)
  lines.push(`• Tests this ${period}: ${s.tests}${s.tests > 0 ? ` (avg ${s.avg_pct}%)` : ''}`)
  lines.push(`• Fees: ${s.fee_status}`)
  lines.push('')
  lines.push('Reply here if you have any questions. Thank you!')
  return lines.join('\n')
}

// Build a wa.me deep link. Strips formatting; assumes India (+91) for bare
// 10-digit numbers. An empty/short number yields a link that opens WhatsApp's
// contact picker so the teacher can still choose a recipient.
export function whatsappShareUrl(phone: string, message: string): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  const intl = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`
}
```

## app/lib/supabase.ts

```ts
import { createClient } from '@supabase/supabase-js'

// Env values pasted into dashboards sometimes carry invisible or "smart"
// characters (zero-width spaces, curly quotes, NBSPs) that break fetch headers
// with "String contains non ISO-8859-1 code point". Supabase URLs and keys are
// pure printable ASCII, so strip anything outside that range defensively.
const clean = (v: string) => v.replace(/[^\x20-\x7E]/g, '').trim()

const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
const supabaseAnonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')

if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey))
  console.warn('Supabase env vars missing — live mode will not work')

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
)
```

## app/lib/upload.ts

```ts
import { supabase } from './supabase'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB cap — keeps storage + egress costs sane
const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

// Uploads a note file to the public 'notes' bucket under a random path and
// returns its public URL. Rejects oversized or non-PDF/image files (no videos —
// videos are the bandwidth killer; teachers paste a YouTube/Drive link instead).
export async function uploadNoteFile(file: File): Promise<{ url?: string; error?: string }> {
  if (file.size > MAX_BYTES) return { error: 'File too large (max 10 MB)' }
  if (!ALLOWED.includes(file.type)) return { error: 'Only PDF or image files' }
  // Extension derives from the validated MIME type, never the filename.
  const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
  const path = `${crypto.randomUUID()}.${EXT[file.type]}`
  const { error } = await supabase.storage.from('notes').upload(path, file, {
    contentType: file.type, upsert: false,
  })
  if (error) return { error: 'Upload failed — check your connection' }
  return { url: supabase.storage.from('notes').getPublicUrl(path).data.publicUrl }
}
```

## app/page.tsx

```ts
'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import { useDashboard } from './store'
import { PhoneFrame } from './components/Shell'
import { DesktopShell, DesktopAuthShell, useIsDesktop } from './components/DesktopShell'
import { SupabaseProvider } from './components/SupabaseProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LoginScreen, RegisterScreen, PendingScreen, DeniedScreen, StuPendingScreen } from './components/AuthScreens'
import { HomeScreen } from './components/HomeScreen'

function ScreenLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-[3px] border-[#e6eaf2] border-t-[#2a6fdb] rounded-full animate-spin" />
    </div>
  )
}

const dyn = (importFn: () => Promise<Record<string, ComponentType>>, name: string) =>
  dynamic(() => importFn().then(m => ({ default: m[name] })), { loading: ScreenLoading })

const StaffApprovalsScreen = dyn(() => import('./components/AdminScreens'), 'StaffApprovalsScreen')
const StudentRequestsScreen = dyn(() => import('./components/AdminScreens'), 'StudentRequestsScreen')
const ReportsScreen = dyn(() => import('./components/AdminScreens'), 'ReportsScreen')

const TimetableScreen = dyn(() => import('./components/TeachingScreens'), 'TimetableScreen')
const AttendanceScreen = dyn(() => import('./components/TeachingScreens'), 'AttendanceScreen')
const ResultsScreen = dyn(() => import('./components/TeachingScreens'), 'ResultsScreen')
const AssignmentsScreen = dyn(() => import('./components/TeachingScreens'), 'AssignmentsScreen')
const RemindersScreen = dyn(() => import('./components/TeachingScreens'), 'RemindersScreen')

const StudentsScreen = dyn(() => import('./components/PeopleScreens'), 'StudentsScreen')
const EditStudentScreen = dyn(() => import('./components/PeopleScreens'), 'EditStudentScreen')
const AddStudentScreen = dyn(() => import('./components/PeopleScreens'), 'AddStudentScreen')
const StaffScreen = dyn(() => import('./components/PeopleScreens'), 'StaffScreen')
const AddTeacherScreen = dyn(() => import('./components/PeopleScreens'), 'AddTeacherScreen')

const FeesScreen = dyn(() => import('./components/UtilityScreens'), 'FeesScreen')
const MeetingsScreen = dyn(() => import('./components/UtilityScreens'), 'MeetingsScreen')
const RankingsScreen = dyn(() => import('./components/UtilityScreens'), 'RankingsScreen')
const BranchesScreen = dyn(() => import('./components/UtilityScreens'), 'BranchesScreen')
const SubjectsScreen = dyn(() => import('./components/UtilityScreens'), 'SubjectsScreen')
const MoreScreen = dyn(() => import('./components/UtilityScreens'), 'MoreScreen')
const StaffProfileScreen = dyn(() => import('./components/UtilityScreens'), 'StaffProfileScreen')

const StuHomeScreen = dyn(() => import('./components/StudentScreens'), 'StuHomeScreen')
const StuAttendanceScreen = dyn(() => import('./components/StudentScreens'), 'StuAttendanceScreen')
const StuResultsScreen = dyn(() => import('./components/StudentScreens'), 'StuResultsScreen')
const StuRankingScreen = dyn(() => import('./components/StudentScreens'), 'StuRankingScreen')
const StuTeachersScreen = dyn(() => import('./components/StudentScreens'), 'StuTeachersScreen')
const StuTeacherDetail = dyn(() => import('./components/StudentScreens'), 'StuTeacherDetail')
const StuFeesScreen = dyn(() => import('./components/StudentScreens'), 'StuFeesScreen')
const StuNotifScreen = dyn(() => import('./components/StudentScreens'), 'StuNotifScreen')
const StuProfileScreen = dyn(() => import('./components/StudentScreens'), 'StuProfileScreen')
const StuEditProfileScreen = dyn(() => import('./components/StudentScreens'), 'StuEditProfileScreen')
const StuTimetableScreen = dyn(() => import('./components/StudentScreens'), 'StuTimetableScreen')
const StuAssignmentsScreen = dyn(() => import('./components/StudentScreens'), 'StuAssignmentsScreen')
const NotesScreen = dyn(() => import('./components/NotesScreens'), 'NotesScreen')
const StuNotesScreen = dyn(() => import('./components/NotesScreens'), 'StuNotesScreen')

export default function Page() {
  return (
    <ErrorBoundary>
      <SupabaseProvider>
        <AppShell>
          <ScreenRouter />
        </AppShell>
      </SupabaseProvider>
    </ErrorBoundary>
  )
}

// Laptop layout: approved staff get the wide sidebar console; the pre-app
// screens (login, and staff setup/pending/denied) get the split-screen auth
// shell. Students and every mobile viewport keep the phone layout.
function AppShell({ children }: { children: React.ReactNode }) {
  const { role, staffStatus, supabaseUserId } = useDashboard()
  const desktop = useIsDesktop()
  const isStaff = role === 'admin' || role === 'teacher'
  const approvedStaff = isStaff && !(supabaseUserId && staffStatus !== 'approved')
  if (desktop) {
    if (approvedStaff) return <DesktopShell>{children}</DesktopShell>
    if (role !== 'student') return <DesktopAuthShell>{children}</DesktopAuthShell>
  }
  return <PhoneFrame>{children}</PhoneFrame>
}

function ScreenRouter() {
  const { screen, role, dataLoading, staffStatus, supabaseUserId } = useDashboard()

  if (!role) return <LoginScreen />

  // A signed-in Google user who is not an approved staff member is locked to
  // their setup/status screen — no access to any feature screen, regardless of
  // the stored `screen` (prevents tab navigation into the app before approval).
  if (supabaseUserId && staffStatus !== 'approved') {
    if (staffStatus === 'pending') return <PendingScreen />
    if (staffStatus === 'rejected') return <DeniedScreen />
    return <RegisterScreen />
  }

  if (dataLoading && (role === 'admin' || role === 'teacher')) return <ScreenLoading />

  switch (screen) {
    case 'home': return <HomeScreen />
    case 'timetable': return <TimetableScreen />
    case 'attendance': return <AttendanceScreen />
    case 'results': return <ResultsScreen />
    case 'assign': return <AssignmentsScreen />
    case 'reminder': return <RemindersScreen />
    case 'students': return <StudentsScreen />
    case 'editStudent': return <EditStudentScreen />
    case 'addStudent': return <AddStudentScreen />
    case 'teachers': return <StaffScreen />
    case 'addTeacher': return <AddTeacherScreen />
    case 'fees': return <FeesScreen />
    case 'meetings': return <MeetingsScreen />
    case 'rankings': return <RankingsScreen />
    case 'branches': return <BranchesScreen />
    case 'subjects': return <SubjectsScreen />
    case 'notes': return <NotesScreen />
    case 'more': return <MoreScreen />
    case 'staffProfile': return <StaffProfileScreen />
    case 'staffApprovals': return <StaffApprovalsScreen />
    case 'studentRequests': return <StudentRequestsScreen />
    case 'reports': return <ReportsScreen />
    case 'register': return <RegisterScreen />
    case 'pending': return <PendingScreen />
    case 'denied': return <DeniedScreen />
    case 'stuPending': return <StuPendingScreen />
    case 'stuHome': return <StuHomeScreen />
    case 'stuAttendance': return <StuAttendanceScreen />
    case 'stuResults': return <StuResultsScreen />
    case 'stuRanking': return <StuRankingScreen />
    case 'stuTeachers': return <StuTeachersScreen />
    case 'stuTeacher': return <StuTeacherDetail />
    case 'stuFees': return <StuFeesScreen />
    case 'stuNotif': return <StuNotifScreen />
    case 'stuProfile': return <StuProfileScreen />
    case 'stuEditProfile': return <StuEditProfileScreen />
    case 'stuTimetable': return <StuTimetableScreen />
    case 'stuAssignments': return <StuAssignmentsScreen />
    case 'stuNotes': return <StuNotesScreen />
    default: return <HomeScreen />
  }
}
```

## app/store.ts

```ts
import { create } from 'zustand'
import { supabase } from './lib/supabase'
import { sendPush, enablePush, pushSupported } from './lib/push'

// The full-dataset fetch lives in SupabaseProvider (it owns the row mappers).
// It registers itself here so store actions can re-pull fresh data after a
// mutation (e.g. marking attendance) instead of waiting for a focus/refresh.
let _refresh: (() => Promise<void>) | null = null
export const registerRefresh = (fn: () => Promise<void>) => { _refresh = fn }

const dbErr = (op: string, notify: (m: string) => void) =>
  ({ error }: { error: unknown }) => { if (error) notify(`Sync failed: ${op}`) }

export type Screen =
  | 'home' | 'timetable' | 'attendance' | 'results' | 'assign' | 'reminder'
  | 'students' | 'editStudent' | 'addStudent' | 'teachers' | 'addTeacher'
  | 'fees' | 'meetings' | 'rankings' | 'branches' | 'subjects' | 'notes' | 'more'
  | 'admin' | 'staffApprovals' | 'studentRequests' | 'staffProfile' | 'reports' | 'register' | 'pending' | 'denied'
  | 'stuSignup' | 'stuPending'
  | 'stuHome' | 'stuAttendance' | 'stuResults' | 'stuRanking' | 'stuTeachers'
  | 'stuTeacher' | 'stuFees' | 'stuNotif' | 'stuProfile' | 'stuEditProfile' | 'stuTimetable' | 'stuAssignments' | 'stuNotes'

export type Tab = 'home' | 'timetable' | 'students' | 'teachers' | 'more'
  | 'stuHome' | 'stuResults' | 'stuRanking' | 'stuTeachers' | 'stuProfile'
export type Role = 'admin' | 'teacher' | 'student' | null
export type StaffStatus = 'none' | 'pending' | 'approved' | 'rejected'
export type FeeStatus = 'Paid' | 'Due' | 'Overdue'

export interface StaffMember { id: string; name: string; email: string; role: string; status: StaffStatus; headRequested: boolean }

export interface Teacher { name: string; subject: string; experience: number; qualification: string; rating?: string; about?: string; dbId?: string }
export interface Student { name: string; klass: string; attendance: number; feeStatus: FeeStatus; school: string; parent: string; id: string; address?: string; dbId?: string; status?: string }
// A self-registered student awaiting the head's approval (roster is separate).
export interface PendingStudent { dbId: string; name: string; klass: string; school: string; parent: string; address: string; code: string; when: string }

export interface ScheduleItem { time: string; ampm: string; subject: string; klass: string; room: string; status: string; statusColor: string; statusBg: string }
export interface MeetingItem { day: string; mon: string; title: string; time: string; kind: string; dbId?: string }
export interface AssignmentItem { title: string; due: string; klass: string; submitted: number; total: number; dbId?: string }
export interface BranchItem { name: string; address: string; students: number; staff: number; main: boolean; dbId?: string }
export interface StuResultItem { subject: string; test: string; date: string; marks: number; total: number }
export interface AttLogItem { day: string; date: string; status: string; icon: string; tint: string; color: string }
export interface StuAssignmentItem { title: string; subject: string; due: string; instructions: string }
export interface NoteItem { dbId?: string; title: string; subject: string; klass: string; body: string; fileUrl: string; linkUrl: string }
export interface StuNoteItem { title: string; subject: string; body: string; fileUrl: string; linkUrl: string; date: string }
export interface FeeHistoryItem { period: string; date: string; amount: string }
export interface NotifItem { icon: string; tint: string; title: string; detail: string; when: string; dbId?: string }
export interface SubjectItem { name: string; dbId: string }
export interface BranchReport { name: string; students: number; new_students: number; staff: number; att_pct: number; fees_collected: number; fees_pending: number }
export interface WeeklyReport { generated_at: string; branches: BranchReport[]; unassigned_students: number; tests_this_week: number }
export interface StudentReport { name: string; klass: string; parent: string; fee_status: string; att_present: number; att_total: number; tests: number; avg_pct: number }
export interface TeacherActivity { name: string; email: string; is_head: boolean; attendance_marks: number; tests_entered: number; assignments_created: number }

interface State {
  screen: Screen; tab: Tab; role: Role; origin: string | null
  attClass: string; att: Record<number, string>; rankSubject: string; ttDay: string
  toast: string; editIndex: number
  staffStatus: StaffStatus; headExists: boolean; staffList: StaffMember[]; weeklyReport: WeeklyReport | null; studentReports: StudentReport[] | null; teacherActivity: TeacherActivity[] | null
  googleEmail: string; myName: string; myPhone: string; centreName: string; centreLogo: string; joinCode: string; studentJoinCode: string; reminderType: string; plan: string
  newTeacher: { name: string; subject: string; qualification: string; experience: string; branch: string }
  newStudent: { name: string; school: string; klass: string; batch: string; branch: string; parent: string; address: string; fee: string; feeDue: string }
  stuSignup: { joinCode: string; name: string; parent: string; klass: string; school: string; address: string }
  stuPending: { name: string; code: string; centre: string } | null
  pendingStudents: PendingStudent[]
  stuTeacherIndex: number; stuRankSubject: string
  stuEdit: { name: string; parentNumber: string; address: string }
  supabaseUserId: string | null; authLoading: boolean; dataLoading: boolean

  teachers: Teacher[]; students: Student[]
  branchesList: BranchItem[]
  meetingsList: MeetingItem[]
  assignmentsList: AssignmentItem[]
  timetableData: Record<string, string[][]>
  schedule: ScheduleItem[]
  rankData: Record<string, [string, number][]>
  subjects: SubjectItem[]
  stuReminders: NotifItem[]
  stuNotifications: NotifItem[]
  stuAttendanceLog: AttLogItem[]
  stuFeeHistory: FeeHistoryItem[]
  stuResults: StuResultItem[]
  stuAssignments: StuAssignmentItem[]
  stuMonthly: { attPresent: number; attTotal: number; tests: number; avgPct: number } | null
  notesList: NoteItem[]
  stuNotes: StuNoteItem[]
  currentStudentDbId: string | null
  stuPendingFee: { amount: string; period: string; dueDate: string } | null
  searchQuery: string
  lastAdded: { code: string; name: string; parent: string } | null
}

interface Actions {
  go: (screen: Screen, tab?: Tab) => void
  goFrom: (screen: Screen, tab: Tab, origin: string) => void
  back: () => void
  notify: (msg: string) => void
  set: (partial: Partial<State>) => void

  toggleAtt: (i: number) => void
  setStudentField: (patch: Partial<Student>) => void
  setNewTeacher: (patch: Partial<State['newTeacher']>) => void
  setNewStudent: (patch: Partial<State['newStudent']>) => void
  setStuSignup: (patch: Partial<State['stuSignup']>) => void
  studentSignup: () => Promise<void>
  approveStudent: (dbId: string, klass: string, branchId: string | null, fee: string, feeDue: string) => Promise<void>
  rejectStudent: (dbId: string) => Promise<void>
  deleteStudent: () => void
  saveTeacher: () => void
  addStudent: () => void
  saveAttendance: (studentNames: string[]) => void
  saveMeeting: (title: string, type: string, date: string, time: string) => void
  saveAssignment: (title: string, subject: string, klass: string, dueDate: string, instructions: string) => void
  saveReminder: (type: string, message: string, targetClass: string, filter?: string) => void
  notifyClass: (klass: string, title: string, detail: string, icon: string) => void
  saveStudentProfile: () => void
  addFee: (studentDbId: string, amount: number, period: string, dueDate: string) => void
  toggleFeeStatus: (idx: number) => void
  addTimetableEntry: (day: string, startTime: string, endTime: string, subject: string, klass: string, room: string) => void
  deleteTimetableEntry: (day: string, p: string[]) => void
  updateTimetableEntry: (day: string, oldP: string[], startTime: string, endTime: string, subject: string, klass: string, room: string) => void
  addBranch: (name: string, address: string, isMain: boolean) => void
  deleteBranch: (dbId: string) => void
  addSubject: (name: string) => void
  deleteSubject: (dbId: string) => void
  loadNotes: () => Promise<void>
  addNote: (n: { title: string; subject: string; klass: string; body: string; fileUrl: string; linkUrl: string }) => Promise<void>
  deleteNote: (dbId: string) => Promise<void>
  loadStudentNotes: () => Promise<void>
  loadStudentByCode: (code: string, navigate?: boolean) => Promise<boolean>
  createCentre: (name: string) => Promise<void>
  joinCentre: (code: string) => Promise<void>
  loadMyCentre: () => Promise<void>
  regenerateStudentCode: () => Promise<void>
  renameCentre: (name: string) => Promise<void>
  saveCentreLogo: (dataUrl: string) => Promise<void>
  loadStaff: () => Promise<void>
  loadWeeklyReport: (days?: number) => Promise<void>
  loadStudentReports: (days?: number) => Promise<void>
  loadTeacherActivity: (days?: number) => Promise<void>
  approveTeacher: (id: string) => Promise<void>
  rejectTeacher: (id: string) => Promise<void>
  grantHead: (id: string) => Promise<void>
  removeStaff: (id: string) => Promise<void>
  exitAdmin: () => void
  signOut: () => void
  loadTeachers: (t: Teacher[]) => void
  loadStudents: (s: Student[]) => void
  refreshData: () => Promise<void>
  setAuth: (userId: string | null, role: Role, email: string, staffStatus: StaffStatus, headExists: boolean, name?: string, phone?: string) => void
  saveStaffProfile: (name: string, phone: string) => Promise<void>
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useDashboard = create<State & Actions>((set, get) => ({
  screen: 'home', tab: 'home', role: null, origin: null,
  attClass: '', att: {}, rankSubject: '', ttDay: ['Mon', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()],
  toast: '', editIndex: 0,
  staffStatus: 'none', headExists: false, staffList: [], weeklyReport: null, studentReports: null, teacherActivity: null,
  googleEmail: '', myName: '', myPhone: '', centreName: '', centreLogo: '', joinCode: '', studentJoinCode: '', reminderType: 'Test', plan: 'Monthly',
  newTeacher: { name: '', subject: '', qualification: '', experience: '', branch: '' },
  newStudent: { name: '', school: '', klass: 'Class 10', batch: '10-B', branch: '', parent: '', address: '', fee: '', feeDue: '' },
  stuSignup: { joinCode: '', name: '', parent: '', klass: 'Class 10', school: '', address: '' },
  stuPending: null, pendingStudents: [],
  teachers: [], students: [],
  stuTeacherIndex: 0, stuRankSubject: '',
  stuEdit: { name: '', parentNumber: '', address: '' },
  supabaseUserId: null, authLoading: true, dataLoading: false,

  branchesList: [], meetingsList: [], assignmentsList: [],
  timetableData: {}, schedule: [], rankData: {}, subjects: [],
  stuReminders: [], stuNotifications: [], stuAttendanceLog: [],
  stuFeeHistory: [], stuResults: [], stuAssignments: [], stuMonthly: null,
  notesList: [], stuNotes: [],
  currentStudentDbId: null, stuPendingFee: null, searchQuery: '', lastAdded: null,

  go: (screen, tab) => set({ screen, tab: (tab ?? screen) as Tab, origin: null }),
  goFrom: (screen, tab, origin) => set({ screen, tab, origin }),
  back: () => { const { origin } = get(); set({ origin: null, screen: origin === 'admin' ? 'admin' : 'home' }) },

  notify: (msg) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: msg })
    toastTimer = setTimeout(() => set({ toast: '' }), 2000)
  },

  set: (partial) => set(partial),


  toggleAtt: (i) => set((s) => ({ att: { ...s.att, [i]: s.att[i] === 'absent' ? 'present' : 'absent' } })),

  setStudentField: (patch) => set((s) => {
    const arr = [...s.students]; arr[s.editIndex] = { ...arr[s.editIndex], ...patch }
    const updated = arr[s.editIndex]
    if (updated.dbId) {
      supabase.from('students').update({
        name: updated.name, class: updated.klass, school: updated.school,
        parent_contact: updated.parent, fee_status: updated.feeStatus,
      }).eq('id', updated.dbId).then(dbErr('update student', get().notify))
    }
    return { students: arr }
  }),

  setNewTeacher: (patch) => set((s) => ({ newTeacher: { ...s.newTeacher, ...patch } })),
  setNewStudent: (patch) => set((s) => ({ newStudent: { ...s.newStudent, ...patch } })),
  setStuSignup: (patch) => set((s) => ({ stuSignup: { ...s.stuSignup, ...patch } })),

  // Student self-registration. The RPC validates the centre join code + required
  // fields (name, parent, class, school), mints a code, and inserts a PENDING
  // student the head must approve. On success we land the student on the waiting
  // screen with their code (they save it now; it only works once approved).
  studentSignup: async () => {
    const { stuSignup: f } = get()
    if (f.name.trim().length < 2) { get().notify('Enter your full name'); return }
    if (!/^\+?\d[\d\s\-]{6,}$/.test(f.parent.trim())) { get().notify('Enter a valid parent phone number'); return }
    if (!f.klass.trim()) { get().notify('Select your class'); return }
    if (f.school.trim().length < 2) { get().notify('Enter your school name'); return }
    const { data, error } = await supabase.rpc('student_signup', {
      p_join_code: f.joinCode.trim(), p_name: f.name.trim(), p_parent: f.parent.trim(),
      p_class: f.klass.trim(), p_school: f.school.trim(), p_address: f.address.trim() || null,
    })
    if (error || !data) { get().notify(error?.message || 'Could not register — check the centre code'); return }
    const d = data as { code: string; name: string; centre: string }
    if (typeof window !== 'undefined') localStorage.setItem('student_code', d.code)
    // Let the head know a request is waiting (best-effort push).
    sendPush({ notifyHead: true, title: 'New student request', body: `${d.name} has requested to join. Review and approve.` }).catch(() => {})
    set({
      stuPending: { name: d.name, code: d.code, centre: d.centre },
      stuSignup: { joinCode: '', name: '', parent: '', klass: 'Class 10', school: '', address: '' },
      role: 'student', staffStatus: 'none', screen: 'stuPending', tab: 'stuHome', authLoading: false,
    })
  },

  deleteStudent: () => {
    const { editIndex, students } = get()
    const student = students[editIndex]
    if (student?.dbId) {
      supabase.from('students').delete().eq('id', student.dbId).then(dbErr('delete student', get().notify))
    }
    set({ students: students.filter((_, i) => i !== editIndex), editIndex: 0 })
    get().notify('Student removed'); get().back()
  },

  saveTeacher: () => {
    const { newTeacher: nt, teachers, branchesList } = get()
    if (!nt.name.trim()) { get().notify('Enter a name first'); return }
    if (!nt.qualification.trim()) { get().notify('Enter qualification'); return }
    if (nt.experience && isNaN(Number(nt.experience))) { get().notify('Experience must be a number'); return }
    const t: Teacher = { name: nt.name, subject: nt.subject, qualification: nt.qualification || '—', experience: Number(nt.experience) || 0 }
    const branchId = nt.branch ? branchesList.find(b => b.name === nt.branch)?.dbId : null
    supabase.from('teachers').insert({ name: t.name, subject: t.subject, qualification: t.qualification, experience: t.experience, branch_id: branchId ?? null })
      .select().single().then(({ data }) => {
        if (data) set((s) => ({ teachers: s.teachers.map(x => x.name === t.name && !x.dbId ? { ...x, dbId: data.id } : x) }))
      })
    set({ teachers: [t, ...teachers], newTeacher: { name: '', subject: '', qualification: '', experience: '', branch: '' } })
    get().notify('Teacher added to staff'); get().back()
  },

  addStudent: () => {
    const { newStudent: ns, students, branchesList } = get()
    if (!ns.name.trim()) { get().notify('Enter student name'); return }
    if (!ns.parent.trim()) { get().notify('Enter parent contact'); return }
    if (ns.parent && !/^\+?\d[\d\s\-]{6,}$/.test(ns.parent)) { get().notify('Invalid phone number'); return }
    let code = genStudentCode()
    while (students.some(s => s.id === code)) code = genStudentCode()
    const student: Student = {
      name: ns.name, klass: `Class ${ns.batch}`, attendance: 0,
      feeStatus: 'Due', school: ns.school, parent: ns.parent, id: code,
    }
    const branchId = ns.branch ? branchesList.find(b => b.name.includes(ns.branch))?.dbId : null
    supabase.from('students').insert({
      name: ns.name, class: student.klass, school: ns.school,
      parent_contact: ns.parent, student_code: code, fee_status: 'Due',
      address: ns.address, branch_id: branchId ?? null,
    }).select().single().then(({ data, error }) => {
      if (error) { get().notify('Could not save student — check connection'); return }
      if (data) {
        set((s) => ({ students: s.students.map(x => x.id === code && !x.dbId ? { ...x, dbId: data.id } : x) }))
        // Optional enrolment fee — creates the first fee record so the student
        // immediately sees what's due (keeps status and fee records in sync).
        const amt = Number(ns.fee)
        if (amt > 0) {
          const period = new Date().toLocaleString('en', { month: 'short', year: 'numeric' })
          supabase.from('fees').insert({ student_id: data.id, amount: amt, period, due_date: ns.feeDue || new Date().toISOString().split('T')[0], status: 'Due' }).then(dbErr('add enrolment fee', get().notify))
        }
      }
    })
    set({ students: [student, ...students], newStudent: { name: '', school: '', klass: 'Class 10', batch: '10-B', branch: '', parent: '', address: '', fee: '', feeDue: '' }, lastAdded: { code, name: ns.name, parent: ns.parent } })
  },

  saveAttendance: (studentNames) => {
    const { att, students } = get()
    const records = studentNames.map((name, i) => {
      const student = students.find(s => s.name === name)
      if (!student?.dbId) return null
      return { student_id: student.dbId, date: new Date().toISOString().split('T')[0], status: att[i] === 'absent' ? 'Absent' : 'Present' }
    }).filter((r): r is NonNullable<typeof r> => r !== null)
    if (records.length) {
      // Warn when overwriting: another teacher may have marked this class already.
      const today = new Date().toISOString().split('T')[0]
      const ids = records.map(r => r!.student_id)
      supabase.from('attendance').select('id').eq('date', today).in('student_id', ids).limit(1).then(({ data }) => {
        const already = !!data?.length
        supabase.from('attendance').upsert(records, { onConflict: 'student_id,date' }).then((res) => {
          dbErr('save attendance', get().notify)(res)
          if (already && !res.error) get().notify('Note: today’s attendance was already marked — it has been updated')
          // Re-pull so the Students list shows the new attendance % right away,
          // instead of staying stale until the next focus/manual refresh.
          if (!res.error) get().refreshData()
        })
      })
    }
    // Tell only the absent students (their parents watch these devices).
    const absent = studentNames
      .map((name, i) => (att[i] === 'absent' ? students.find(s => s.name === name) : null))
      .filter((s): s is NonNullable<typeof s> => !!s?.dbId)
    if (absent.length) {
      const rows = absent.map(s => ({ student_id: s.dbId, title: 'Marked absent today', detail: `${s.name} was marked absent. Please contact the centre if this is a mistake.`, icon: '🟡' }))
      supabase.from('notifications').insert(rows).then(dbErr('send notifications', get().notify))
      const codes = absent.map(s => s.id).filter(Boolean)
      if (codes.length) sendPush({ studentCodes: codes, title: 'Marked absent today', body: 'Your ward was marked absent at the centre today.' }).then(() => {})
    }
    get().notify(`Attendance saved · ${studentNames.length - Object.values(att).filter(v => v === 'absent').length} present`)
  },

  saveMeeting: (title, type, date, time) => {
    if (!title.trim()) { get().notify('Enter a title'); return }
    const { meetingsList } = get()
    const d = new Date(date || Date.now())
    const item: MeetingItem = {
      title, time, kind: type,
      day: String(d.getDate()).padStart(2, '0'),
      mon: d.toLocaleString('en', { month: 'short' }),
    }
    supabase.from('meetings').insert({ title, meeting_type: type, date: d.toISOString().split('T')[0], time }).then(dbErr('save meeting', get().notify))
    set({ meetingsList: [item, ...meetingsList] })
    get().notify('Meeting scheduled · invites sent')
  },

  saveAssignment: (title, subject, klass, dueDate, instructions) => {
    if (!title.trim()) { get().notify('Enter a title'); return }
    const { assignmentsList, subjects } = get()
    const d = new Date(dueDate || Date.now())
    const item: AssignmentItem = {
      title, klass, due: `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`,
      submitted: 0, total: get().students.filter(s => s.klass.includes(klass.replace('Class ', ''))).length,
    }
    const subjectId = subjects.find(s => s.name === subject)?.dbId
    supabase.from('assignments').insert({
      title, class: klass, due_date: d.toISOString().split('T')[0],
      instructions: instructions || null, subject_id: subjectId ?? null,
    }).then(dbErr('save assignment', get().notify))
    set({ assignmentsList: [item, ...assignmentsList] })
    get().notifyClass(klass, 'New homework', `${title} — due ${item.due}`, '📚')
    get().notify('Assignment created · class notified')
  },

  saveReminder: (type, message, targetClass, filter) => {
    const { students } = get()
    const icons: Record<string, string> = { Test: '📝', Absence: '🟡', Fee: '💳', Homework: '📚' }
    const icon = icons[type] ?? '🔔'

    let targets = students.filter(s => s.dbId)
    if (filter === 'absentees') targets = targets.filter(s => s.attendance === 0)
    else if (filter === 'fees_due') targets = targets.filter(s => s.feeStatus !== 'Paid')
    else if (targetClass && targetClass !== 'all') targets = targets.filter(s => s.klass === targetClass)

    supabase.from('reminders').insert({ type, message, target_class: targetClass }).then(dbErr('send reminder', get().notify))
    if (targets.length) {
      const rows = targets.map(s => ({ student_id: s.dbId, title: `${type} Reminder`, detail: message, icon }))
      supabase.from('notifications').insert(rows).then(dbErr('send notifications', get().notify))
      // Push to students who enabled notifications; report the result so it's
      // clear whether any device actually got a lock-screen alert.
      const codes = targets.map(s => s.id).filter(Boolean)
      if (codes.length) sendPush({ studentCodes: codes, title: `${type} reminder`, body: message })
        .then(r => {
          // The in-app reminder already lands for every student (notifications
          // insert above). Only surface the push leg when it adds signal: a real
          // error, or a positive device count. Stay silent on 0 so it never
          // reads as a failure when no student has enabled phone push yet.
          if (r.error) get().notify(`Push failed: ${r.error}`)
          else if (r.sent) get().notify(`Also pushed to ${r.sent} device(s)`)
        })
    }

    const now = new Date().toISOString()
    const newNotifs = targets.map(() => ({
      icon, tint: '#eaf1fc', title: `${type} Reminder`, detail: message, when: 'Just now', dbId: now,
    }))
    set((s) => ({ stuNotifications: [...newNotifs, ...s.stuNotifications] }))
    get().notify(`${type} reminder sent to ${targets.length} students`)
  },

  // Auto-notify students when staff adds content (homework, results, notes,
  // absence). Inserts in-app notification rows and fires a best-effort push.
  notifyClass: (klass, title, detail, icon) => {
    const { students } = get()
    let targets = students.filter(s => s.dbId)
    if (klass && klass !== 'all') targets = targets.filter(s => s.klass === klass)
    if (!targets.length) return
    const rows = targets.map(s => ({ student_id: s.dbId, title, detail, icon }))
    supabase.from('notifications').insert(rows).then(dbErr('send notifications', get().notify))
    const codes = targets.map(s => s.id).filter(Boolean)
    if (codes.length) sendPush({ studentCodes: codes, title, body: detail })
      .then(r => { if (!r.error) get().notify(`Notified ${targets.length} student(s) · push to ${r.sent} device(s)`) })
  },

  saveStudentProfile: async () => {
    const { stuEdit, currentStudentDbId, students } = get()
    const idx = students.findIndex(s => s.dbId === currentStudentDbId)
    if (idx < 0) { get().notify('No student profile linked'); return }
    const updated = { ...students[idx] }
    if (stuEdit.name.trim()) updated.name = stuEdit.name.trim()
    if (stuEdit.parentNumber.trim()) updated.parent = stuEdit.parentNumber.trim()
    if (stuEdit.address.trim()) updated.address = stuEdit.address.trim()
    const { error } = await supabase.rpc('update_student_self', {
      p_code: updated.id, p_name: updated.name, p_parent: updated.parent, p_address: updated.address ?? '',
    })
    if (error) { get().notify('Could not update — try again'); return }
    const arr = [...students]; arr[idx] = updated
    set({ students: arr, stuEdit: { name: '', parentNumber: '', address: '' } })
    get().notify('Profile updated'); get().go('stuProfile', 'stuProfile')
  },

  addFee: (studentDbId, amount, period, dueDate) => {
    const { students } = get()
    if (studentDbId) {
      supabase.from('fees').insert({ student_id: studentDbId, amount, period, due_date: dueDate, status: 'Due' }).then(dbErr('add fee', get().notify))
      supabase.from('students').update({ fee_status: 'Due' }).eq('id', studentDbId).then(dbErr('update fee status', get().notify))
    }
    const idx = students.findIndex(s => s.dbId === studentDbId)
    if (idx >= 0) {
      const arr = [...students]; arr[idx] = { ...arr[idx], feeStatus: 'Due' }
      set({ students: arr })
    }
    get().notify('Fee record added')
  },

  toggleFeeStatus: (idx) => {
    const { students } = get()
    const student = students[idx]
    if (!student) return
    const newStatus: FeeStatus = student.feeStatus === 'Paid' ? 'Due' : 'Paid'
    const arr = [...students]; arr[idx] = { ...arr[idx], feeStatus: newStatus }
    set({ students: arr })
    if (student.dbId) {
      supabase.from('students').update({ fee_status: newStatus }).eq('id', student.dbId).then(dbErr('toggle fee', get().notify))
      if (newStatus === 'Paid') {
        supabase.from('fees').update({ status: 'Paid', paid_date: new Date().toISOString().split('T')[0] })
          .eq('student_id', student.dbId).eq('status', 'Due').then(dbErr('mark fees paid', get().notify))
      } else {
        // Reopen ONLY fees marked paid today (undo for a mis-tap). Historical
        // paid months must never flip back — that would corrupt fee history
        // and the fees-collected report.
        const today = new Date().toISOString().split('T')[0]
        supabase.from('fees').update({ status: 'Due', paid_date: null })
          .eq('student_id', student.dbId).eq('status', 'Paid').eq('paid_date', today)
          .then(dbErr('reopen fees', get().notify))
      }
    }
    get().notify(`${student.name}: ${newStatus}`)
  },

  addTimetableEntry: (day, startTime, endTime, subject, klass, room) => {
    const { timetableData } = get()
    const updated = { ...timetableData }
    if (!updated[day]) updated[day] = []
    updated[day] = [...updated[day], [startTime, endTime, subject, klass, room]].sort((a, b) => a[0].localeCompare(b[0]))
    set({ timetableData: updated })
    supabase.from('timetable').insert({
      day, start_time: startTime, end_time: endTime,
      subject, class: klass, room: room || null,
    }).then(dbErr('add timetable', get().notify))
    get().notify(`Period added: ${subject} on ${day}`)
  },

  updateTimetableEntry: (day, oldP, startTime, endTime, subject, klass, room) => {
    const entry = [startTime, endTime, subject, klass, room]
    set((s) => ({ timetableData: { ...s.timetableData, [day]: (s.timetableData[day] ?? [])
      .map(x => (x[0] === oldP[0] && x[1] === oldP[1] && x[2] === oldP[2] && x[3] === oldP[3]) ? entry : x)
      .sort((a, b) => a[0].localeCompare(b[0])) } }))
    supabase.from('timetable')
      .update({ start_time: startTime, end_time: endTime, subject, class: klass, room: room || null })
      .eq('day', day).eq('start_time', oldP[0]).eq('end_time', oldP[1]).eq('subject', oldP[2]).eq('class', oldP[3])
      .then(dbErr('update period', get().notify))
    get().notify(`Period updated: ${subject} on ${day}`)
  },

  deleteTimetableEntry: (day, p) => {
    set((s) => ({ timetableData: { ...s.timetableData, [day]: (s.timetableData[day] ?? []).filter(x => !(x[0] === p[0] && x[1] === p[1] && x[2] === p[2] && x[3] === p[3])) } }))
    supabase.from('timetable').delete()
      .eq('day', day).eq('start_time', p[0]).eq('end_time', p[1]).eq('subject', p[2]).eq('class', p[3])
      .then(dbErr('remove period', get().notify))
    get().notify('Period removed')
  },

  addBranch: (name, address, isMain) => {
    const { branchesList } = get()
    const branch: BranchItem = { name, address, main: isMain, students: 0, staff: 0 }
    supabase.from('branches').insert({ name, address, is_main: isMain }).select().single()
      .then(({ data }) => {
        if (data) set((s) => ({ branchesList: s.branchesList.map(b => b.name === name && !b.dbId ? { ...b, dbId: data.id } : b) }))
      })
    set({ branchesList: [branch, ...branchesList] })
    get().notify('Branch added')
  },

  deleteBranch: (dbId) => {
    set((s) => ({ branchesList: s.branchesList.filter(b => b.dbId !== dbId) }))
    supabase.from('branches').delete().eq('id', dbId).then(dbErr('delete branch', get().notify))
    get().notify('Branch removed')
  },

  addSubject: (name) => {
    const { subjects: list } = get()
    if (list.some(s => s.name.toLowerCase() === name.toLowerCase())) { get().notify('Subject already exists'); return }
    const item: SubjectItem = { name, dbId: '' }
    supabase.from('subjects').insert({ name }).select().single()
      .then(({ data }) => {
        if (data) set((s) => ({ subjects: s.subjects.map(x => x.name === name && !x.dbId ? { ...x, dbId: data.id } : x) }))
      })
    set({ subjects: [...list, item] })
    get().notify(`Subject "${name}" added`)
  },

  deleteSubject: (dbId) => {
    const name = get().subjects.find(x => x.dbId === dbId)?.name
    // Remove everywhere: the subject row (DB cascades its tests/results;
    // assignments keep the record but drop the subject label) plus any
    // timetable periods that reference it by name.
    set((s) => ({
      subjects: s.subjects.filter(x => x.dbId !== dbId),
      timetableData: Object.fromEntries(Object.entries(s.timetableData).map(([d, rows]) => [d, rows.filter(p => p[2] !== name)])),
      schedule: s.schedule.filter(c => c.subject !== name),
    }))
    supabase.from('subjects').delete().eq('id', dbId).then(dbErr('delete subject', get().notify))
    if (name) supabase.from('timetable').delete().eq('subject', name).then(dbErr('remove periods', get().notify))
    get().notify('Subject removed everywhere')
  },

  loadNotes: async () => {
    const { data, error } = await supabase.from('notes')
      .select('id, title, subject, class, body, file_url, link_url')
      .order('created_at', { ascending: false })
    if (error) { get().notify('Could not load notes'); return }
    set({ notesList: (data ?? []).map((n: { id: string; title: string; subject: string | null; class: string; body: string | null; file_url: string | null; link_url: string | null }) => ({
      dbId: n.id, title: n.title, subject: n.subject ?? '', klass: n.class,
      body: n.body ?? '', fileUrl: n.file_url ?? '', linkUrl: n.link_url ?? '',
    })) })
  },

  addNote: async (n) => {
    if (!n.title.trim()) { get().notify('Enter a title'); return }
    if (!n.body.trim() && !n.fileUrl && !n.linkUrl) { get().notify('Add a note, file, or link'); return }
    const { data, error } = await supabase.from('notes').insert({
      title: n.title.trim(), subject: n.subject || null, class: n.klass,
      body: n.body.trim() || null, file_url: n.fileUrl || null, link_url: n.linkUrl.trim() || null,
    }).select('id').single()
    if (error) { get().notify('Could not save note'); return }
    set((s) => ({ notesList: [{ dbId: data.id, ...n }, ...s.notesList] }))
    get().notifyClass(n.klass, 'New study material', n.subject ? `${n.title.trim()} · ${n.subject}` : n.title.trim(), '📄')
    get().notify('Note shared with the class')
  },

  deleteNote: async (dbId) => {
    set((s) => ({ notesList: s.notesList.filter(x => x.dbId !== dbId) }))
    await supabase.from('notes').delete().eq('id', dbId).then(dbErr('delete note', get().notify))
    get().notify('Note removed')
  },

  loadStudentNotes: async () => {
    const code = typeof window !== 'undefined' ? localStorage.getItem('student_code') : null
    if (!code) return
    const { data, error } = await supabase.rpc('get_student_notes', { p_code: code })
    if (error) { get().notify('Could not load study material'); return }
    set({ stuNotes: (data ?? []).map((n: { title: string | null; subject: string | null; body: string | null; fileUrl: string | null; linkUrl: string | null; date: string | null }) => ({
      title: n.title ?? '', subject: n.subject ?? '', body: n.body ?? '',
      fileUrl: n.fileUrl ?? '', linkUrl: n.linkUrl ?? '', date: n.date ?? '',
    })) })
  },

  loadStudentByCode: async (code, navigate = true) => {
    const trimmed = code.trim()
    if (trimmed.length < 4) { if (navigate) get().notify('Enter your code'); return false }
    const { data, error } = await supabase.rpc('get_student_snapshot', { p_code: trimmed })
    if (error || !data) {
      // Surface the rate-limit message; otherwise a generic invalid-code note.
      const msg = error?.message?.includes('Too many') ? error.message : 'Invalid code — check with your teacher'
      if (navigate) get().notify(msg)
      return false
    }
    const snap = data as { status?: string; student?: { name?: string; code?: string } }

    // Awaiting the head's approval — hold on the waiting screen (no dashboard data).
    if (snap.status === 'pending') {
      if (typeof window !== 'undefined') localStorage.setItem('student_code', trimmed)
      set({
        stuPending: { name: snap.student?.name ?? '', code: snap.student?.code ?? trimmed, centre: get().stuPending?.centre ?? '' },
        role: 'student', staffStatus: 'none', screen: 'stuPending', tab: 'stuHome', authLoading: false,
      })
      return false
    }

    // Request declined (or any non-approved state) — clear the saved code so a
    // returning device doesn't get stuck retrying it.
    if (snap.status && snap.status !== 'approved') {
      if (typeof window !== 'undefined') localStorage.removeItem('student_code')
      if (navigate) get().notify('Your request was declined — please contact your teacher')
      return false
    }

    if (typeof window !== 'undefined') localStorage.setItem('student_code', trimmed)
    const patch: Partial<State> = mapSnapshot(data)
    // Only navigate on the initial load; a background (focus) refresh just
    // updates the data and must not yank the student off their current screen.
    if (navigate) {
      Object.assign(patch, {
        role: 'student', staffStatus: 'none', screen: 'stuHome', tab: 'stuHome' as Tab,
        authLoading: false, stuPending: null, stuRankSubject: Object.keys(patch.rankData ?? {})[0] ?? '',
      })
      // Auto-prompt for push on login so students don't have to hunt for a
      // button. enablePush is idempotent and stays silent once permission is
      // decided (granted → re-subscribes, denied → no dialog); skip when denied
      // and swallow failures so a blocked prompt never disrupts login.
      if (pushSupported() && Notification.permission !== 'denied') enablePush('student', trimmed).catch(() => {})
    }
    set(patch)
    return true
  },

  createCentre: async (name) => {
    const { error } = await supabase.rpc('create_centre', { p_name: name })
    if (error) { get().notify(error.message || 'Could not create centre'); return }
    get().notify('Centre created — welcome!')
    if (typeof window !== 'undefined') window.location.reload()
  },

  joinCentre: async (code) => {
    const { error } = await supabase.rpc('join_centre', { p_code: code })
    if (error) { get().notify(error.message || 'Invalid centre code'); return }
    sendPush({ notifyHead: true, title: 'New access request', body: `${get().myName || 'A teacher'} is requesting access to your centre.` })
    set({ role: 'teacher', staffStatus: 'pending', screen: 'pending', tab: 'home' })
  },

  loadMyCentre: async () => {
    const { data } = await supabase.rpc('my_centre')
    if (data) {
      const d = data as { name?: string; join_code?: string; student_join_code?: string; logo_url?: string }
      set({ centreName: d.name ?? '', joinCode: d.join_code ?? '', studentJoinCode: d.student_join_code ?? '', centreLogo: d.logo_url ?? '' })
    }
  },

  regenerateStudentCode: async () => {
    const { data, error } = await supabase.rpc('regenerate_student_code')
    if (error || !data) { get().notify(error?.message || 'Could not change the code'); return }
    set({ studentJoinCode: data as string })
    get().notify('New student code generated')
  },

  // White-label: the head sets a centre logo that students see after they log
  // in with a centre code. Stored as a small data-URL in centres.logo_url;
  // RLS centres_write lets only the owner update their centre row. Pass '' to
  // clear it and fall back to the default branding.
  saveCentreLogo: async (dataUrl) => {
    const id = get().supabaseUserId
    if (!id) return
    const { error } = await supabase.from('centres').update({ logo_url: dataUrl || null }).eq('owner_id', id)
    if (error) { get().notify('Could not save logo — only the centre owner can'); return }
    set({ centreLogo: dataUrl })
    get().notify(dataUrl ? 'Centre logo updated' : 'Centre logo removed')
  },

  renameCentre: async (name) => {
    const trimmed = name.trim()
    if (trimmed.length < 2) { get().notify('Enter a centre name'); return }
    const id = get().supabaseUserId
    if (!id) return
    // RLS centres_write allows only the owner to update their centre row.
    const { error } = await supabase.from('centres').update({ name: trimmed }).eq('owner_id', id)
    if (error) { get().notify('Could not rename — only the centre owner can'); return }
    set({ centreName: trimmed })
    get().notify('Centre renamed')
  },

  loadStaff: async () => {
    // Read profiles directly — RLS already lets an authenticated head view all
    // profiles, and this avoids any dependency on the list_staff RPC being
    // present/healthy in the live DB.
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, staff_status, head_requested')
      .neq('staff_status', 'none')
      .order('created_at', { ascending: false })
    if (error) { console.error('loadStaff failed:', error.message); get().notify(`Could not load staff: ${error.message}`); return }
    const list: StaffMember[] = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string, name: r.full_name as string, email: (r.email as string) ?? '',
      role: r.role as string, status: r.staff_status as StaffStatus, headRequested: !!r.head_requested,
    }))
    set({ staffList: list })
  },

  loadWeeklyReport: async (days = 7) => {
    const { data, error } = await supabase.rpc('weekly_branch_report', { p_days: days })
    if (error) { console.error('weekly report failed:', error.message); get().notify(`Could not load report: ${error.message}`); return }
    set({ weeklyReport: data as WeeklyReport })
  },

  loadStudentReports: async (days = 7) => {
    const { data, error } = await supabase.rpc('weekly_student_reports', { p_days: days })
    if (error) { console.error('student reports failed:', error.message); get().notify(`Could not load reports: ${error.message}`); return }
    set({ studentReports: (data ?? []) as StudentReport[] })
  },

  loadTeacherActivity: async (days = 7) => {
    const { data, error } = await supabase.rpc('weekly_teacher_activity', { p_days: days })
    if (error) { console.error('teacher activity failed:', error.message); get().notify(`Could not load activity: ${error.message}`); return }
    set({ teacherActivity: (data ?? []) as TeacherActivity[] })
  },

  approveTeacher: async (id) => {
    const { error } = await supabase.rpc('approve_teacher', { p_id: id })
    if (error) { get().notify('Could not approve'); return }
    get().notify('Teacher approved'); await get().loadStaff()
  },

  rejectTeacher: async (id) => {
    const { error } = await supabase.rpc('reject_teacher', { p_id: id })
    if (error) { get().notify('Could not reject'); return }
    get().notify('Teacher rejected'); await get().loadStaff()
  },

  approveStudent: async (dbId, klass, branchId, fee, feeDue) => {
    const amt = Number(fee)
    const { error } = await supabase.rpc('approve_student', {
      p_id: dbId,
      p_class: klass.trim() || null,
      p_branch_id: branchId,
      p_fee: fee.trim() && amt > 0 ? amt : null,
      p_fee_due: feeDue || null,
    })
    if (error) { get().notify(error.message || 'Could not approve'); return }
    set((s) => ({ pendingStudents: s.pendingStudents.filter(p => p.dbId !== dbId) }))
    get().notify('Student approved')
    await get().refreshData()
  },

  rejectStudent: async (dbId) => {
    const { error } = await supabase.rpc('reject_student', { p_id: dbId })
    if (error) { get().notify(error.message || 'Could not decline'); return }
    set((s) => ({ pendingStudents: s.pendingStudents.filter(p => p.dbId !== dbId) }))
    get().notify('Request declined')
  },

  grantHead: async (id) => {
    const { error } = await supabase.rpc('grant_head', { p_id: id })
    if (error) { get().notify('Could not grant head access'); return }
    get().notify('Head access granted'); await get().loadStaff()
  },

  removeStaff: async (id) => {
    const { error } = await supabase.rpc('remove_staff', { p_id: id })
    if (error) { get().notify('Could not remove'); return }
    get().notify('Access removed'); await get().loadStaff()
  },

  exitAdmin: () => set({ screen: 'home', tab: 'home', origin: null }),

  signOut: () => {
    supabase.auth.signOut()
    if (typeof window !== 'undefined') localStorage.removeItem('student_code')
    set({
      role: null, googleEmail: '', screen: 'home' as Screen, tab: 'home' as Tab,
      supabaseUserId: null, staffStatus: 'none', headExists: false, staffList: [],
      teachers: [], students: [], branchesList: [], meetingsList: [], assignmentsList: [],
      timetableData: {}, schedule: [], rankData: {}, subjects: [],
      stuReminders: [], stuNotifications: [], stuAttendanceLog: [], stuFeeHistory: [], stuResults: [], stuAssignments: [], stuMonthly: null, stuNotes: [],
      currentStudentDbId: null, stuPendingFee: null, stuPending: null, pendingStudents: [], studentJoinCode: '',
    })
    get().notify('Signed out')
  },

  loadTeachers: (t) => set({ teachers: t }),
  loadStudents: (s) => set((prev) => ({ students: s, attClass: prev.attClass || (s.length ? s[0].klass : '') })),
  refreshData: async () => { await _refresh?.() },
  setAuth: (userId, role, email, staffStatus, headExists, name = '', phone = '') => {
    // Decide the landing screen for a signed-in Google (staff) user.
    const approved = staffStatus === 'approved'
    let screen: Screen
    if ((role === 'admin' || role === 'teacher') && approved) screen = 'home'
    else if (role === 'teacher' && staffStatus === 'pending') screen = 'pending'
    else if (staffStatus === 'rejected') screen = 'denied'
    else screen = 'register' // unregistered staff (role 'student'/none)
    set({
      supabaseUserId: userId, role, staffStatus, headExists, authLoading: false,
      googleEmail: email ?? '', myName: name ?? '', myPhone: phone ?? '', screen, tab: 'home',
    })
  },

  saveStaffProfile: async (name, phone) => {
    const id = get().supabaseUserId
    if (!id) return
    const trimmed = name.trim()
    if (!trimmed) { get().notify('Name is required'); return }
    if (phone.trim() && !/^\+?\d[\d\s-]{6,}$/.test(phone.trim())) { get().notify('Invalid phone number'); return }
    const { error } = await supabase.from('profiles').update({ full_name: trimmed, phone: phone.trim() || null }).eq('id', id)
    if (error) { get().notify('Could not save profile — check your connection'); return }
    set({ myName: trimmed, myPhone: phone.trim() })
    get().notify('Profile updated')
  },
}))

// --- Helpers ---
// Strong, human-readable student codes. Alphabet excludes confusable
// characters (0/O, 1/I/L) so codes are easy to read aloud and hard to guess.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function genStudentCode(): string {
  // Rejection sampling: only accept bytes below the largest multiple of the
  // alphabet size, so every character is uniformly likely (no modulo bias).
  const max = 256 - (256 % CODE_ALPHABET.length)
  let s = ''
  while (s.length < 8) {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    for (const b of bytes) {
      if (b < max && s.length < 8) s += CODE_ALPHABET[b % CODE_ALPHABET.length]
    }
  }
  return `TUT-${s}`
}

export const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
export const COLORS = ['#2a6fdb','#7c5cdb','#2fa36b','#e0962f','#d94f8a','#3aa0c4','#c4683a','#5a93ef']
export const GRADIENTS = ['linear-gradient(135deg,#2a6fdb,#5a93ef)','linear-gradient(135deg,#7c5cdb,#a487ef)','linear-gradient(135deg,#2fa36b,#56c48d)','linear-gradient(135deg,#e0962f,#efb45a)','linear-gradient(135deg,#d94f8a,#ec7cae)','linear-gradient(135deg,#3aa0c4,#62bcd8)']
export const av = (i: number) => COLORS[i % COLORS.length]
export const feeColor = (s: string) => s === 'Paid' ? { c: '#2fa36b', b: '#e7f5ee' } : s === 'Due' ? { c: '#e0962f', b: '#fcf3e3' } : { c: '#e8553c', b: '#fdecea' }
export const stuGrade = (pct: number) => pct >= 90 ? { g: 'A+', c: '#2fa36b', t: '#e7f5ee' } : pct >= 80 ? { g: 'A', c: '#2a6fdb', t: '#eaf1fc' } : pct >= 70 ? { g: 'B', c: '#e0962f', t: '#fcf3e3' } : { g: 'C', c: '#e8553c', t: '#fdecea' }

export const PLAN_META: Record<string, { name: string; price: string; permonth: string; save: string; renews: string }> = {
  Monthly: { name: 'Monthly', price: '₹799', permonth: 'Billed every month', save: '', renews: '24 Jul 2026' },
  'Half-yearly': { name: 'Half-yearly', price: '₹3,999', permonth: '₹666 / month', save: 'Save 17%', renews: '24 Dec 2026' },
  Yearly: { name: 'Yearly', price: '₹6,999', permonth: '₹583 / month', save: 'Save 27%', renews: '24 Jun 2027' },
}

export const PLAN_PERKS = ['Unlimited students & classes', 'Attendance, results & assignments', 'Reminders to parents & students', 'Multi-branch management']

export const REMINDER_TEMPLATES: Record<string, string> = {
  Test: 'Reminder: a unit test is scheduled for tomorrow. Please ensure your child revises the relevant chapters.',
  Absence: 'Your child was marked absent today. Kindly inform us of the reason or share any concerns.',
  Fee: 'Gentle reminder: the tuition fee is due. Please clear it at the earliest.',
  Homework: 'Reminder: Please submit the pending homework before the next class.',
}

// --- Student snapshot mapping (from get_student_snapshot RPC) ---
const STATUS_ICONS: Record<string, { icon: string; tint: string; color: string }> = {
  Present: { icon: '✅', tint: '#e7f5ee', color: '#2fa36b' },
  Absent: { icon: '❌', tint: '#fdecea', color: '#e8553c' },
  Leave: { icon: '📋', tint: '#fcf3e3', color: '#e0962f' },
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
const rupee = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`

// Shape of the get_student_snapshot RPC payload — keys mirror the SQL
// json_build_object; nullable columns are handled by the `??` fallbacks below.
type SnapRow = {
  [key: string]: unknown
  status: string; date: string; subject: string; test: string; marks: number; total: number
  period: string; paidDate: string; amount: number; dueDate: string
  icon: string; title: string; detail: string; createdAt: string
  name: string; experience: number; qualification: string; rating: number | null; about: string
  day: string; start: string; end: string; room: string; due: string; instructions: string
}
type Snapshot = {
  student?: { [key: string]: string | undefined }
  centre?: { name?: string; logo_url?: string }
  attendance?: SnapRow[]; results?: SnapRow[]; fees?: SnapRow[]; notifications?: SnapRow[]
  teachers?: SnapRow[]; timetable?: SnapRow[]; assignments?: SnapRow[]
  rankings?: Record<string, [string, number][]>
}

export function mapSnapshot(snap: Snapshot): Partial<State> {
  const s = snap.student ?? {}
  const attendance: SnapRow[] = snap.attendance ?? []
  const present = attendance.filter(a => a.status === 'Present').length
  const attPct = attendance.length ? Math.round((present / attendance.length) * 100) : 0

  const student: Student = {
    name: s.name ?? '', klass: s.klass ?? '', attendance: attPct,
    feeStatus: (s.feeStatus ?? 'Due') as FeeStatus, school: s.school ?? '',
    parent: s.parent ?? '', id: s.code ?? '', address: s.address ?? '', dbId: s.dbId,
  }

  const stuAttendanceLog: AttLogItem[] = attendance.slice(0, 15).map((a: SnapRow) => {
    const d = new Date(a.date)
    const si = STATUS_ICONS[a.status] ?? STATUS_ICONS.Present
    return {
      day: d.toLocaleString('en', { weekday: 'long' }),
      date: fmtDate(a.date), status: a.status, ...si,
    }
  })

  const stuResults: StuResultItem[] = (snap.results ?? []).map((r: SnapRow) => ({
    subject: r.subject ?? 'Unknown', test: r.test ?? 'Test', date: r.date ?? '',
    marks: r.marks ?? 0, total: r.total ?? 100,
  }))

  const fees: SnapRow[] = snap.fees ?? []
  const stuFeeHistory: FeeHistoryItem[] = fees.filter(f => f.status === 'Paid').map((f: SnapRow) => ({
    period: f.period ?? '', date: fmtDate(f.paidDate), amount: rupee(f.amount),
  }))
  const pending = fees.find(f => f.status !== 'Paid')
  const stuPendingFee = pending ? { amount: rupee(pending.amount), period: pending.period ?? '', dueDate: fmtDate(pending.dueDate) } : null

  const stuNotifications: NotifItem[] = (snap.notifications ?? []).map((n: SnapRow) => ({
    icon: n.icon ?? '📢', tint: '#eaf1fc', title: n.title ?? '', detail: n.detail ?? '',
    when: timeAgo(n.createdAt), dbId: n.createdAt,
  }))
  // Home surfaces only the last 2 days of notifications so the feed stays short;
  // older ones drop off the home but remain in the bell (stuNotif) history.
  const reminderCutoff = Date.now() - 2 * 86400000
  const stuReminders = stuNotifications
    .filter(n => n.dbId && new Date(n.dbId).getTime() >= reminderCutoff)
    .slice(0, 4)

  const teachers: Teacher[] = (snap.teachers ?? []).map((t: SnapRow) => ({
    name: t.name, subject: t.subject, experience: t.experience ?? 0,
    qualification: t.qualification ?? '—',
    rating: t.rating != null ? String(t.rating) : undefined, about: t.about ?? undefined,
  }))

  const rankData = (snap.rankings ?? {}) as Record<string, [string, number][]>

  // Class timetable (head sets it per class; the student sees their class's).
  const timetableData: Record<string, string[][]> = {}
  for (const t of (snap.timetable ?? []) as SnapRow[]) {
    const day = t.day as string
    if (!timetableData[day]) timetableData[day] = []
    timetableData[day].push([t.start ?? '', t.end ?? '', t.subject ?? '', student.klass ?? '', t.room ?? ''])
  }

  const stuAssignments: StuAssignmentItem[] = (snap.assignments ?? []).map((a: SnapRow) => ({
    title: a.title ?? '', subject: a.subject ?? '', due: fmtDate(a.due), instructions: a.instructions ?? '',
  }))

  // Monthly summary (last 30 days) — computed from raw ISO dates before any
  // display formatting, so the student's home card is always current.
  const cutoff = Date.now() - 30 * 86400000
  const monthAtt = attendance.filter((a: SnapRow) => a.date && new Date(a.date).getTime() >= cutoff)
  const monthResults = (snap.results ?? []).filter((r: SnapRow) => r.date && new Date(r.date).getTime() >= cutoff)
  const mMarks = monthResults.reduce((acc: number, r: SnapRow) => acc + (r.marks ?? 0), 0)
  const mTotals = monthResults.reduce((acc: number, r: SnapRow) => acc + (r.total ?? 0), 0)
  const stuMonthly = {
    attPresent: monthAtt.filter((a: SnapRow) => a.status === 'Present').length,
    attTotal: monthAtt.length,
    tests: monthResults.length,
    avgPct: mTotals > 0 ? Math.round((mMarks / mTotals) * 100) : 0,
  }

  return {
    students: [student], currentStudentDbId: student.dbId ?? null,
    centreName: snap.centre?.name ?? '', centreLogo: snap.centre?.logo_url ?? '',
    stuAttendanceLog, stuResults, stuFeeHistory, stuPendingFee,
    stuNotifications, stuReminders,
    teachers, rankData, timetableData, stuAssignments, stuMonthly,
  }
}
```

## eslint.config.mjs

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Supabase query rows arrive untyped; `any` in the row mappers is
    // intentional until generated DB types are introduced. Keep it visible
    // as a warning rather than a build-blocking error.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
```

## next.config.ts

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ],
};

export default nextConfig;
```

## package.json

```json
{
  "name": "tution-management",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.108.2",
    "next": "16.2.9",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "web-push": "^3.6.7",
    "zustand": "^5.0.14"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/web-push": "^3.6.4",
    "eslint": "^9",
    "eslint-config-next": "16.2.9",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.1.9"
  }
}
```

## postcss.config.mjs

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

## public/manifest.json

```json
{
  "name": "Second Skool",
  "short_name": "Second Skool",
  "description": "Attendance, results, fees, timetable & reminders for your tuition centre.",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f2f4f8",
  "theme_color": "#2a6fdb",
  "icons": [
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
```

## public/sw.js

```text
// Second Skool — push service worker.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }
  const title = data.title || 'Second Skool'
  const options = {
    body: data.body || '',
    icon: '/icon-512.png',
    badge: '/icon-512.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  }
  event.waitUntil((async () => {
    await self.registration.showNotification(title, options)
    // Nudge any open app window to re-pull data so the reminder shows in-app
    // immediately, not only as a system notification.
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of list) c.postMessage({ type: 'refresh' })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus() }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
```

## supabase/multitenancy.sql

```sql
-- ============================================================================
-- MULTI-TENANCY MIGRATION — Second Skool
-- Converts the single-centre app into a multi-tenant SaaS. Every centre's data
-- is isolated by centre_id; RLS + SECURITY DEFINER RPCs scope to the caller's
-- centre. Safe to run once on the existing database (idempotent where possible).
-- ⚠️ Back up first (Supabase → Database → Backups) before running in production.
-- ============================================================================

-- 1) CENTRES (tenants) --------------------------------------------------------
create table if not exists public.centres (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  join_code text unique not null,
  owner_id uuid references public.profiles(id),
  created_at timestamptz default now()
);
alter table public.centres enable row level security;

-- 2) profiles.centre_id must exist BEFORE current_centre() is created
-- (Postgres validates the sql-function body at creation time).
alter table public.profiles      add column if not exists centre_id uuid references public.centres(id);

create or replace function public.current_centre()
returns uuid language sql security definer stable set search_path = public as $$
  select centre_id from public.profiles where id = auth.uid()
$$;
revoke all on function public.current_centre() from public;
grant execute on function public.current_centre() to anon, authenticated;

-- 3) centre_id on every other tenant table ------------------------------------
-- Child/data tables default to the acting user's centre so existing inserts
-- (which never mention centre_id) are stamped automatically.
alter table public.teachers      add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.students       add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.branches       add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.subjects       add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.tests          add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.results        add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.attendance     add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.assignments    add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.fees           add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.meetings       add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.reminders      add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.notifications  add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.timetable      add column if not exists centre_id uuid references public.centres(id) default public.current_centre();

-- 4) BACKFILL — move all existing data into one centre owned by the first head
do $$
declare v_admin uuid; v_centre uuid; v_code text;
begin
  if not exists (select 1 from public.centres) then
    select id into v_admin from public.profiles where role='admin' and staff_status='approved' order by created_at limit 1;
    if v_admin is null then select id into v_admin from public.profiles order by created_at limit 1; end if;
    v_code := upper(substr(md5(random()::text), 1, 6));
    insert into public.centres (name, join_code, owner_id) values ('My Centre', v_code, v_admin) returning id into v_centre;
    update public.profiles      set centre_id = v_centre where centre_id is null;
    update public.teachers      set centre_id = v_centre where centre_id is null;
    update public.students      set centre_id = v_centre where centre_id is null;
    update public.branches      set centre_id = v_centre where centre_id is null;
    update public.subjects      set centre_id = v_centre where centre_id is null;
    update public.tests         set centre_id = v_centre where centre_id is null;
    update public.results       set centre_id = v_centre where centre_id is null;
    update public.attendance    set centre_id = v_centre where centre_id is null;
    update public.assignments   set centre_id = v_centre where centre_id is null;
    update public.fees          set centre_id = v_centre where centre_id is null;
    update public.meetings      set centre_id = v_centre where centre_id is null;
    update public.reminders     set centre_id = v_centre where centre_id is null;
    update public.notifications set centre_id = v_centre where centre_id is null;
    update public.timetable     set centre_id = v_centre where centre_id is null;
  end if;
end $$;

-- 5) Registration RPCs --------------------------------------------------------
-- Create a brand-new centre and become its head.
create or replace function public.create_centre(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text;
begin
  if length(coalesce(trim(p_name), '')) < 2 then raise exception 'Enter a centre name'; end if;
  if (select centre_id from public.profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to a centre';
  end if;
  loop
    v_code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from public.centres where join_code = v_code);
  end loop;
  insert into public.centres (name, join_code, owner_id) values (trim(p_name), v_code, auth.uid()) returning id into v_id;
  update public.profiles set role='admin', staff_status='approved', centre_id=v_id, head_requested=false where id = auth.uid();
  return json_build_object('centre_id', v_id, 'join_code', v_code, 'name', trim(p_name));
end; $$;

-- Join an existing centre with its code (as a pending teacher).
create or replace function public.join_centre(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  select id, name into v_id, v_name from public.centres where join_code = upper(trim(coalesce(p_code, '')));
  if v_id is null then raise exception 'Invalid centre code'; end if;
  if (select centre_id from public.profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to a centre';
  end if;
  update public.profiles set role='teacher', staff_status='pending', centre_id=v_id where id = auth.uid();
  return json_build_object('centre_id', v_id, 'name', v_name);
end; $$;

-- The head's own centre (name + join code to share with teachers).
create or replace function public.my_centre()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select json_build_object('name', c.name, 'join_code', c.join_code)
  into v from public.centres c where c.id = public.current_centre();
  return v;
end; $$;

revoke all on function public.create_centre(text) from public, anon;
revoke all on function public.join_centre(text) from public, anon;
revoke all on function public.my_centre() from public, anon;
grant execute on function public.create_centre(text) to authenticated;
grant execute on function public.join_centre(text) to authenticated;
grant execute on function public.my_centre() to authenticated;

-- 6) is_head()/is_staff() stay user-checks; RLS adds the centre_id row match.
create or replace function public.is_head()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role='admin' and staff_status='approved')
$$;
create or replace function public.is_staff()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','teacher') and staff_status='approved')
$$;
revoke all on function public.is_head() from public, anon;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_head() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- 7) Drop ALL existing policies on tenant tables, then recreate centre-scoped.
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname='public'
    and tablename in ('profiles','centres','branches','teachers','students','attendance','subjects','tests','results','assignments','assignment_submissions','fees','meetings','reminders','notifications','timetable','subscriptions')
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

-- centres: a member reads their own centre; the owner can rename it.
create policy centres_read on public.centres for select to authenticated using (id = public.current_centre());
create policy centres_write on public.centres for update to authenticated using (owner_id = auth.uid());

-- profiles: read own row always; the head reads everyone in their centre.
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or (public.is_head() and centre_id = public.current_centre()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid());
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());
-- the head can update staff rows in their centre (approvals, grant/remove).
create policy profiles_update_head on public.profiles for update to authenticated
  using (public.is_head() and centre_id = public.current_centre());

-- Helper to build symmetric staff/head policies scoped to the centre.
-- (Written out per table for clarity.)

-- Staff-writable, centre-scoped: students, attendance, tests, results,
-- assignments, reminders, notifications, timetable.
create policy students_staff    on public.students    for all to authenticated using (public.is_staff() and centre_id = public.current_centre()) with check (public.is_staff() and centre_id = public.current_centre());
create policy attendance_staff  on public.attendance  for all to authenticated using (public.is_staff() and centre_id = public.current_centre()) with check (public.is_staff() and centre_id = public.current_centre());
create policy tests_staff       on public.tests       for all to authenticated using (public.is_staff() and centre_id = public.current_centre()) with check (public.is_staff() and centre_id = public.current_centre());
create policy results_staff     on public.results     for all to authenticated using (public.is_staff() and centre_id = public.current_centre()) with check (public.is_staff() and centre_id = public.current_centre());
create policy assignments_staff on public.assignments for all to authenticated using (public.is_staff() and centre_id = public.current_centre()) with check (public.is_staff() and centre_id = public.current_centre());
create policy reminders_staff   on public.reminders   for all to authenticated using (public.is_staff() and centre_id = public.current_centre()) with check (public.is_staff() and centre_id = public.current_centre());
create policy notifs_staff      on public.notifications for all to authenticated using (public.is_staff() and centre_id = public.current_centre()) with check (public.is_staff() and centre_id = public.current_centre());
create policy timetable_staff   on public.timetable   for all to authenticated using (public.is_staff() and centre_id = public.current_centre()) with check (public.is_staff() and centre_id = public.current_centre());

-- Head-only, centre-scoped: teachers, branches, subjects, fees, meetings.
create policy teachers_head  on public.teachers  for all to authenticated using (public.is_head() and centre_id = public.current_centre()) with check (public.is_head() and centre_id = public.current_centre());
create policy branches_head  on public.branches  for all to authenticated using (public.is_head() and centre_id = public.current_centre()) with check (public.is_head() and centre_id = public.current_centre());
create policy subjects_head  on public.subjects  for all to authenticated using (public.is_head() and centre_id = public.current_centre()) with check (public.is_head() and centre_id = public.current_centre());
create policy fees_head      on public.fees      for all to authenticated using (public.is_head() and centre_id = public.current_centre()) with check (public.is_head() and centre_id = public.current_centre());
create policy meetings_head  on public.meetings  for all to authenticated using (public.is_head() and centre_id = public.current_centre()) with check (public.is_head() and centre_id = public.current_centre());

-- Teachers also need to READ head-managed reference tables (their centre only).
create policy teachers_read  on public.teachers  for select to authenticated using (public.is_staff() and centre_id = public.current_centre());
create policy branches_read  on public.branches  for select to authenticated using (public.is_staff() and centre_id = public.current_centre());
create policy subjects_read  on public.subjects  for select to authenticated using (public.is_staff() and centre_id = public.current_centre());
create policy fees_read      on public.fees      for select to authenticated using (public.is_staff() and centre_id = public.current_centre());
create policy meetings_read  on public.meetings  for select to authenticated using (public.is_staff() and centre_id = public.current_centre());

-- subscriptions (if used): head only.
create policy subs_head on public.subscriptions for all to authenticated using (public.is_head()) with check (public.is_head());

-- 8) Re-scope SECURITY DEFINER report RPCs to the caller's centre -------------
create or replace function public.weekly_branch_report()
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_since timestamptz := now() - interval '7 days'; v_date_since date := current_date - 7; v_c uuid := public.current_centre();
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='admin' and staff_status='approved') then raise exception 'Not authorized'; end if;
  select json_build_object(
    'generated_at', now(),
    'branches', coalesce((select json_agg(json_build_object(
      'name', b.name,
      'students', (select count(*) from public.students s where s.branch_id=b.id),
      'new_students', (select count(*) from public.students s where s.branch_id=b.id and s.created_at>=v_since),
      'staff', (select count(*) from public.teachers t where t.branch_id=b.id),
      'att_pct', (select coalesce(round(count(*) filter (where a.status='Present')::numeric/nullif(count(*),0)*100),0)::int from public.attendance a join public.students s on s.id=a.student_id where s.branch_id=b.id and a.date>=v_date_since),
      'fees_collected', (select coalesce(sum(f.amount),0)::bigint from public.fees f join public.students s on s.id=f.student_id where s.branch_id=b.id and f.status='Paid' and f.paid_date>=v_date_since),
      'fees_pending', (select coalesce(sum(f.amount),0)::bigint from public.fees f join public.students s on s.id=f.student_id where s.branch_id=b.id and f.status<>'Paid')
    ) order by b.is_main desc, b.name) from public.branches b where b.centre_id=v_c),'[]'::json),
    'unassigned_students', (select count(*) from public.students where branch_id is null and centre_id=v_c),
    'tests_this_week', (select count(*) from public.tests where date>=v_date_since and centre_id=v_c)
  ) into v_result; return v_result;
end; $$;

create or replace function public.weekly_student_reports()
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_date_since date := current_date - 7; v_c uuid := public.current_centre();
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='admin' and staff_status='approved') then raise exception 'Not authorized'; end if;
  select coalesce(json_agg(json_build_object(
    'name', s.name, 'klass', s.class, 'parent', s.parent_contact, 'fee_status', s.fee_status,
    'att_present', (select count(*) from public.attendance a where a.student_id=s.id and a.date>=v_date_since and a.status='Present'),
    'att_total', (select count(*) from public.attendance a where a.student_id=s.id and a.date>=v_date_since),
    'tests', (select count(*) from public.results r join public.tests t on t.id=r.test_id where r.student_id=s.id and t.date>=v_date_since),
    'avg_pct', (select coalesce(round(sum(r.marks)::numeric/nullif(sum(t.max_marks),0)*100),0)::int from public.results r join public.tests t on t.id=r.test_id where r.student_id=s.id and t.date>=v_date_since)
  ) order by s.name), '[]'::json) into v_result
  from public.students s where s.centre_id=v_c;
  return v_result;
end; $$;

create or replace function public.weekly_teacher_activity()
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_since timestamptz := now() - interval '7 days'; v_c uuid := public.current_centre();
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='admin' and staff_status='approved') then raise exception 'Not authorized'; end if;
  select coalesce(json_agg(json_build_object(
    'name', p.full_name, 'email', p.email, 'is_head', (p.role='admin'),
    'attendance_marks', (select count(*) from public.attendance a where a.recorded_by=p.id and a.created_at>=v_since),
    'tests_entered', (select count(*) from public.tests t where t.recorded_by=p.id and t.created_at>=v_since),
    'assignments_created', (select count(*) from public.assignments ag where ag.recorded_by=p.id and ag.created_at>=v_since)
  ) order by (p.role='admin') desc, p.full_name), '[]'::json) into v_result
  from public.profiles p where p.staff_status='approved' and p.role in ('admin','teacher') and p.centre_id=v_c;
  return v_result;
end; $$;

-- 9) Student snapshot — scope teachers/rankings/timetable/assignments to the
-- student's OWN centre (class names can collide across centres).
create or replace function public.get_student_snapshot(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_result json; v_c uuid;
begin
  if length(coalesce(p_code,'')) < 4 then return null; end if;
  select * into v_student from public.students where student_code = p_code;
  if v_student.id is null then return null; end if;
  v_c := v_student.centre_id;
  select json_build_object(
    'student', json_build_object('dbId',v_student.id,'name',v_student.name,'klass',v_student.class,'school',v_student.school,'code',v_student.student_code,'parent',v_student.parent_contact,'address',v_student.address,'feeStatus',v_student.fee_status),
    'attendance', coalesce((select json_agg(json_build_object('date',a.date,'status',a.status) order by a.date desc) from public.attendance a where a.student_id=v_student.id),'[]'::json),
    'results', coalesce((select json_agg(json_build_object('subject',s.name,'test',t.name,'date',t.date,'marks',r.marks,'total',t.max_marks) order by t.date desc) from public.results r join public.tests t on t.id=r.test_id join public.subjects s on s.id=t.subject_id where r.student_id=v_student.id),'[]'::json),
    'fees', coalesce((select json_agg(json_build_object('period',f.period,'amount',f.amount,'status',f.status,'dueDate',f.due_date,'paidDate',f.paid_date) order by f.due_date desc) from public.fees f where f.student_id=v_student.id),'[]'::json),
    'notifications', coalesce((select json_agg(json_build_object('title',n.title,'detail',n.detail,'icon',n.icon,'createdAt',n.created_at) order by n.created_at desc) from public.notifications n where n.student_id=v_student.id),'[]'::json),
    'teachers', coalesce((select json_agg(json_build_object('name',te.name,'subject',te.subject,'experience',te.experience,'qualification',te.qualification,'rating',te.rating,'about',te.about) order by te.created_at desc) from public.teachers te where te.centre_id=v_c),'[]'::json),
    'rankings', coalesce((select json_object_agg(subject,arr) from (select subject, json_agg(json_build_array(name,pct) order by pct desc) as arr from (select s.name as subject, st.name as name, round(sum(r.marks)::numeric/nullif(sum(t.max_marks),0)*100)::int as pct from public.results r join public.tests t on t.id=r.test_id join public.subjects s on s.id=t.subject_id join public.students st on st.id=r.student_id where st.centre_id=v_c group by s.name, st.name) per_student group by subject) ranked),'{}'::json),
    'timetable', coalesce((select json_agg(json_build_object('day',tt.day,'start',tt.start_time,'end',tt.end_time,'subject',tt.subject,'room',tt.room) order by tt.start_time) from public.timetable tt where tt.class=v_student.class and tt.centre_id=v_c),'[]'::json),
    'assignments', coalesce((select json_agg(json_build_object('title',ag.title,'subject',sub.name,'due',ag.due_date,'instructions',ag.instructions) order by ag.due_date desc) from public.assignments ag left join public.subjects sub on sub.id=ag.subject_id where ag.class=v_student.class and ag.centre_id=v_c),'[]'::json)
  ) into v_result;
  return v_result;
end; $$;

-- head_exists() is now per-centre (kept for compatibility; the client uses the
-- profile's centre_id to decide the register screen instead).
create or replace function public.head_exists()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where centre_id = public.current_centre() and role='admin' and staff_status='approved')
$$;

grant execute on function public.head_exists() to anon, authenticated;

-- 10) Staff-management RPCs re-scoped: a head can only act on staff in their
-- OWN centre (the `and centre_id = current_centre()` guard on each update).
create or replace function public.approve_teacher(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  update public.profiles set role='teacher', staff_status='approved'
    where id = p_id and centre_id = public.current_centre();
end; $$;

create or replace function public.reject_teacher(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  update public.profiles set staff_status='rejected', head_requested=false
    where id = p_id and centre_id = public.current_centre();
end; $$;

create or replace function public.grant_head(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  update public.profiles set role='admin', staff_status='approved', head_requested=false
    where id = p_id and centre_id = public.current_centre();
end; $$;

create or replace function public.remove_staff(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  if p_id = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  update public.profiles set role='student', staff_status='rejected', head_requested=false
    where id = p_id and centre_id = public.current_centre();
end; $$;

-- 11) Advisor hardening -------------------------------------------------------
-- Anon never needs these (only signed-in flows call them). get_student_snapshot
-- and update_student_self intentionally KEEP anon access — code-only students.
revoke execute on function public.current_centre() from anon;
revoke execute on function public.head_exists() from anon;

-- Legacy single-tenant registration surface, superseded by create/join_centre.
drop function if exists public.register_as_head();
drop function if exists public.register_as_teacher();
drop function if exists public.request_head();
drop function if exists public.list_staff();
```

## supabase/notes.sql

```sql
-- ============================================================================
-- NOTES / STUDY MATERIAL — Second Skool
-- Teachers share notes to a class. Cost-controlled: typed text is free (DB
-- rows); an optional PDF/image lives in Storage (public bucket, capped client
-- side); an optional YouTube/Drive link costs nothing (streams from Google).
-- Student notes are lazy-loaded via get_student_notes (not in the snapshot),
-- so files/metadata are only fetched when a student opens the screen.
-- ============================================================================

create table if not exists public.notes (
  id uuid primary key default uuid_generate_v4(),
  centre_id uuid references public.centres(id) default public.current_centre(),
  class text not null,
  title text not null,
  subject text,
  body text,        -- typed note (free, no storage)
  file_url text,    -- optional PDF/image (Storage public URL)
  link_url text,    -- optional YouTube / Drive link
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz default now()
);
alter table public.notes enable row level security;

drop policy if exists notes_staff on public.notes;
create policy notes_staff on public.notes for all to authenticated
  using (public.is_staff() and centre_id = public.current_centre())
  with check (public.is_staff() and centre_id = public.current_centre());

-- Storage bucket for note files. Public bucket: the object endpoint serves
-- downloads WITHOUT any RLS, so students (anon) can open a file via its exact
-- URL. We deliberately DO NOT add a public SELECT policy on storage.objects —
-- that would allow listing/enumerating every centre's files. Paths are random
-- UUIDs, so a file is only reachable by someone given its exact link (which
-- only get_student_notes hands out, scoped to the student's own class).
insert into storage.buckets (id, name, public) values ('notes', 'notes', true)
  on conflict (id) do nothing;

drop policy if exists "notes files public read" on storage.objects;  -- remove listing
drop policy if exists "notes files staff upload" on storage.objects;
drop policy if exists "notes files staff delete" on storage.objects;
create policy "notes files staff upload" on storage.objects for insert to authenticated with check (bucket_id = 'notes' and public.is_staff());
create policy "notes files staff delete" on storage.objects for delete to authenticated using (bucket_id = 'notes' and public.is_staff());

-- Lazy-loaded notes for a student (by code), scoped to their class + centre.
create or replace function public.get_student_notes(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students;
begin
  if length(coalesce(p_code,'')) < 4 then return '[]'::json; end if;
  select * into v_student from public.students where student_code = p_code;
  if v_student.id is null then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object(
      'title', n.title, 'subject', n.subject, 'body', n.body,
      'fileUrl', n.file_url, 'linkUrl', n.link_url, 'date', n.created_at
    ) order by n.created_at desc)
    from public.notes n
    where n.class = v_student.class and n.centre_id = v_student.centre_id
  ), '[]'::json);
end; $$;

revoke all on function public.get_student_notes(text) from public;
grant execute on function public.get_student_notes(text) to anon, authenticated;
```

## supabase/period-and-rollup.sql

```sql
-- ============================================================================
-- REPORT PERIODS + ATTENDANCE ROLLUP — Second Skool
-- 1. Report RPCs take p_days (7 = weekly, 30 = monthly).
-- 2. attendance_monthly keeps per-student monthly totals forever;
--    archive_old_attendance() rolls up daily rows older than 90 days and
--    deletes them (day-level detail only; nothing statistical is lost).
-- ============================================================================

-- 1) Replace the no-arg report functions with p_days versions --------------
drop function if exists public.weekly_branch_report();
drop function if exists public.weekly_student_reports();
drop function if exists public.weekly_teacher_activity();

create or replace function public.weekly_branch_report(p_days int default 7)
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_since timestamptz := now() - make_interval(days => p_days); v_date_since date := current_date - p_days; v_c uuid := public.current_centre();
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  select json_build_object(
    'generated_at', now(),
    'branches', coalesce((select json_agg(json_build_object(
      'name', b.name,
      'students', (select count(*) from public.students s where s.branch_id=b.id),
      'new_students', (select count(*) from public.students s where s.branch_id=b.id and s.created_at>=v_since),
      'staff', (select count(*) from public.teachers t where t.branch_id=b.id),
      'att_pct', (select coalesce(round(count(*) filter (where a.status='Present')::numeric/nullif(count(*),0)*100),0)::int from public.attendance a join public.students s on s.id=a.student_id where s.branch_id=b.id and a.date>=v_date_since),
      'fees_collected', (select coalesce(sum(f.amount),0)::bigint from public.fees f join public.students s on s.id=f.student_id where s.branch_id=b.id and f.status='Paid' and f.paid_date>=v_date_since),
      'fees_pending', (select coalesce(sum(f.amount),0)::bigint from public.fees f join public.students s on s.id=f.student_id where s.branch_id=b.id and f.status<>'Paid')
    ) order by b.is_main desc, b.name) from public.branches b where b.centre_id=v_c),'[]'::json),
    'unassigned_students', (select count(*) from public.students where branch_id is null and centre_id=v_c),
    'tests_this_week', (select count(*) from public.tests where date>=v_date_since and centre_id=v_c)
  ) into v_result; return v_result;
end; $$;

create or replace function public.weekly_student_reports(p_days int default 7)
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_date_since date := current_date - p_days; v_c uuid := public.current_centre();
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  select coalesce(json_agg(json_build_object(
    'name', s.name, 'klass', s.class, 'parent', s.parent_contact, 'fee_status', s.fee_status,
    'att_present', (select count(*) from public.attendance a where a.student_id=s.id and a.date>=v_date_since and a.status='Present'),
    'att_total', (select count(*) from public.attendance a where a.student_id=s.id and a.date>=v_date_since),
    'tests', (select count(*) from public.results r join public.tests t on t.id=r.test_id where r.student_id=s.id and t.date>=v_date_since),
    'avg_pct', (select coalesce(round(sum(r.marks)::numeric/nullif(sum(t.max_marks),0)*100),0)::int from public.results r join public.tests t on t.id=r.test_id where r.student_id=s.id and t.date>=v_date_since)
  ) order by s.name), '[]'::json) into v_result
  from public.students s where s.centre_id=v_c;
  return v_result;
end; $$;

create or replace function public.weekly_teacher_activity(p_days int default 7)
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_since timestamptz := now() - make_interval(days => p_days); v_c uuid := public.current_centre();
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  select coalesce(json_agg(json_build_object(
    'name', p.full_name, 'email', p.email, 'is_head', (p.role='admin'),
    'attendance_marks', (select count(*) from public.attendance a where a.recorded_by=p.id and a.created_at>=v_since),
    'tests_entered', (select count(*) from public.tests t where t.recorded_by=p.id and t.created_at>=v_since),
    'assignments_created', (select count(*) from public.assignments ag where ag.recorded_by=p.id and ag.created_at>=v_since)
  ) order by (p.role='admin') desc, p.full_name), '[]'::json) into v_result
  from public.profiles p where p.staff_status='approved' and p.role in ('admin','teacher') and p.centre_id=v_c;
  return v_result;
end; $$;

revoke all on function public.weekly_branch_report(int) from public, anon;
revoke all on function public.weekly_student_reports(int) from public, anon;
revoke all on function public.weekly_teacher_activity(int) from public, anon;
grant execute on function public.weekly_branch_report(int) to authenticated;
grant execute on function public.weekly_student_reports(int) to authenticated;
grant execute on function public.weekly_teacher_activity(int) to authenticated;

-- 2) Monthly attendance rollup (kept forever) --------------------------------
create table if not exists public.attendance_monthly (
  id uuid primary key default uuid_generate_v4(),
  centre_id uuid references public.centres(id),
  student_id uuid not null references public.students(id) on delete cascade,
  month date not null,
  present int not null default 0,
  total int not null default 0,
  created_at timestamptz default now(),
  unique(student_id, month)
);
alter table public.attendance_monthly enable row level security;
drop policy if exists att_monthly_read on public.attendance_monthly;
create policy att_monthly_read on public.attendance_monthly for select to authenticated
  using (public.is_staff() and centre_id = public.current_centre());

-- 3) Roll up + trim daily attendance older than 90 days ----------------------
-- Maintenance job: aggregates old daily rows into attendance_monthly, then
-- deletes them. Not callable by app users; run manually or via pg_cron.
create or replace function public.archive_old_attendance()
returns text language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  insert into public.attendance_monthly (centre_id, student_id, month, present, total)
  select a.centre_id, a.student_id, date_trunc('month', a.date)::date,
         count(*) filter (where a.status = 'Present'), count(*)
  from public.attendance a
  where a.date < current_date - 90
  group by a.centre_id, a.student_id, date_trunc('month', a.date)
  on conflict (student_id, month) do update
    set present = public.attendance_monthly.present + excluded.present,
        total   = public.attendance_monthly.total   + excluded.total;

  delete from public.attendance where date < current_date - 90;
  get diagnostics v_rows = row_count;
  return 'archived ' || v_rows || ' daily attendance rows';
end; $$;

revoke all on function public.archive_old_attendance() from public, anon, authenticated;

-- 4) OPTIONAL: run automatically on the 2nd of every month at 03:05 ----------
-- Requires the pg_cron extension (Database → Extensions → enable pg_cron),
-- then run:
--   select cron.schedule('archive-attendance', '5 3 2 * *',
--                        'select public.archive_old_attendance()');
```

## supabase/production-schema.sql

```sql
-- ============================================================================
-- SECOND SKOOL — PRODUCTION SCHEMA (canonical, consolidated)
-- ----------------------------------------------------------------------------
-- The complete, current database in ONE idempotent script. Run it on a fresh
-- Supabase project to create everything, OR on your existing DB to verify /
-- top up to the latest state (existing tables are skipped; functions, policies
-- and grants are refreshed). Supersedes: schema.sql, multitenancy.sql,
-- period-and-rollup.sql, security-hardening.sql, rate-limit.sql, notes.sql.
-- Safe to re-run. ⚠️ Back up first if the DB already holds real data.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ─── CORE TABLES (ordered to avoid the profiles⇄centres circular FK) ─────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','teacher','student')) default 'student',
  staff_status text not null check (staff_status in ('none','pending','approved','rejected')) default 'none',
  head_requested boolean not null default false,
  full_name text not null,
  email text, phone text, avatar_url text,
  branch_id uuid, centre_id uuid,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.centres (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  join_code text unique not null,
  owner_id uuid references public.profiles(id),
  logo_url text,
  created_at timestamptz default now()
);

create table if not exists public.branches (
  id uuid primary key default uuid_generate_v4(),
  name text not null, address text, is_main boolean default false,
  centre_id uuid references public.centres(id),
  created_at timestamptz default now()
);

-- Wire up the deferred FKs on profiles (idempotent).
do $$ begin
  if not exists (select 1 from pg_constraint where conname='profiles_branch_fk') then
    alter table public.profiles add constraint profiles_branch_fk foreign key (branch_id) references public.branches(id);
  end if;
  if not exists (select 1 from pg_constraint where conname='profiles_centre_fk') then
    alter table public.profiles add constraint profiles_centre_fk foreign key (centre_id) references public.centres(id);
  end if;
end $$;

-- current_centre() must exist before tables that default centre_id to it.
create or replace function public.current_centre()
returns uuid language sql security definer stable set search_path = public as $$
  select centre_id from public.profiles where id = auth.uid()
$$;

create table if not exists public.teachers (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null, subject text not null, experience int default 0,
  qualification text, rating numeric(2,1), about text,
  branch_id uuid references public.branches(id),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete set null,
  student_code text unique not null,
  name text not null, class text not null, school text,
  parent_contact text, address text,
  fee_status text default 'Due' check (fee_status in ('Paid','Due','Overdue')),
  branch_id uuid references public.branches(id),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.tests (
  id uuid primary key default uuid_generate_v4(),
  name text not null, subject_id uuid references public.subjects(id) on delete cascade,
  class text not null, max_marks int not null default 50,
  date date not null default current_date,
  created_by uuid references public.teachers(id),
  recorded_by uuid references public.profiles(id) default auth.uid(),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.results (
  id uuid primary key default uuid_generate_v4(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  marks int not null,
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now(),
  unique(test_id, student_id)
);

create table if not exists public.attendance (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null default current_date,
  status text not null check (status in ('Present','Absent','Leave')),
  marked_by uuid references public.teachers(id),
  recorded_by uuid references public.profiles(id) default auth.uid(),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now(),
  unique(student_id, date)
);

create table if not exists public.assignments (
  id uuid primary key default uuid_generate_v4(),
  title text not null, subject_id uuid references public.subjects(id) on delete set null,
  class text not null, due_date date not null, instructions text,
  created_by uuid references public.teachers(id),
  recorded_by uuid references public.profiles(id) default auth.uid(),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.assignment_submissions (
  id uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  submitted_at timestamptz default now(),
  unique(assignment_id, student_id)
);

create table if not exists public.fees (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(10,2) not null, period text not null,
  due_date date not null, paid_date date,
  status text not null default 'Due' check (status in ('Paid','Due','Overdue')),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.meetings (
  id uuid primary key default uuid_generate_v4(),
  title text not null, meeting_type text, date date not null, time text, description text,
  created_by uuid references public.teachers(id),
  branch_id uuid references public.branches(id),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.reminders (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('Test','Absence','Fee','Homework')),
  message text not null, target_class text,
  sent_by uuid references public.teachers(id),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null, detail text, icon text default '🔔', read boolean default false,
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.timetable (
  id uuid primary key default uuid_generate_v4(),
  day text not null check (day in ('Mon','Tue','Wed','Thu','Fri','Sat')),
  start_time text not null, end_time text not null,
  subject text not null, class text not null, room text,
  teacher_id uuid references public.teachers(id),
  branch_id uuid references public.branches(id),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid not null references public.branches(id),
  plan text not null check (plan in ('Monthly','Half-yearly','Yearly')),
  price numeric(10,2) not null,
  starts_at date not null default current_date, renews_at date not null,
  status text default 'active' check (status in ('active','cancelled','expired')),
  created_at timestamptz default now()
);

create table if not exists public.attendance_monthly (
  id uuid primary key default uuid_generate_v4(),
  centre_id uuid references public.centres(id),
  student_id uuid not null references public.students(id) on delete cascade,
  month date not null, present int not null default 0, total int not null default 0,
  created_at timestamptz default now(),
  unique(student_id, month)
);

create table if not exists public.code_attempts (
  id bigserial primary key,
  at timestamptz not null default now()
);
create index if not exists code_attempts_at_idx on public.code_attempts (at);
-- user_id scopes join_centre throttling per account (null for anon student-code attempts).
alter table public.code_attempts add column if not exists user_id uuid;

-- One centre per owner: closes the create_centre check-then-insert race.
create unique index if not exists centres_owner_unique on public.centres (owner_id);

-- No duplicate periods; room is part of a period's identity (nulls normalized).
create unique index if not exists timetable_period_room_unique
  on public.timetable (centre_id, day, start_time, end_time, subject, class, coalesce(room,''));

create table if not exists public.notes (
  id uuid primary key default uuid_generate_v4(),
  centre_id uuid references public.centres(id) default public.current_centre(),
  class text not null, title text not null, subject text, body text,
  file_url text, link_url text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz default now()
);

-- Top-up columns for partially-migrated databases (no-ops on fresh installs).
alter table public.teachers      add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.students      add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.branches      add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.subjects      add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.tests         add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.results       add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.attendance    add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.assignments   add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.fees          add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.meetings      add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.reminders     add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.notifications add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.timetable     add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.attendance    add column if not exists recorded_by uuid references public.profiles(id) default auth.uid();
alter table public.tests         add column if not exists recorded_by uuid references public.profiles(id) default auth.uid();
alter table public.assignments   add column if not exists recorded_by uuid references public.profiles(id) default auth.uid();
-- White-label: head-set centre logo (small data-URL) shown to students on login.
alter table public.centres       add column if not exists logo_url text;

-- Subject deletes must propagate: a removed subject takes its tests/results
-- with it (cascade); assignments survive but drop the subject label (set null).
alter table public.tests alter column subject_id drop not null;
alter table public.tests drop constraint if exists tests_subject_id_fkey;
alter table public.tests add constraint tests_subject_id_fkey foreign key (subject_id) references public.subjects(id) on delete cascade;
alter table public.assignments drop constraint if exists assignments_subject_id_fkey;
alter table public.assignments add constraint assignments_subject_id_fkey foreign key (subject_id) references public.subjects(id) on delete set null;

-- ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
create or replace function public.is_head()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id=auth.uid() and role='admin' and staff_status='approved') $$;
create or replace function public.is_staff()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id=auth.uid() and role in ('admin','teacher') and staff_status='approved') $$;
create or replace function public.head_exists()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where centre_id=public.current_centre() and role='admin' and staff_status='approved') $$;

-- ─── REGISTRATION / CENTRE RPCs ──────────────────────────────────────────────
create or replace function public.create_centre(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text;
begin
  if length(coalesce(trim(p_name),'')) < 2 or length(trim(p_name)) > 80 then raise exception 'Enter a centre name (2-80 characters)'; end if;
  if (select centre_id from public.profiles where id=auth.uid()) is not null then raise exception 'You already belong to a centre'; end if;
  loop v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)); exit when not exists (select 1 from public.centres where join_code=v_code); end loop;
  begin
    insert into public.centres (name, join_code, owner_id) values (trim(p_name), v_code, auth.uid()) returning id into v_id;
  exception when unique_violation then
    raise exception 'You already created a centre';
  end;
  update public.profiles set role='admin', staff_status='approved', centre_id=v_id, head_requested=false where id=auth.uid();
  return json_build_object('centre_id',v_id,'join_code',v_code,'name',trim(p_name));
end; $$;

create or replace function public.join_centre(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  -- Per-account throttle: 5 failed code attempts per 15 minutes.
  delete from public.code_attempts where at < now() - interval '15 minutes';
  if (select count(*) from public.code_attempts
      where user_id = auth.uid() and at > now() - interval '15 minutes') >= 5 then
    raise exception 'Too many attempts — try again in 15 minutes';
  end if;
  select id, name into v_id, v_name from public.centres where join_code=upper(trim(coalesce(p_code,'')));
  if v_id is null then
    insert into public.code_attempts (user_id) values (auth.uid());
    raise exception 'Invalid centre code';
  end if;
  if (select centre_id from public.profiles where id=auth.uid()) is not null then raise exception 'You already belong to a centre'; end if;
  update public.profiles set role='teacher', staff_status='pending', centre_id=v_id where id=auth.uid();
  return json_build_object('centre_id',v_id,'name',v_name);
end; $$;

create or replace function public.my_centre()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin select json_build_object('name',c.name,'join_code',c.join_code,'logo_url',c.logo_url) into v from public.centres c where c.id=public.current_centre(); return v; end; $$;

-- ─── STAFF MANAGEMENT (head only, own centre) ────────────────────────────────
create or replace function public.approve_teacher(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin if not public.is_head() then raise exception 'Not authorized'; end if;
  update public.profiles set role='teacher', staff_status='approved' where id=p_id and centre_id=public.current_centre(); end; $$;
create or replace function public.reject_teacher(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin if not public.is_head() then raise exception 'Not authorized'; end if;
  -- Free the account (clear centre_id) so a declined teacher can join another
  -- centre later instead of being permanently stuck on the "denied" screen.
  update public.profiles set role='student', staff_status='rejected', centre_id=null, head_requested=false where id=p_id and centre_id=public.current_centre(); end; $$;
create or replace function public.grant_head(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin if not public.is_head() then raise exception 'Not authorized'; end if;
  update public.profiles set role='admin', staff_status='approved', head_requested=false where id=p_id and centre_id=public.current_centre(); end; $$;
create or replace function public.remove_staff(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin if not public.is_head() then raise exception 'Not authorized'; end if;
  if p_id = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  update public.profiles set role='student', staff_status='rejected', centre_id=null, head_requested=false where id=p_id and centre_id=public.current_centre(); end; $$;

-- ─── REPORTS (head only, own centre, p_days window) ──────────────────────────
create or replace function public.weekly_branch_report(p_days int default 7)
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_since timestamptz := now() - make_interval(days => p_days); v_date_since date := current_date - p_days; v_c uuid := public.current_centre();
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  select json_build_object('generated_at', now(),
    'branches', coalesce((select json_agg(json_build_object(
      'name', b.name,
      'students', (select count(*) from public.students s where s.branch_id=b.id),
      'new_students', (select count(*) from public.students s where s.branch_id=b.id and s.created_at>=v_since),
      'staff', (select count(*) from public.teachers t where t.branch_id=b.id),
      'att_pct', (select coalesce(round(count(*) filter (where a.status='Present')::numeric/nullif(count(*),0)*100),0)::int from public.attendance a join public.students s on s.id=a.student_id where s.branch_id=b.id and a.date>=v_date_since),
      'fees_collected', (select coalesce(sum(f.amount),0)::bigint from public.fees f join public.students s on s.id=f.student_id where s.branch_id=b.id and f.status='Paid' and f.paid_date>=v_date_since),
      'fees_pending', (select coalesce(sum(f.amount),0)::bigint from public.fees f join public.students s on s.id=f.student_id where s.branch_id=b.id and f.status<>'Paid')
    ) order by b.is_main desc, b.name) from public.branches b where b.centre_id=v_c),'[]'::json),
    'unassigned_students', (select count(*) from public.students where branch_id is null and centre_id=v_c),
    'tests_this_week', (select count(*) from public.tests where date>=v_date_since and centre_id=v_c)
  ) into v_result; return v_result;
end; $$;

create or replace function public.weekly_student_reports(p_days int default 7)
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_date_since date := current_date - p_days; v_c uuid := public.current_centre();
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  select coalesce(json_agg(json_build_object(
    'name', s.name, 'klass', s.class, 'parent', s.parent_contact, 'fee_status', s.fee_status,
    'att_present', (select count(*) from public.attendance a where a.student_id=s.id and a.date>=v_date_since and a.status='Present'),
    'att_total', (select count(*) from public.attendance a where a.student_id=s.id and a.date>=v_date_since),
    'tests', (select count(*) from public.results r join public.tests t on t.id=r.test_id where r.student_id=s.id and t.date>=v_date_since),
    'avg_pct', (select coalesce(round(sum(r.marks)::numeric/nullif(sum(t.max_marks),0)*100),0)::int from public.results r join public.tests t on t.id=r.test_id where r.student_id=s.id and t.date>=v_date_since)
  ) order by s.name),'[]'::json) into v_result from public.students s where s.centre_id=v_c;
  return v_result;
end; $$;

create or replace function public.weekly_teacher_activity(p_days int default 7)
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_since timestamptz := now() - make_interval(days => p_days); v_c uuid := public.current_centre();
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  select coalesce(json_agg(json_build_object(
    'name', p.full_name, 'email', p.email, 'is_head', (p.role='admin'),
    'attendance_marks', (select count(*) from public.attendance a where a.recorded_by=p.id and a.created_at>=v_since),
    'tests_entered', (select count(*) from public.tests t where t.recorded_by=p.id and t.created_at>=v_since),
    'assignments_created', (select count(*) from public.assignments ag where ag.recorded_by=p.id and ag.created_at>=v_since)
  ) order by (p.role='admin') desc, p.full_name),'[]'::json) into v_result
  from public.profiles p where p.staff_status='approved' and p.role in ('admin','teacher') and p.centre_id=v_c;
  return v_result;
end; $$;

-- ─── STUDENT (anon, code-scoped) ─────────────────────────────────────────────
create or replace function public.get_student_snapshot(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_result json; v_c uuid; v_fails int;
begin
  if length(coalesce(p_code,'')) < 4 then return null; end if;
  select * into v_student from public.students where student_code = p_code;
  if v_student.id is null then
    select count(*) into v_fails from public.code_attempts where at > now() - interval '1 minute';
    if v_fails >= 25 then raise exception 'Too many attempts — please try again in a minute'; end if;
    insert into public.code_attempts default values;
    delete from public.code_attempts where at < now() - interval '5 minutes';
    return null;
  end if;
  v_c := v_student.centre_id;
  select json_build_object(
    'student', json_build_object('dbId',v_student.id,'name',v_student.name,'klass',v_student.class,'school',v_student.school,'code',v_student.student_code,'parent',v_student.parent_contact,'address',v_student.address,'feeStatus',v_student.fee_status),
    'centre', (select json_build_object('name',c.name,'logo_url',c.logo_url) from public.centres c where c.id=v_c),
    'attendance', coalesce((select json_agg(json_build_object('date',a.date,'status',a.status) order by a.date desc) from public.attendance a where a.student_id=v_student.id),'[]'::json),
    'results', coalesce((select json_agg(json_build_object('subject',s.name,'test',t.name,'date',t.date,'marks',r.marks,'total',t.max_marks) order by t.date desc) from public.results r join public.tests t on t.id=r.test_id join public.subjects s on s.id=t.subject_id where r.student_id=v_student.id),'[]'::json),
    'fees', coalesce((select json_agg(json_build_object('period',f.period,'amount',f.amount,'status',f.status,'dueDate',f.due_date,'paidDate',f.paid_date) order by f.due_date desc) from public.fees f where f.student_id=v_student.id),'[]'::json),
    'notifications', coalesce((select json_agg(json_build_object('title',n.title,'detail',n.detail,'icon',n.icon,'createdAt',n.created_at) order by n.created_at desc) from public.notifications n where n.student_id=v_student.id),'[]'::json),
    'teachers', coalesce((select json_agg(json_build_object('name',te.name,'subject',te.subject,'experience',te.experience,'qualification',te.qualification,'rating',te.rating,'about',te.about) order by te.created_at desc) from public.teachers te where te.centre_id=v_c),'[]'::json),
    'rankings', coalesce((select json_object_agg(subject,arr) from (select subject, json_agg(json_build_array(name,pct) order by pct desc) as arr from (select s.name as subject, st.name as name, round(sum(r.marks)::numeric/nullif(sum(t.max_marks),0)*100)::int as pct from public.results r join public.tests t on t.id=r.test_id join public.subjects s on s.id=t.subject_id join public.students st on st.id=r.student_id where st.centre_id=v_c group by s.name, st.name) per_student group by subject) ranked),'{}'::json),
    'timetable', coalesce((select json_agg(json_build_object('day',tt.day,'start',tt.start_time,'end',tt.end_time,'subject',tt.subject,'room',tt.room) order by tt.start_time) from public.timetable tt where tt.class=v_student.class and tt.centre_id=v_c),'[]'::json),
    'assignments', coalesce((select json_agg(json_build_object('title',ag.title,'subject',sub.name,'due',ag.due_date,'instructions',ag.instructions) order by ag.due_date desc) from public.assignments ag left join public.subjects sub on sub.id=ag.subject_id where ag.class=v_student.class and ag.centre_id=v_c),'[]'::json)
  ) into v_result;
  return v_result;
end; $$;

create or replace function public.get_student_notes(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students;
begin
  if length(coalesce(p_code,'')) < 4 then return '[]'::json; end if;
  select * into v_student from public.students where student_code = p_code;
  if v_student.id is null then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('title',n.title,'subject',n.subject,'body',n.body,'fileUrl',n.file_url,'linkUrl',n.link_url,'date',n.created_at) order by n.created_at desc)
    from public.notes n where n.class=v_student.class and n.centre_id=v_student.centre_id),'[]'::json);
end; $$;

create or replace function public.update_student_self(p_code text, p_name text, p_parent text, p_address text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_code,'')) < 4 or length(p_code) > 40 then raise exception 'Invalid code'; end if;
  update public.students set
    name = coalesce(nullif(left(trim(p_name),100),''), name),
    parent_contact = coalesce(nullif(left(trim(p_parent),30),''), parent_contact),
    address = coalesce(nullif(left(trim(p_address),300),''), address)
  where student_code = p_code;
end; $$;

-- ─── MAINTENANCE ─────────────────────────────────────────────────────────────
create or replace function public.archive_old_attendance()
returns text language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  insert into public.attendance_monthly (centre_id, student_id, month, present, total)
  select a.centre_id, a.student_id, date_trunc('month', a.date)::date,
         count(*) filter (where a.status='Present'), count(*)
  from public.attendance a where a.date < current_date - 90
  group by a.centre_id, a.student_id, date_trunc('month', a.date)
  on conflict (student_id, month) do update
    set present = public.attendance_monthly.present + excluded.present,
        total   = public.attendance_monthly.total   + excluded.total;
  delete from public.attendance where date < current_date - 90;
  get diagnostics v_rows = row_count;
  return 'archived ' || v_rows || ' daily attendance rows';
end; $$;

-- ─── TRIGGERS ────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, staff_status)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),120), new.email, 'student', 'none');
  return new;
end; $$ language plpgsql security definer set search_path = public;
create or replace trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql set search_path = public;
create or replace trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create or replace trigger teachers_updated_at before update on public.teachers for each row execute function public.set_updated_at();
create or replace trigger students_updated_at before update on public.students for each row execute function public.set_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['profiles','centres','branches','teachers','students','attendance','subjects','tests','results','assignments','assignment_submissions','fees','meetings','reminders','notifications','timetable','subscriptions','attendance_monthly','code_attempts','notes']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- Drop every existing policy on these tables, then recreate the canonical set.
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public'
    and tablename in ('profiles','centres','branches','teachers','students','attendance','subjects','tests','results','assignments','assignment_submissions','fees','meetings','reminders','notifications','timetable','subscriptions','attendance_monthly','code_attempts','notes')
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy centres_read on public.centres for select to authenticated using (id = public.current_centre());
create policy centres_write on public.centres for update to authenticated using (owner_id = auth.uid());

create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or (public.is_head() and centre_id = public.current_centre()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid());
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_head on public.profiles for update to authenticated using (public.is_head() and centre_id = public.current_centre());

create policy students_staff    on public.students    for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy attendance_staff  on public.attendance  for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy tests_staff       on public.tests       for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy results_staff     on public.results     for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy assignments_staff on public.assignments for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy reminders_staff   on public.reminders   for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy notifs_staff      on public.notifications for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy timetable_staff   on public.timetable   for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy notes_staff       on public.notes       for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());

create policy teachers_head  on public.teachers  for all to authenticated using (public.is_head() and centre_id=public.current_centre()) with check (public.is_head() and centre_id=public.current_centre());
create policy branches_head  on public.branches  for all to authenticated using (public.is_head() and centre_id=public.current_centre()) with check (public.is_head() and centre_id=public.current_centre());
create policy subjects_head  on public.subjects  for all to authenticated using (public.is_head() and centre_id=public.current_centre()) with check (public.is_head() and centre_id=public.current_centre());
create policy fees_head      on public.fees      for all to authenticated using (public.is_head() and centre_id=public.current_centre()) with check (public.is_head() and centre_id=public.current_centre());
create policy meetings_head  on public.meetings  for all to authenticated using (public.is_head() and centre_id=public.current_centre()) with check (public.is_head() and centre_id=public.current_centre());

create policy teachers_read  on public.teachers  for select to authenticated using (public.is_staff() and centre_id=public.current_centre());
create policy branches_read  on public.branches  for select to authenticated using (public.is_staff() and centre_id=public.current_centre());
create policy subjects_read  on public.subjects  for select to authenticated using (public.is_staff() and centre_id=public.current_centre());
create policy fees_read      on public.fees      for select to authenticated using (public.is_staff() and centre_id=public.current_centre());
create policy meetings_read  on public.meetings  for select to authenticated using (public.is_staff() and centre_id=public.current_centre());
create policy att_monthly_read on public.attendance_monthly for select to authenticated using (public.is_staff() and centre_id=public.current_centre());
-- subscriptions + code_attempts: no policies => only SECURITY DEFINER paths touch them.

-- ─── COLUMN-LEVEL PRIVILEGES (block self-privilege-escalation) ───────────────
revoke insert, update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
revoke update on public.centres from authenticated;
grant update (name, logo_url) on public.centres to authenticated;
revoke all on public.subscriptions from authenticated, anon;

-- ─── FUNCTION GRANTS ─────────────────────────────────────────────────────────
revoke all on function public.current_centre() from public, anon;
revoke all on function public.is_head(), public.is_staff() from public, anon;
revoke all on function public.head_exists() from public, anon;
revoke all on function public.create_centre(text), public.join_centre(text), public.my_centre() from public, anon;
revoke all on function public.approve_teacher(uuid), public.reject_teacher(uuid), public.grant_head(uuid), public.remove_staff(uuid) from public, anon;
revoke all on function public.weekly_branch_report(int), public.weekly_student_reports(int), public.weekly_teacher_activity(int) from public, anon;
revoke all on function public.archive_old_attendance() from public, anon, authenticated;
revoke all on function public.get_student_snapshot(text), public.get_student_notes(text), public.update_student_self(text,text,text,text) from public;

grant execute on function public.current_centre() to authenticated;
grant execute on function public.is_head(), public.is_staff() to authenticated;
grant execute on function public.head_exists() to authenticated;
grant execute on function public.create_centre(text), public.join_centre(text), public.my_centre() to authenticated;
grant execute on function public.approve_teacher(uuid), public.reject_teacher(uuid), public.grant_head(uuid), public.remove_staff(uuid) to authenticated;
grant execute on function public.weekly_branch_report(int), public.weekly_student_reports(int), public.weekly_teacher_activity(int) to authenticated;
grant execute on function public.get_student_snapshot(text), public.get_student_notes(text), public.update_student_self(text,text,text,text) to anon, authenticated;

-- ─── STORAGE (notes files) ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('notes','notes',true) on conflict (id) do nothing;
drop policy if exists "notes files public read" on storage.objects;   -- no listing
drop policy if exists "notes files staff upload" on storage.objects;
drop policy if exists "notes files staff delete" on storage.objects;
create policy "notes files staff upload" on storage.objects for insert to authenticated with check (bucket_id='notes' and public.is_staff());
create policy "notes files staff delete" on storage.objects for delete to authenticated using (bucket_id='notes' and public.is_staff());

-- ─── REALTIME (pending-teacher auto-advance / live approvals) ────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
```

## supabase/push.sql

```sql
-- ============================================================================
-- WEB PUSH — subscription storage
-- One row per device/browser push subscription. Written via a SECURITY DEFINER
-- RPC (so anon students can subscribe too); read only by the /api/push sender
-- using the service-role key. No public read/write on the table itself.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  kind text not null check (kind in ('profile','student')),  -- staff (profile id) vs student (code)
  ref text not null,
  centre_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
-- No policies => neither anon nor authenticated can read/write directly.

-- Upsert the caller's subscription (idempotent by endpoint).
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_kind text, p_ref text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('profile','student') then raise exception 'bad kind'; end if;
  if length(coalesce(p_endpoint,'')) < 10 then raise exception 'bad endpoint'; end if;
  insert into public.push_subscriptions (endpoint, p256dh, auth, kind, ref)
  values (p_endpoint, p_p256dh, p_auth, p_kind, p_ref)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth,
        kind = excluded.kind, ref = excluded.ref, updated_at = now();
end; $$;

revoke all on function public.save_push_subscription(text,text,text,text,text) from public;
grant execute on function public.save_push_subscription(text,text,text,text,text) to anon, authenticated;
```

## supabase/rate-limit.sql

```sql
-- ============================================================================
-- RATE LIMITING — student-code brute-force defense
-- Codes are already strong (30^8 ≈ 6.5e11), so network brute-force is already
-- impractical; this is defense-in-depth. Design principle: only INVALID-code
-- lookups are throttled — a valid code always resolves, so real students are
-- never blocked, even while an attack is in progress.
-- ============================================================================

-- Attempt log, written only by the SECURITY DEFINER snapshot function.
-- No RLS policies => anon/authenticated cannot read or write it directly.
create table if not exists public.code_attempts (
  id bigserial primary key,
  at timestamptz not null default now()
);
alter table public.code_attempts enable row level security;
create index if not exists code_attempts_at_idx on public.code_attempts (at);

-- get_student_snapshot with a sliding-window throttle on failed lookups.
create or replace function public.get_student_snapshot(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_result json; v_c uuid; v_fails int;
begin
  if length(coalesce(p_code,'')) < 4 then return null; end if;

  select * into v_student from public.students where student_code = p_code;

  -- Invalid code: throttle. >25 failed lookups in the last minute (far above any
  -- legitimate pattern) means someone is guessing — reject briefly. Valid codes
  -- skip this entirely, so genuine students are unaffected.
  if v_student.id is null then
    select count(*) into v_fails from public.code_attempts where at > now() - interval '1 minute';
    if v_fails >= 25 then
      raise exception 'Too many attempts — please try again in a minute';
    end if;
    insert into public.code_attempts default values;
    delete from public.code_attempts where at < now() - interval '5 minutes';
    return null;
  end if;

  v_c := v_student.centre_id;
  select json_build_object(
    'student', json_build_object('dbId',v_student.id,'name',v_student.name,'klass',v_student.class,'school',v_student.school,'code',v_student.student_code,'parent',v_student.parent_contact,'address',v_student.address,'feeStatus',v_student.fee_status),
    'attendance', coalesce((select json_agg(json_build_object('date',a.date,'status',a.status) order by a.date desc) from public.attendance a where a.student_id=v_student.id),'[]'::json),
    'results', coalesce((select json_agg(json_build_object('subject',s.name,'test',t.name,'date',t.date,'marks',r.marks,'total',t.max_marks) order by t.date desc) from public.results r join public.tests t on t.id=r.test_id join public.subjects s on s.id=t.subject_id where r.student_id=v_student.id),'[]'::json),
    'fees', coalesce((select json_agg(json_build_object('period',f.period,'amount',f.amount,'status',f.status,'dueDate',f.due_date,'paidDate',f.paid_date) order by f.due_date desc) from public.fees f where f.student_id=v_student.id),'[]'::json),
    'notifications', coalesce((select json_agg(json_build_object('title',n.title,'detail',n.detail,'icon',n.icon,'createdAt',n.created_at) order by n.created_at desc) from public.notifications n where n.student_id=v_student.id),'[]'::json),
    'teachers', coalesce((select json_agg(json_build_object('name',te.name,'subject',te.subject,'experience',te.experience,'qualification',te.qualification,'rating',te.rating,'about',te.about) order by te.created_at desc) from public.teachers te where te.centre_id=v_c),'[]'::json),
    'rankings', coalesce((select json_object_agg(subject,arr) from (select subject, json_agg(json_build_array(name,pct) order by pct desc) as arr from (select s.name as subject, st.name as name, round(sum(r.marks)::numeric/nullif(sum(t.max_marks),0)*100)::int as pct from public.results r join public.tests t on t.id=r.test_id join public.subjects s on s.id=t.subject_id join public.students st on st.id=r.student_id where st.centre_id=v_c group by s.name, st.name) per_student group by subject) ranked),'{}'::json),
    'timetable', coalesce((select json_agg(json_build_object('day',tt.day,'start',tt.start_time,'end',tt.end_time,'subject',tt.subject,'room',tt.room) order by tt.start_time) from public.timetable tt where tt.class=v_student.class and tt.centre_id=v_c),'[]'::json),
    'assignments', coalesce((select json_agg(json_build_object('title',ag.title,'subject',sub.name,'due',ag.due_date,'instructions',ag.instructions) order by ag.due_date desc) from public.assignments ag left join public.subjects sub on sub.id=ag.subject_id where ag.class=v_student.class and ag.centre_id=v_c),'[]'::json)
  ) into v_result;
  return v_result;
end; $$;

grant execute on function public.get_student_snapshot(text) to anon, authenticated;
```

## supabase/schema.sql

```sql
-- ============================================
-- Second Skool — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL)
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- 1. PROFILES (extends Supabase Auth)
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'teacher', 'student')) default 'student',
  staff_status text not null check (staff_status in ('none', 'pending', 'approved', 'rejected')) default 'none',
  head_requested boolean not null default false,
  full_name text not null,
  email text,
  phone text,
  avatar_url text,
  branch_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 2. BRANCHES
-- ============================================
create table public.branches (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  is_main boolean default false,
  created_at timestamptz default now()
);

-- Add FK after branches table exists
alter table public.profiles add constraint profiles_branch_fk foreign key (branch_id) references public.branches(id);

-- ============================================
-- 3. TEACHERS
-- ============================================
create table public.teachers (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  subject text not null,
  experience int default 0,
  qualification text,
  rating numeric(2,1),
  about text,
  branch_id uuid references public.branches(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 4. STUDENTS
-- ============================================
create table public.students (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete set null,
  student_code text unique not null,
  name text not null,
  class text not null,
  school text,
  parent_contact text,
  address text,
  fee_status text default 'Due' check (fee_status in ('Paid', 'Due', 'Overdue')),
  branch_id uuid references public.branches(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 5. ATTENDANCE
-- ============================================
create table public.attendance (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null default current_date,
  status text not null check (status in ('Present', 'Absent', 'Leave')),
  marked_by uuid references public.teachers(id),
  recorded_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz default now(),
  unique(student_id, date)
);

-- ============================================
-- 6. SUBJECTS
-- ============================================
create table public.subjects (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamptz default now()
);

-- No seeded subjects: each centre adds its own.

-- ============================================
-- 7. TESTS & RESULTS
-- ============================================
create table public.tests (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  subject_id uuid not null references public.subjects(id),
  class text not null,
  max_marks int not null default 50,
  date date not null default current_date,
  created_by uuid references public.teachers(id),
  recorded_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz default now()
);

create table public.results (
  id uuid primary key default uuid_generate_v4(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  marks int not null,
  created_at timestamptz default now(),
  unique(test_id, student_id)
);

-- ============================================
-- 8. ASSIGNMENTS
-- ============================================
create table public.assignments (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  subject_id uuid references public.subjects(id),
  class text not null,
  due_date date not null,
  instructions text,
  created_by uuid references public.teachers(id),
  recorded_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz default now()
);

create table public.assignment_submissions (
  id uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  submitted_at timestamptz default now(),
  unique(assignment_id, student_id)
);

-- ============================================
-- 9. FEES
-- ============================================
create table public.fees (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(10,2) not null,
  period text not null,
  due_date date not null,
  paid_date date,
  status text not null default 'Due' check (status in ('Paid', 'Due', 'Overdue')),
  created_at timestamptz default now()
);

-- ============================================
-- 10. MEETINGS
-- ============================================
create table public.meetings (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  meeting_type text,
  date date not null,
  time text,
  description text,
  created_by uuid references public.teachers(id),
  branch_id uuid references public.branches(id),
  created_at timestamptz default now()
);

-- ============================================
-- 11. REMINDERS
-- ============================================
create table public.reminders (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('Test', 'Absence', 'Fee', 'Homework')),
  message text not null,
  target_class text,
  sent_by uuid references public.teachers(id),
  created_at timestamptz default now()
);

-- ============================================
-- 12. NOTIFICATIONS (student-facing)
-- ============================================
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  detail text,
  icon text default '🔔',
  read boolean default false,
  created_at timestamptz default now()
);

-- ============================================
-- 13. TIMETABLE
-- ============================================
create table public.timetable (
  id uuid primary key default uuid_generate_v4(),
  day text not null check (day in ('Mon','Tue','Wed','Thu','Fri','Sat')),
  start_time text not null,
  end_time text not null,
  subject text not null,
  class text not null,
  room text,
  teacher_id uuid references public.teachers(id),
  branch_id uuid references public.branches(id),
  created_at timestamptz default now()
);

-- ============================================
-- 14. SUBSCRIPTIONS (for tuition centre billing)
-- ============================================
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid not null references public.branches(id),
  plan text not null check (plan in ('Monthly', 'Half-yearly', 'Yearly')),
  price numeric(10,2) not null,
  starts_at date not null default current_date,
  renews_at date not null,
  status text default 'active' check (status in ('active', 'cancelled', 'expired')),
  created_at timestamptz default now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.attendance enable row level security;
alter table public.subjects enable row level security;
alter table public.tests enable row level security;
alter table public.results enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.fees enable row level security;
alter table public.meetings enable row level security;
alter table public.reminders enable row level security;
alter table public.notifications enable row level security;
alter table public.timetable enable row level security;
alter table public.subscriptions enable row level security;

-- Profiles: users can read all, update own
create policy "Profiles are viewable by authenticated" on public.profiles for select to authenticated using (true);
create policy "Users can update own profile" on public.profiles for update to authenticated using (id = auth.uid());
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());

-- Branches: readable by all authenticated
create policy "Branches are viewable" on public.branches for select to authenticated using (true);
create policy "Admins can manage branches" on public.branches for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Teachers: readable by all authenticated, writable by admin
create policy "Teachers are viewable" on public.teachers for select to authenticated using (true);
create policy "Admins can manage teachers" on public.teachers for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Students: readable by teachers/admin, own record by students
create policy "Staff can view all students" on public.students for select to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'teacher'))
);
create policy "Students can view own record" on public.students for select to authenticated using (
  profile_id = auth.uid()
);
create policy "Staff can manage students" on public.students for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'teacher'))
);

-- Attendance: staff can manage, students can view own
create policy "Staff can manage attendance" on public.attendance for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'teacher'))
);
create policy "Students view own attendance" on public.attendance for select to authenticated using (
  student_id in (select id from public.students where profile_id = auth.uid())
);

-- Subjects: readable by all
create policy "Subjects are viewable" on public.subjects for select to authenticated using (true);

-- Tests & Results: staff manage, students view own
create policy "Staff can manage tests" on public.tests for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'teacher'))
);
create policy "Tests are viewable" on public.tests for select to authenticated using (true);

create policy "Staff can manage results" on public.results for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'teacher'))
);
create policy "Students view own results" on public.results for select to authenticated using (
  student_id in (select id from public.students where profile_id = auth.uid())
);

-- Assignments: staff manage, all authenticated can view
create policy "Staff manage assignments" on public.assignments for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'teacher'))
);
create policy "Assignments are viewable" on public.assignments for select to authenticated using (true);

create policy "Students can submit" on public.assignment_submissions for insert to authenticated with check (
  student_id in (select id from public.students where profile_id = auth.uid())
);
create policy "Submissions viewable by staff" on public.assignment_submissions for select to authenticated using (true);

-- Fees: staff manage, students view own
create policy "Staff manage fees" on public.fees for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'teacher'))
);
create policy "Students view own fees" on public.fees for select to authenticated using (
  student_id in (select id from public.students where profile_id = auth.uid())
);

-- Meetings: staff manage, all view
create policy "Staff manage meetings" on public.meetings for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'teacher'))
);
create policy "Meetings are viewable" on public.meetings for select to authenticated using (true);

-- Reminders: staff only
create policy "Staff manage reminders" on public.reminders for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'teacher'))
);
create policy "Reminders viewable" on public.reminders for select to authenticated using (true);

-- Notifications: students see own
create policy "Students view own notifications" on public.notifications for select to authenticated using (
  student_id in (select id from public.students where profile_id = auth.uid())
);
create policy "Staff manage notifications" on public.notifications for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'teacher'))
);

-- Timetable: all view, staff manage
create policy "Timetable is viewable" on public.timetable for select to authenticated using (true);
create policy "Staff manage timetable" on public.timetable for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'teacher'))
);

-- Subscriptions: admin only
create policy "Admins manage subscriptions" on public.subscriptions for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- New Google sign-ins start UNREGISTERED (role 'student', staff_status 'none').
  -- They then register in-app as Head Teacher (only if none exists yet) or
  -- Teacher (which waits for head-teacher approval). Real students never sign
  -- in — they use a per-student code — so a signed-in 'student/none' profile
  -- is simply a staff member who hasn't registered yet.
  insert into public.profiles (id, full_name, email, role, staff_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'student',
    'none'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger teachers_updated_at before update on public.teachers for each row execute function public.set_updated_at();
create trigger students_updated_at before update on public.students for each row execute function public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
create index idx_students_class on public.students(class);
create index idx_students_branch on public.students(branch_id);
create index idx_attendance_student_date on public.attendance(student_id, date);
create index idx_results_student on public.results(student_id);
create index idx_results_test on public.results(test_id);
create index idx_fees_student on public.fees(student_id);
create index idx_notifications_student on public.notifications(student_id);
create index idx_timetable_day on public.timetable(day);

-- ============================================
-- SEED DATA
-- ============================================
-- No seed data: a real centre starts empty and adds its own branches,
-- subjects, staff and students. (Demo branches were removed for production.)

-- ============================================================================
-- PRODUCTION MIGRATION — safe to run on an existing database (idempotent)
-- Run this whole block in the Supabase SQL Editor after the schema above.
-- ============================================================================

-- ---- Staff registration & approval columns (idempotent) --------------------
alter table public.profiles add column if not exists staff_status text
  not null default 'none';
alter table public.profiles drop constraint if exists profiles_staff_status_chk;
alter table public.profiles add constraint profiles_staff_status_chk
  check (staff_status in ('none', 'pending', 'approved', 'rejected'));
alter table public.profiles add column if not exists head_requested boolean
  not null default false;
alter table public.profiles alter column role set default 'student';

-- Helper: does an approved head teacher already exist?
create or replace function public.head_exists()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.profiles where role = 'admin' and staff_status = 'approved');
$$;

-- Register the caller as Head Teacher — ONLY allowed if no head exists yet.
create or replace function public.register_as_head()
returns text language plpgsql security definer set search_path = public as $$
begin
  if public.head_exists() then
    raise exception 'A head teacher already exists. Ask them to grant you access.';
  end if;
  update public.profiles
    set role = 'admin', staff_status = 'approved', head_requested = false
    where id = auth.uid();
  return 'admin';
end; $$;

-- Register the caller as a Teacher — goes into 'pending' until head approves.
create or replace function public.register_as_teacher()
returns text language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
    set role = 'teacher',
        staff_status = case when staff_status = 'approved' then 'approved' else 'pending' end
    where id = auth.uid();
  return 'teacher';
end; $$;

-- An approved teacher asks to be promoted to head teacher.
create or replace function public.request_head()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set head_requested = true
    where id = auth.uid() and role = 'teacher' and staff_status = 'approved';
end; $$;

-- Head-only: list all staff (teachers + heads) for the approvals screen.
create or replace function public.list_staff()
returns table (id uuid, full_name text, email text, role text, staff_status text, head_requested boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and staff_status = 'approved') then
    raise exception 'Not authorized';
  end if;
  return query
    select p.id, p.full_name, p.email, p.role, p.staff_status, p.head_requested, p.created_at
    from public.profiles p
    where p.staff_status <> 'none'
    order by (p.staff_status = 'pending') desc, p.created_at desc;
end; $$;

-- Head-only mutations on staff members.
create or replace function public.approve_teacher(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and staff_status = 'approved') then
    raise exception 'Not authorized';
  end if;
  update public.profiles set role = 'teacher', staff_status = 'approved' where id = p_id;
end; $$;

create or replace function public.reject_teacher(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and staff_status = 'approved') then
    raise exception 'Not authorized';
  end if;
  update public.profiles set staff_status = 'rejected', head_requested = false where id = p_id;
end; $$;

create or replace function public.grant_head(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and staff_status = 'approved') then
    raise exception 'Not authorized';
  end if;
  update public.profiles set role = 'admin', staff_status = 'approved', head_requested = false where id = p_id;
end; $$;

create or replace function public.remove_staff(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and staff_status = 'approved') then
    raise exception 'Not authorized';
  end if;
  if p_id = auth.uid() then
    raise exception 'You cannot remove yourself';
  end if;
  update public.profiles set role = 'student', staff_status = 'rejected', head_requested = false where id = p_id;
end; $$;

revoke all on function public.head_exists() from public, anon;
revoke all on function public.register_as_head() from public, anon;
revoke all on function public.register_as_teacher() from public, anon;
revoke all on function public.request_head() from public, anon;
revoke all on function public.list_staff() from public, anon;
revoke all on function public.approve_teacher(uuid) from public, anon;
revoke all on function public.reject_teacher(uuid) from public, anon;
revoke all on function public.grant_head(uuid) from public, anon;
revoke all on function public.remove_staff(uuid) from public, anon;
grant execute on function public.head_exists() to authenticated;
grant execute on function public.register_as_head() to authenticated;
grant execute on function public.register_as_teacher() to authenticated;
grant execute on function public.request_head() to authenticated;
grant execute on function public.list_staff() to authenticated;
grant execute on function public.approve_teacher(uuid) to authenticated;
grant execute on function public.reject_teacher(uuid) to authenticated;
grant execute on function public.grant_head(uuid) to authenticated;
grant execute on function public.remove_staff(uuid) to authenticated;

-- ---- Role-aware RLS helpers + policy hardening -----------------------------
-- is_staff() = approved admin OR approved teacher; is_head() = approved admin.
-- Pending/rejected teachers and unregistered users get NOTHING.
create or replace function public.is_head()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and staff_status = 'approved');
$$;
create or replace function public.is_staff()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','teacher') and staff_status = 'approved');
$$;
revoke all on function public.is_head() from public, anon;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_head() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- Trigger functions are invoked by the trigger system, never called directly —
-- no role needs EXECUTE on them.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- profiles: read own row only; head teachers can read all (for approvals).
-- Role/status changes happen ONLY through the SECURITY DEFINER RPCs above.
drop policy if exists "Profiles are viewable by authenticated" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "profiles_select_self_or_head" on public.profiles;
create policy "profiles_select_self_or_head" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_head());

-- students: approved staff read; only head teachers write.
drop policy if exists "Staff can view all students" on public.students;
drop policy if exists "Staff can manage students" on public.students;
drop policy if exists "students_select_staff" on public.students;
drop policy if exists "students_write_head" on public.students;
create policy "students_select_staff" on public.students for select to authenticated using (public.is_staff());
create policy "students_write_head" on public.students for all to authenticated using (public.is_head()) with check (public.is_head());

-- Daily-update tables: any approved staff (head or teacher) may write.
drop policy if exists "Staff can manage attendance" on public.attendance;
create policy "attendance_staff" on public.attendance for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "Staff can manage tests" on public.tests;
create policy "tests_staff" on public.tests for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "Staff can manage results" on public.results;
create policy "results_staff" on public.results for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "Staff manage assignments" on public.assignments;
create policy "assignments_staff" on public.assignments for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "Staff manage reminders" on public.reminders;
create policy "reminders_staff" on public.reminders for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "Staff manage notifications" on public.notifications;
create policy "notifications_staff" on public.notifications for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "Staff manage timetable" on public.timetable;
create policy "timetable_staff" on public.timetable for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Head-only tables: staff records, fees, meetings, branches, subjects, billing.
drop policy if exists "Admins can manage teachers" on public.teachers;
create policy "teachers_head" on public.teachers for all to authenticated using (public.is_head()) with check (public.is_head());
drop policy if exists "Staff manage fees" on public.fees;
create policy "fees_head" on public.fees for all to authenticated using (public.is_head()) with check (public.is_head());
drop policy if exists "Staff manage meetings" on public.meetings;
create policy "meetings_head" on public.meetings for all to authenticated using (public.is_head()) with check (public.is_head());
drop policy if exists "Admins can manage branches" on public.branches;
create policy "branches_head" on public.branches for all to authenticated using (public.is_head()) with check (public.is_head());
drop policy if exists "subjects_head" on public.subjects;
create policy "subjects_head" on public.subjects for all to authenticated using (public.is_head()) with check (public.is_head());
drop policy if exists "Admins manage subscriptions" on public.subscriptions;
create policy "subscriptions_head" on public.subscriptions for all to authenticated using (public.is_head()) with check (public.is_head());

-- ---- Student code access (no login) ----------------------------------------
-- Returns ONLY the one student matching the code, with everything their app
-- needs. The code is the credential; this runs with definer rights so it
-- works for anonymous (not-signed-in) students without opening up the tables.
create or replace function public.get_student_snapshot(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_student public.students;
  v_result json;
begin
  if length(coalesce(p_code, '')) < 4 then
    return null;
  end if;

  select * into v_student from public.students where student_code = p_code;
  if v_student.id is null then
    return null;
  end if;

  select json_build_object(
    'student', json_build_object(
      'dbId', v_student.id,
      'name', v_student.name,
      'klass', v_student.class,
      'school', v_student.school,
      'code', v_student.student_code,
      'parent', v_student.parent_contact,
      'address', v_student.address,
      'feeStatus', v_student.fee_status
    ),
    'attendance', coalesce((
      select json_agg(json_build_object('date', a.date, 'status', a.status) order by a.date desc)
      from public.attendance a where a.student_id = v_student.id
    ), '[]'::json),
    'results', coalesce((
      select json_agg(json_build_object(
        'subject', s.name, 'test', t.name, 'date', t.date,
        'marks', r.marks, 'total', t.max_marks
      ) order by t.date desc)
      from public.results r
      join public.tests t on t.id = r.test_id
      join public.subjects s on s.id = t.subject_id
      where r.student_id = v_student.id
    ), '[]'::json),
    'fees', coalesce((
      select json_agg(json_build_object(
        'period', f.period, 'amount', f.amount, 'status', f.status,
        'dueDate', f.due_date, 'paidDate', f.paid_date
      ) order by f.due_date desc)
      from public.fees f where f.student_id = v_student.id
    ), '[]'::json),
    'notifications', coalesce((
      select json_agg(json_build_object(
        'title', n.title, 'detail', n.detail, 'icon', n.icon, 'createdAt', n.created_at
      ) order by n.created_at desc)
      from public.notifications n where n.student_id = v_student.id
    ), '[]'::json),
    'teachers', coalesce((
      select json_agg(json_build_object(
        'name', te.name, 'subject', te.subject, 'experience', te.experience,
        'qualification', te.qualification, 'rating', te.rating, 'about', te.about
      ) order by te.created_at desc)
      from public.teachers te
    ), '[]'::json),
    'rankings', coalesce((
      select json_object_agg(subject, arr)
      from (
        select subject, json_agg(json_build_array(name, pct) order by pct desc) as arr
        from (
          select s.name as subject, st.name as name,
            round(sum(r.marks)::numeric / nullif(sum(t.max_marks), 0) * 100)::int as pct
          from public.results r
          join public.tests t on t.id = r.test_id
          join public.subjects s on s.id = t.subject_id
          join public.students st on st.id = r.student_id
          group by s.name, st.name
        ) per_student
        group by subject
      ) ranked
    ), '{}'::json),
    'timetable', coalesce((
      select json_agg(json_build_object(
        'day', tt.day, 'start', tt.start_time, 'end', tt.end_time,
        'subject', tt.subject, 'room', tt.room
      ) order by tt.start_time)
      from public.timetable tt where tt.class = v_student.class
    ), '[]'::json),
    'assignments', coalesce((
      select json_agg(json_build_object(
        'title', ag.title, 'subject', sub.name, 'due', ag.due_date, 'instructions', ag.instructions
      ) order by ag.due_date desc)
      from public.assignments ag
      left join public.subjects sub on sub.id = ag.subject_id
      where ag.class = v_student.class
    ), '[]'::json)
  ) into v_result;

  return v_result;
end; $$;

revoke all on function public.get_student_snapshot(text) from public;
grant execute on function public.get_student_snapshot(text) to anon, authenticated;

-- A student updating their own contact info (scoped strictly to their code).
-- Blank values are ignored so partial edits don't wipe fields.
create or replace function public.update_student_self(p_code text, p_name text, p_parent text, p_address text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_code, '')) < 4 then
    raise exception 'Invalid code';
  end if;
  update public.students set
    name = coalesce(nullif(trim(p_name), ''), name),
    parent_contact = coalesce(nullif(trim(p_parent), ''), parent_contact),
    address = coalesce(nullif(trim(p_address), ''), address)
  where student_code = p_code;
end; $$;

revoke all on function public.update_student_self(text, text, text, text) from public;
grant execute on function public.update_student_self(text, text, text, text) to anon, authenticated;

-- ---- Weekly branch report (head only) -------------------------------------
-- Per-branch summary for the last 7 days: roll/new students, staff, attendance
-- rate, fees collected this week, and outstanding fees. Centre-wide totals too.
create or replace function public.weekly_branch_report()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_result json;
  v_since timestamptz := now() - interval '7 days';
  v_date_since date := current_date - 7;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and staff_status = 'approved') then
    raise exception 'Not authorized';
  end if;

  select json_build_object(
    'generated_at', now(),
    'branches', coalesce((
      select json_agg(json_build_object(
        'name', b.name,
        'students', (select count(*) from public.students s where s.branch_id = b.id),
        'new_students', (select count(*) from public.students s where s.branch_id = b.id and s.created_at >= v_since),
        'staff', (select count(*) from public.teachers t where t.branch_id = b.id),
        'att_pct', (
          select coalesce(round(count(*) filter (where a.status = 'Present')::numeric / nullif(count(*), 0) * 100), 0)::int
          from public.attendance a join public.students s on s.id = a.student_id
          where s.branch_id = b.id and a.date >= v_date_since
        ),
        'fees_collected', (
          select coalesce(sum(f.amount), 0)::bigint
          from public.fees f join public.students s on s.id = f.student_id
          where s.branch_id = b.id and f.status = 'Paid' and f.paid_date >= v_date_since
        ),
        'fees_pending', (
          select coalesce(sum(f.amount), 0)::bigint
          from public.fees f join public.students s on s.id = f.student_id
          where s.branch_id = b.id and f.status <> 'Paid'
        )
      ) order by b.is_main desc, b.name)
      from public.branches b
    ), '[]'::json),
    'unassigned_students', (select count(*) from public.students where branch_id is null),
    'tests_this_week', (select count(*) from public.tests where date >= v_date_since)
  ) into v_result;

  return v_result;
end; $$;

revoke all on function public.weekly_branch_report() from public, anon;
grant execute on function public.weekly_branch_report() to authenticated;

-- ---- Weekly per-student reports (head only) -------------------------------
-- One row per student with this week's attendance, new test results and fee
-- status — used to send each parent an individual progress update.
create or replace function public.weekly_student_reports()
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_date_since date := current_date - 7;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and staff_status = 'approved') then
    raise exception 'Not authorized';
  end if;
  select coalesce(json_agg(json_build_object(
    'name', s.name,
    'klass', s.class,
    'parent', s.parent_contact,
    'fee_status', s.fee_status,
    'att_present', (select count(*) from public.attendance a where a.student_id = s.id and a.date >= v_date_since and a.status = 'Present'),
    'att_total', (select count(*) from public.attendance a where a.student_id = s.id and a.date >= v_date_since),
    'tests', (select count(*) from public.results r join public.tests t on t.id = r.test_id where r.student_id = s.id and t.date >= v_date_since),
    'avg_pct', (select coalesce(round(sum(r.marks)::numeric / nullif(sum(t.max_marks), 0) * 100), 0)::int from public.results r join public.tests t on t.id = r.test_id where r.student_id = s.id and t.date >= v_date_since)
  ) order by s.name), '[]'::json) into v_result
  from public.students s;
  return v_result;
end; $$;

revoke all on function public.weekly_student_reports() from public, anon;
grant execute on function public.weekly_student_reports() to authenticated;

-- ---- Weekly per-teacher activity (head only) ------------------------------
-- Each approved staff member's last-7-day activity, attributed via the
-- recorded_by column (defaults to auth.uid() on every insert).
create or replace function public.weekly_teacher_activity()
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_since timestamptz := now() - interval '7 days';
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and staff_status = 'approved') then
    raise exception 'Not authorized';
  end if;
  select coalesce(json_agg(json_build_object(
    'name', p.full_name,
    'email', p.email,
    'is_head', (p.role = 'admin'),
    'attendance_marks', (select count(*) from public.attendance a where a.recorded_by = p.id and a.created_at >= v_since),
    'tests_entered', (select count(*) from public.tests t where t.recorded_by = p.id and t.created_at >= v_since),
    'assignments_created', (select count(*) from public.assignments ag where ag.recorded_by = p.id and ag.created_at >= v_since)
  ) order by (p.role = 'admin') desc, p.full_name), '[]'::json) into v_result
  from public.profiles p
  where p.staff_status = 'approved' and p.role in ('admin', 'teacher');
  return v_result;
end; $$;

revoke all on function public.weekly_teacher_activity() from public, anon;
grant execute on function public.weekly_teacher_activity() to authenticated;

-- ---- Realtime: let a pending teacher auto-advance when approved ------------
-- Adds profiles to the realtime publication (idempotent). RLS still applies,
-- so a teacher only receives changes to their own row.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
```

## supabase/security-hardening.sql

```sql
-- ============================================================================
-- SECURITY HARDENING — Second Skool
-- Fixes from the security audit. Safe to run once; idempotent.
-- ============================================================================

-- C1) CRITICAL — block self-privilege-escalation via profiles.
-- The profiles_update_self RLS policy lets a user update their OWN row, but
-- RLS cannot restrict columns — so any signed-in user could set
-- role='admin', staff_status='approved', or hop centre_id via the REST API.
-- Column-level privileges close this: authenticated may update ONLY the
-- harmless profile fields. Role/status/centre changes happen exclusively
-- through SECURITY DEFINER RPCs (create_centre, join_centre, approve_teacher,
-- grant_head, ...), which run as the table owner and are unaffected.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

-- The signup trigger (SECURITY DEFINER) creates profile rows; clients never
-- insert directly, so remove the insert path too.
revoke insert on public.profiles from authenticated;

-- C1b) Same class of hole on centres: owner may rename, but only the name.
revoke update on public.centres from authenticated;
grant update (name) on public.centres to authenticated;

-- H1) subscriptions policy was head-only but NOT centre-scoped; the table is
-- unused by the app — deny everything until billing is actually built.
drop policy if exists subs_head on public.subscriptions;
revoke all on public.subscriptions from authenticated, anon;

-- M1) Stronger join codes for NEW centres: 10 chars from a v4 UUID
-- (~1e12 combinations) instead of 6 hex chars from md5(random()) (~16.7M).
-- Existing centres keep their current code.
create or replace function public.create_centre(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text;
begin
  if length(coalesce(trim(p_name), '')) < 2 or length(trim(p_name)) > 80 then
    raise exception 'Enter a centre name (2-80 characters)';
  end if;
  if (select centre_id from public.profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to a centre';
  end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.centres where join_code = v_code);
  end loop;
  insert into public.centres (name, join_code, owner_id) values (trim(p_name), v_code, auth.uid()) returning id into v_id;
  update public.profiles set role='admin', staff_status='approved', centre_id=v_id, head_requested=false where id = auth.uid();
  return json_build_object('centre_id', v_id, 'join_code', v_code, 'name', trim(p_name));
end; $$;

-- L3) Cap anonymous student-edit inputs so a leaked code can't be used to
-- stuff oversized data; blank values still ignored.
create or replace function public.update_student_self(p_code text, p_name text, p_parent text, p_address text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_code, '')) < 4 or length(p_code) > 40 then
    raise exception 'Invalid code';
  end if;
  update public.students set
    name = coalesce(nullif(left(trim(p_name), 100), ''), name),
    parent_contact = coalesce(nullif(left(trim(p_parent), 30), ''), parent_contact),
    address = coalesce(nullif(left(trim(p_address), 300), ''), address)
  where student_code = p_code;
end; $$;

-- L3b) Cap the signup-derived display name too.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, staff_status)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 120),
    new.email,
    'student',
    'none'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
```

## supabase/student-join-code.sql

```sql
-- ============================================================================
-- SEPARATE STUDENT JOIN CODE — Second Skool
-- Teachers and students used to share one centre join code. This splits them:
--   • centres.join_code          → teachers (Google sign-in + code)   [unchanged]
--   • centres.student_join_code   → students (self-registration form)  [new]
-- A code entered on the student form now ONLY matches student_join_code, and a
-- code entered on the teacher form ONLY matches join_code — so the two audiences
-- can never use each other's code.
--
-- Idempotent. Existing centres are backfilled with a fresh student code.
-- ⚠️ Back up first (Supabase → Database → Backups) before running in production.
-- ============================================================================

-- 1) New column + unique index ------------------------------------------------
alter table public.centres add column if not exists student_join_code text;

-- Backfill every centre that doesn't have one yet with a unique, human-friendly
-- 6-char code (confusable-free alphabet), distinct from all existing codes.
do $$
declare
  c        record;
  v_code   text;
  v_alpha  constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i        int;
begin
  for c in select id from public.centres where student_join_code is null loop
    loop
      v_code := '';
      for i in 1..6 loop
        v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
      end loop;
      exit when not exists (select 1 from public.centres where student_join_code = v_code)
            and not exists (select 1 from public.centres where join_code = v_code);
    end loop;
    update public.centres set student_join_code = v_code where id = c.id;
  end loop;
end $$;

create unique index if not exists centres_student_join_code_idx on public.centres (student_join_code);

-- 2) student_signup now resolves the centre by the STUDENT code ----------------
create or replace function public.student_signup(
  p_join_code text,
  p_name      text,
  p_parent    text,
  p_class     text,
  p_school    text,
  p_address   text default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_centre  uuid;
  v_cname   text;
  v_code    text;
  v_id      uuid;
  v_name    text := trim(coalesce(p_name, ''));
  v_parent  text := trim(coalesce(p_parent, ''));
  v_class   text := trim(coalesce(p_class, ''));
  v_school  text := trim(coalesce(p_school, ''));
  v_fails   int;
  v_pending int;
  v_alpha   constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no confusable chars
  i         int;
begin
  -- Required fields (school is compulsory alongside name, parent, class).
  if length(v_name)   < 2 then raise exception 'Enter your full name'; end if;
  if v_parent !~ '^\+?\d[\d\s\-]{6,}$' then raise exception 'Enter a valid parent phone number'; end if;
  if length(v_class)  < 1 then raise exception 'Select your class'; end if;
  if length(v_school) < 2 then raise exception 'Enter your school name'; end if;

  -- Resolve the centre from its STUDENT join code; throttle repeated invalid attempts.
  select id, name into v_centre, v_cname
    from public.centres where student_join_code = upper(trim(coalesce(p_join_code, '')));
  if v_centre is null then
    select count(*) into v_fails from public.code_attempts where at > now() - interval '1 minute';
    if v_fails >= 25 then raise exception 'Too many attempts — please try again in a minute'; end if;
    insert into public.code_attempts default values;
    delete from public.code_attempts where at < now() - interval '5 minutes';
    raise exception 'Invalid student code — check with your teacher';
  end if;

  -- Flood guard: cap outstanding pending requests per centre.
  select count(*) into v_pending from public.students where centre_id = v_centre and status = 'pending';
  if v_pending >= 300 then raise exception 'Too many pending requests — please ask your teacher'; end if;

  -- Unique, human-readable login code (TUT- + 8 chars from the confusable-free alphabet).
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    v_code := 'TUT-' || v_code;
    exit when not exists (select 1 from public.students where student_code = v_code);
  end loop;

  insert into public.students (name, class, school, parent_contact, address, student_code, fee_status, centre_id, status)
  values (v_name, v_class, v_school, v_parent, nullif(trim(coalesce(p_address, '')), ''), v_code, 'Due', v_centre, 'pending')
  returning id into v_id;

  return json_build_object('code', v_code, 'name', v_name, 'centre', v_cname);
end; $$;

revoke all on function public.student_signup(text,text,text,text,text,text) from public;
grant execute on function public.student_signup(text,text,text,text,text,text) to anon, authenticated;

-- 3) my_centre returns both codes so the head can show/copy each --------------
create or replace function public.my_centre()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select json_build_object('name',c.name,'join_code',c.join_code,'student_join_code',c.student_join_code,'logo_url',c.logo_url)
    into v from public.centres c where c.id = public.current_centre();
  return v;
end; $$;

revoke all on function public.my_centre() from public, anon;
grant execute on function public.my_centre() to authenticated;

-- 4) New centres get a student code too ---------------------------------------
create or replace function public.create_centre(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid;
  v_code   text;
  v_scode  text;
  v_alpha  constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i        int;
begin
  if length(coalesce(trim(p_name),'')) < 2 or length(trim(p_name)) > 80 then raise exception 'Enter a centre name (2-80 characters)'; end if;
  if (select centre_id from public.profiles where id=auth.uid()) is not null then raise exception 'You already belong to a centre'; end if;
  loop v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)); exit when not exists (select 1 from public.centres where join_code=v_code); end loop;
  loop
    v_scode := '';
    for i in 1..6 loop v_scode := v_scode || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1); end loop;
    exit when not exists (select 1 from public.centres where student_join_code = v_scode)
          and not exists (select 1 from public.centres where join_code = v_scode);
  end loop;
  begin
    insert into public.centres (name, join_code, student_join_code, owner_id)
    values (trim(p_name), v_code, v_scode, auth.uid()) returning id into v_id;
  exception when unique_violation then
    raise exception 'You already created a centre';
  end;
  update public.profiles set role='admin', staff_status='approved', centre_id=v_id, head_requested=false where id=auth.uid();
  return json_build_object('centre_id',v_id,'join_code',v_code,'student_join_code',v_scode,'name',trim(p_name));
end; $$;

revoke all on function public.create_centre(text) from public, anon;
grant execute on function public.create_centre(text) to authenticated;

-- 5) Let the head rotate the student code if it leaks -------------------------
create or replace function public.regenerate_student_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_centre uuid := public.current_centre();
  v_code   text;
  v_alpha  constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i        int;
begin
  if not public.is_head() then raise exception 'Only the head can change the student code'; end if;
  loop
    v_code := '';
    for i in 1..6 loop v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1); end loop;
    exit when not exists (select 1 from public.centres where student_join_code = v_code)
          and not exists (select 1 from public.centres where join_code = v_code);
  end loop;
  update public.centres set student_join_code = v_code where id = v_centre;
  return v_code;
end; $$;

revoke all on function public.regenerate_student_code() from public, anon;
grant execute on function public.regenerate_student_code() to authenticated;
```

## supabase/student-onboarding.sql

```sql
-- ============================================================================
-- STUDENT SELF-ONBOARDING — Second Skool
-- Students register themselves with the centre's join code and their own
-- details; the head reviews and approves before they gain access. Removes the
-- head's data-entry burden (no more typing 50 students by hand).
--
-- Model: a self-signup inserts a `pending` student row (SECURITY DEFINER, so an
-- anonymous student can only create a pending record in a centre whose join code
-- they know — never read or touch anyone else's data). The head approves (sets
-- batch/branch/fee) or rejects. A code only unlocks the dashboard once approved.
--
-- Safe to run once on the existing database (idempotent). Existing students
-- default to `approved`, so nothing already live is affected.
-- ⚠️ Back up first (Supabase → Database → Backups) before running in production.
-- ============================================================================

-- 1) Registration status on students -----------------------------------------
-- Existing rows default to 'approved' (already active); self-signups are 'pending'.
alter table public.students add column if not exists status text not null default 'approved';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'students_status_chk') then
    alter table public.students
      add constraint students_status_chk check (status in ('pending','approved','rejected'));
  end if;
end $$;

create index if not exists students_status_idx on public.students (centre_id, status);

-- 2) Student self-signup (anon) ----------------------------------------------
-- Validates the join code → centre, enforces the required fields, mints a unique
-- code, and inserts a PENDING student. Reuses code_attempts (from rate-limit.sql)
-- to throttle invalid-join-code spam. Returns the new code + centre name so the
-- app can show the student their code on the waiting screen.
create or replace function public.student_signup(
  p_join_code text,
  p_name      text,
  p_parent    text,
  p_class     text,
  p_school    text,
  p_address   text default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_centre  uuid;
  v_cname   text;
  v_code    text;
  v_id      uuid;
  v_name    text := trim(coalesce(p_name, ''));
  v_parent  text := trim(coalesce(p_parent, ''));
  v_class   text := trim(coalesce(p_class, ''));
  v_school  text := trim(coalesce(p_school, ''));
  v_fails   int;
  v_pending int;
  v_alpha   constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no confusable chars
  i         int;
begin
  -- Required fields (school is compulsory alongside name, parent, class).
  if length(v_name)   < 2 then raise exception 'Enter your full name'; end if;
  if v_parent !~ '^\+?\d[\d\s\-]{6,}$' then raise exception 'Enter a valid parent phone number'; end if;
  if length(v_class)  < 1 then raise exception 'Select your class'; end if;
  if length(v_school) < 2 then raise exception 'Enter your school name'; end if;

  -- Resolve the centre from its join code; throttle repeated invalid attempts.
  select id, name into v_centre, v_cname
    from public.centres where join_code = upper(trim(coalesce(p_join_code, '')));
  if v_centre is null then
    select count(*) into v_fails from public.code_attempts where at > now() - interval '1 minute';
    if v_fails >= 25 then raise exception 'Too many attempts — please try again in a minute'; end if;
    insert into public.code_attempts default values;
    delete from public.code_attempts where at < now() - interval '5 minutes';
    raise exception 'Invalid centre code — check with your teacher';
  end if;

  -- Flood guard: cap outstanding pending requests per centre.
  select count(*) into v_pending from public.students where centre_id = v_centre and status = 'pending';
  if v_pending >= 300 then raise exception 'Too many pending requests — please ask your teacher'; end if;

  -- Unique, human-readable code (TUT- + 8 chars from the confusable-free alphabet).
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    v_code := 'TUT-' || v_code;
    exit when not exists (select 1 from public.students where student_code = v_code);
  end loop;

  insert into public.students (name, class, school, parent_contact, address, student_code, fee_status, centre_id, status)
  values (v_name, v_class, v_school, v_parent, nullif(trim(coalesce(p_address, '')), ''), v_code, 'Due', v_centre, 'pending')
  returning id into v_id;

  return json_build_object('code', v_code, 'name', v_name, 'centre', v_cname);
end; $$;

revoke all on function public.student_signup(text,text,text,text,text,text) from public;
grant execute on function public.student_signup(text,text,text,text,text,text) to anon, authenticated;

-- 3) Head/staff approval of a pending student --------------------------------
-- Approve sets the registration live and lets staff assign batch (class),
-- branch, and an optional first fee in the same action.
create or replace function public.approve_student(
  p_id        uuid,
  p_class     text default null,
  p_branch_id uuid default null,
  p_fee       numeric default null,
  p_fee_due   date default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  update public.students
     set status    = 'approved',
         class     = coalesce(nullif(trim(p_class), ''), class),
         branch_id = coalesce(p_branch_id, branch_id)
   where id = p_id and centre_id = public.current_centre() and status = 'pending';
  if not found then raise exception 'Request not found or already handled'; end if;

  if p_fee is not null and p_fee > 0 then
    insert into public.fees (student_id, amount, period, due_date, status)
    values (p_id, p_fee, to_char(now(), 'Mon YYYY'), coalesce(p_fee_due, current_date), 'Due');
  end if;
end; $$;

create or replace function public.reject_student(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  update public.students set status = 'rejected'
   where id = p_id and centre_id = public.current_centre() and status = 'pending';
end; $$;

revoke all on function public.approve_student(uuid,text,uuid,numeric,date) from public, anon;
revoke all on function public.reject_student(uuid) from public, anon;
grant execute on function public.approve_student(uuid,text,uuid,numeric,date) to authenticated;
grant execute on function public.reject_student(uuid) to authenticated;

-- 4) Snapshot: gate the dashboard on approval --------------------------------
-- Rebuilds get_student_snapshot (rate-limit.sql version) so that:
--   • invalid code   → null (throttled, unchanged)
--   • pending student → { status:'pending', ... } so the app holds on the
--                       waiting screen instead of showing the dashboard
--   • rejected        → null (real code, but no throttle — access declined)
--   • approved        → full snapshot, tagged status:'approved'
create or replace function public.get_student_snapshot(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_result json; v_c uuid; v_fails int;
begin
  if length(coalesce(p_code,'')) < 4 then return null; end if;

  select * into v_student from public.students where student_code = p_code;

  -- Invalid code: sliding-window throttle (valid codes skip this entirely).
  if v_student.id is null then
    select count(*) into v_fails from public.code_attempts where at > now() - interval '1 minute';
    if v_fails >= 25 then raise exception 'Too many attempts — please try again in a minute'; end if;
    insert into public.code_attempts default values;
    delete from public.code_attempts where at < now() - interval '5 minutes';
    return null;
  end if;

  -- Awaiting the head's approval: return a minimal marker (name only), no data.
  if v_student.status = 'pending' then
    return json_build_object('status', 'pending',
      'student', json_build_object('name', v_student.name, 'code', v_student.student_code));
  end if;

  -- Access declined (rejected): real code, so no throttle, but no access.
  if v_student.status <> 'approved' then
    return json_build_object('status', v_student.status);
  end if;

  v_c := v_student.centre_id;
  select json_build_object(
    'status', 'approved',
    'student', json_build_object('dbId',v_student.id,'name',v_student.name,'klass',v_student.class,'school',v_student.school,'code',v_student.student_code,'parent',v_student.parent_contact,'address',v_student.address,'feeStatus',v_student.fee_status),
    'attendance', coalesce((select json_agg(json_build_object('date',a.date,'status',a.status) order by a.date desc) from public.attendance a where a.student_id=v_student.id),'[]'::json),
    'results', coalesce((select json_agg(json_build_object('subject',s.name,'test',t.name,'date',t.date,'marks',r.marks,'total',t.max_marks) order by t.date desc) from public.results r join public.tests t on t.id=r.test_id join public.subjects s on s.id=t.subject_id where r.student_id=v_student.id),'[]'::json),
    'fees', coalesce((select json_agg(json_build_object('period',f.period,'amount',f.amount,'status',f.status,'dueDate',f.due_date,'paidDate',f.paid_date) order by f.due_date desc) from public.fees f where f.student_id=v_student.id),'[]'::json),
    'notifications', coalesce((select json_agg(json_build_object('title',n.title,'detail',n.detail,'icon',n.icon,'createdAt',n.created_at) order by n.created_at desc) from public.notifications n where n.student_id=v_student.id),'[]'::json),
    'teachers', coalesce((select json_agg(json_build_object('name',te.name,'subject',te.subject,'experience',te.experience,'qualification',te.qualification,'rating',te.rating,'about',te.about) order by te.created_at desc) from public.teachers te where te.centre_id=v_c),'[]'::json),
    'rankings', coalesce((select json_object_agg(subject,arr) from (select subject, json_agg(json_build_array(name,pct) order by pct desc) as arr from (select s.name as subject, st.name as name, round(sum(r.marks)::numeric/nullif(sum(t.max_marks),0)*100)::int as pct from public.results r join public.tests t on t.id=r.test_id join public.subjects s on s.id=t.subject_id join public.students st on st.id=r.student_id where st.centre_id=v_c group by s.name, st.name) per_student group by subject) ranked),'{}'::json),
    'timetable', coalesce((select json_agg(json_build_object('day',tt.day,'start',tt.start_time,'end',tt.end_time,'subject',tt.subject,'room',tt.room) order by tt.start_time) from public.timetable tt where tt.class=v_student.class and tt.centre_id=v_c),'[]'::json),
    'assignments', coalesce((select json_agg(json_build_object('title',ag.title,'subject',sub.name,'due',ag.due_date,'instructions',ag.instructions) order by ag.due_date desc) from public.assignments ag left join public.subjects sub on sub.id=ag.subject_id where ag.class=v_student.class and ag.centre_id=v_c),'[]'::json)
  ) into v_result;
  return v_result;
end; $$;

grant execute on function public.get_student_snapshot(text) to anon, authenticated;
```

## tests/share.test.ts

```ts
import { describe, it, expect } from 'vitest'
import { studentCodeMessage, whatsappShareUrl, appOrigin, weeklyReportMessage, studentReportMessage } from '../app/lib/share'

describe('appOrigin', () => {
  it('falls back to the production URL when there is no window (SSR)', () => {
    expect(appOrigin()).toBe('https://tution-management-taupe.vercel.app')
  })
})

describe('studentCodeMessage', () => {
  it('includes the student name, the code, and the app link', () => {
    const msg = studentCodeMessage('Arjun', 'TUT-ABCDEFGH')
    expect(msg).toContain('Arjun')
    expect(msg).toContain('TUT-ABCDEFGH')
    expect(msg).toContain('tution-management-taupe.vercel.app')
  })

  it('uses a friendly fallback when the name is blank', () => {
    expect(studentCodeMessage('   ', 'TUT-ABCDEFGH')).toContain('your child')
  })
})

describe('whatsappShareUrl', () => {
  it('prefixes a bare 10-digit Indian number with 91', () => {
    expect(whatsappShareUrl('9876543210', 'hi')).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/)
  })

  it('strips spaces, dashes and plus signs', () => {
    expect(whatsappShareUrl('+91 98765-43210', 'hi')).toContain('wa.me/919876543210')
  })

  it('keeps an already-international number as-is', () => {
    expect(whatsappShareUrl('919876543210', 'hi')).toContain('wa.me/919876543210')
  })

  it('url-encodes the message', () => {
    expect(whatsappShareUrl('9876543210', 'a b&c')).toContain('text=a%20b%26c')
  })

  it('yields the contact-picker form when the number is empty', () => {
    expect(whatsappShareUrl('', 'hi')).toMatch(/^https:\/\/wa\.me\/\?text=/)
  })
})

describe('weeklyReportMessage', () => {
  const report = {
    generated_at: '2026-06-30T00:00:00Z',
    branches: [
      { name: 'Noida Central', students: 12, new_students: 2, staff: 3, att_pct: 88, fees_collected: 50000, fees_pending: 15000 },
      { name: 'Sector 18', students: 5, new_students: 0, staff: 1, att_pct: 0, fees_collected: 0, fees_pending: 0 },
    ],
    unassigned_students: 1,
    tests_this_week: 4,
  }

  it('includes each branch name and its key numbers', () => {
    const msg = weeklyReportMessage(report)
    expect(msg).toContain('Noida Central')
    expect(msg).toContain('Sector 18')
    expect(msg).toContain('88%')
    expect(msg).toContain('₹50,000')
    expect(msg).toContain('+2 new')
  })

  it('shows centre totals (unassigned + tests)', () => {
    const msg = weeklyReportMessage(report)
    expect(msg).toContain('Unassigned students: 1')
    expect(msg).toContain('Tests conducted this week: 4')
  })

  it('handles a centre with no branches', () => {
    const msg = weeklyReportMessage({ generated_at: '2026-06-30T00:00:00Z', branches: [], unassigned_students: 0, tests_this_week: 0 })
    expect(msg).toContain('No branches configured yet')
  })
})

describe('studentReportMessage', () => {
  it('computes attendance % and includes name, tests and fees', () => {
    const msg = studentReportMessage({ name: 'Arjun', klass: 'Class 10-B', parent: '', fee_status: 'Due', att_present: 4, att_total: 5, tests: 2, avg_pct: 82 })
    expect(msg).toContain('Arjun')
    expect(msg).toContain('80% (4/5)')
    expect(msg).toContain('2 (avg 82%)')
    expect(msg).toContain('Fees: Due')
  })

  it('reports when no classes were marked this week', () => {
    const msg = studentReportMessage({ name: 'Neha', klass: 'Class 9', parent: '', fee_status: 'Paid', att_present: 0, att_total: 0, tests: 0, avg_pct: 0 })
    expect(msg).toContain('no classes marked this week')
  })

  it('switches wording to monthly when days=30', () => {
    const msg = studentReportMessage({ name: 'Neha', klass: 'Class 9', parent: '', fee_status: 'Paid', att_present: 20, att_total: 24, tests: 3, avg_pct: 75 }, 'My Centre', 30)
    expect(msg).toContain('Monthly update')
    expect(msg).toContain('Tests this month')
    expect(msg).toContain('My Centre')
  })
})
```

## tests/store-reducers.test.ts

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useDashboard } from '../app/store'

// These exercise the pure state transitions (no network) that decide what the
// user sees right after auth, plus the attendance-class regression fix.

const reset = () => useDashboard.setState({ attClass: '', students: [], screen: 'home', role: 'admin', staffStatus: 'approved' })

describe('setAuth landing screen', () => {
  beforeEach(reset)

  it('sends an approved head/admin to home', () => {
    useDashboard.getState().setAuth('u1', 'admin', 'a@x.com', 'approved', true)
    expect(useDashboard.getState().screen).toBe('home')
    expect(useDashboard.getState().role).toBe('admin')
  })

  it('sends an approved teacher to home', () => {
    useDashboard.getState().setAuth('u2', 'teacher', 't@x.com', 'approved', true)
    expect(useDashboard.getState().screen).toBe('home')
  })

  it('sends a pending teacher to the pending screen', () => {
    useDashboard.getState().setAuth('u3', 'teacher', 't@x.com', 'pending', true)
    expect(useDashboard.getState().screen).toBe('pending')
  })

  it('sends a rejected user to the denied screen', () => {
    useDashboard.getState().setAuth('u4', 'teacher', 't@x.com', 'rejected', true)
    expect(useDashboard.getState().screen).toBe('denied')
  })

  it('sends an unregistered signed-in user to register', () => {
    useDashboard.getState().setAuth('u5', 'student', 's@x.com', 'none', true)
    expect(useDashboard.getState().screen).toBe('register')
  })

  it('always clears the auth splash loader', () => {
    useDashboard.setState({ authLoading: true })
    useDashboard.getState().setAuth('u6', 'admin', 'a@x.com', 'approved', true)
    expect(useDashboard.getState().authLoading).toBe(false)
  })

  it('stores the profile name and phone for the profile screen', () => {
    useDashboard.getState().setAuth('u7', 'admin', 'a@x.com', 'approved', true, 'Arnav Hendre', '+91 90000 00000')
    expect(useDashboard.getState().myName).toBe('Arnav Hendre')
    expect(useDashboard.getState().myPhone).toBe('+91 90000 00000')
  })

  it('defaults name/phone to empty when not provided', () => {
    useDashboard.getState().setAuth('u8', 'teacher', 't@x.com', 'approved', true)
    expect(useDashboard.getState().myName).toBe('')
    expect(useDashboard.getState().myPhone).toBe('')
  })
})

describe('loadStudents', () => {
  beforeEach(reset)

  it('defaults attClass to the first student class when none is set', () => {
    useDashboard.getState().loadStudents([{ id: 'TUT-1', name: 'A', klass: 'Class 10', attendance: 0, feeStatus: 'Due', school: '', parent: '' }])
    expect(useDashboard.getState().attClass).toBe('Class 10')
  })

  it('preserves an existing attClass across a refresh (regression)', () => {
    useDashboard.setState({ attClass: 'Class 9' })
    useDashboard.getState().loadStudents([{ id: 'TUT-1', name: 'A', klass: 'Class 10', attendance: 0, feeStatus: 'Due', school: '', parent: '' }])
    expect(useDashboard.getState().attClass).toBe('Class 9')
  })

  it('leaves attClass empty when there are no students', () => {
    useDashboard.getState().loadStudents([])
    expect(useDashboard.getState().attClass).toBe('')
  })
})
```

## tests/store.test.ts

```ts
import { describe, it, expect } from 'vitest'
import { genStudentCode, mapSnapshot, initials, feeColor, stuGrade } from '../app/store'

describe('genStudentCode', () => {
  it('has the TUT- prefix and 8 code characters', () => {
    expect(genStudentCode()).toMatch(/^TUT-[A-Z2-9]{8}$/)
  })

  it('never uses confusable characters (O, 0, I, 1, L)', () => {
    for (let i = 0; i < 100; i++) {
      expect(genStudentCode().slice(4)).not.toMatch(/[O0I1L]/)
    }
  })

  it('is effectively unique across many draws', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => genStudentCode()))
    expect(codes.size).toBe(2000)
  })
})

describe('initials', () => {
  it('takes first letters, max two, uppercased', () => {
    expect(initials('arjun mehta')).toBe('AM')
    expect(initials('ravi')).toBe('R')
    expect(initials('a b c')).toBe('AB')
  })
})

describe('feeColor', () => {
  it('maps each fee status to its colour', () => {
    expect(feeColor('Paid').c).toBe('#2fa36b')
    expect(feeColor('Due').c).toBe('#e0962f')
    expect(feeColor('Overdue').c).toBe('#e8553c')
  })
})

describe('stuGrade', () => {
  it('grades by percentage band', () => {
    expect(stuGrade(95).g).toBe('A+')
    expect(stuGrade(85).g).toBe('A')
    expect(stuGrade(72).g).toBe('B')
    expect(stuGrade(50).g).toBe('C')
  })
})

describe('mapSnapshot', () => {
  const snap = {
    student: { dbId: 'd1', name: 'Arjun', klass: 'Class 10-B', school: 'DPS', code: 'TUT-ABCDEFGH', parent: '+91 90000', address: 'X', feeStatus: 'Due' },
    attendance: [
      { date: '2026-06-01', status: 'Present' },
      { date: '2026-06-02', status: 'Absent' },
    ],
    results: [{ subject: 'Mathematics', test: 'Unit 1', date: '2026-06-01', marks: 18, total: 20 }],
    fees: [
      { period: 'June 2026', amount: 5000, status: 'Paid', dueDate: '2026-06-01', paidDate: '2026-06-02' },
      { period: 'July 2026', amount: 5000, status: 'Due', dueDate: '2026-07-01', paidDate: null },
    ],
    notifications: [{ title: 'Test Reminder', detail: 'Tomorrow', icon: '📝', createdAt: new Date().toISOString() }],
    teachers: [{ name: 'Ravi', subject: 'Mathematics', experience: 5, qualification: 'M.Sc', rating: 4.5, about: 'x' }],
    rankings: { Mathematics: [['Arjun', 90], ['Neha', 80]] },
  }
  const r = mapSnapshot(snap)

  it('builds one student with a computed attendance %', () => {
    expect(r.students?.length).toBe(1)
    expect(r.students?.[0].name).toBe('Arjun')
    expect(r.students?.[0].attendance).toBe(50) // 1 present of 2
    expect(r.currentStudentDbId).toBe('d1')
  })

  it('maps results, paid-only fee history, and the pending fee', () => {
    expect(r.stuResults?.[0].marks).toBe(18)
    expect(r.stuFeeHistory?.length).toBe(1)
    expect(r.stuPendingFee?.period).toBe('July 2026')
  })

  it('passes through rankings and stringifies teacher rating', () => {
    expect(r.rankData?.Mathematics?.[0]?.[0]).toBe('Arjun')
    expect(r.teachers?.[0].rating).toBe('4.5')
  })

  it('handles a sparse snapshot without throwing', () => {
    const empty = mapSnapshot({ student: { dbId: 'd', code: 'c' } })
    expect(empty.stuResults).toEqual([])
    expect(empty.stuPendingFee).toBeNull()
    expect(empty.students?.[0].attendance).toBe(0)
    expect(empty.centreName).toBe('')
    expect(empty.centreLogo).toBe('')
  })

  it('passes through centre branding (white-label logo)', () => {
    const branded = mapSnapshot({
      student: { dbId: 'd', code: 'c' },
      centre: { name: 'Bright Future Tuition', logo_url: 'data:image/png;base64,AAA' },
    })
    expect(branded.centreName).toBe('Bright Future Tuition')
    expect(branded.centreLogo).toBe('data:image/png;base64,AAA')
  })

  it('computes the 30-day monthly summary from raw dates', () => {
    const recent = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0]
    const old = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]
    const r = mapSnapshot({
      student: { dbId: 'd', code: 'c' },
      attendance: [
        { date: recent, status: 'Present' },
        { date: recent, status: 'Absent' },
        { date: old, status: 'Present' }, // outside the 30-day window
      ],
      results: [
        { subject: 'Maths', test: 'T1', date: recent, marks: 40, total: 50 },
        { subject: 'Maths', test: 'T0', date: old, marks: 10, total: 50 },
      ],
    })
    expect(r.stuMonthly?.attPresent).toBe(1)
    expect(r.stuMonthly?.attTotal).toBe(2)
    expect(r.stuMonthly?.tests).toBe(1)
    expect(r.stuMonthly?.avgPct).toBe(80)
  })

  it('maps class assignments for the student', () => {
    const r = mapSnapshot({
      student: { dbId: 'd', code: 'c', klass: 'Class 10-B' },
      assignments: [
        { title: 'Algebra WS 5', subject: 'Mathematics', due: '2026-07-05', instructions: 'Do Q1-10' },
        { title: 'Essay', subject: 'English', due: '2026-07-03', instructions: '' },
      ],
    })
    expect(r.stuAssignments?.length).toBe(2)
    expect(r.stuAssignments?.[0].title).toBe('Algebra WS 5')
    expect(r.stuAssignments?.[0].subject).toBe('Mathematics')
  })

  it('groups the class timetable by day', () => {
    const r = mapSnapshot({
      student: { dbId: 'd', code: 'c', klass: 'Class 10-B' },
      timetable: [
        { day: 'Mon', start: '09:00', end: '10:00', subject: 'Mathematics', room: 'R1' },
        { day: 'Mon', start: '10:00', end: '11:00', subject: 'Physics', room: 'R2' },
        { day: 'Tue', start: '09:00', end: '10:00', subject: 'English', room: 'R1' },
      ],
    })
    expect(r.timetableData?.Mon?.length).toBe(2)
    expect(r.timetableData?.Tue?.length).toBe(1)
    expect(r.timetableData?.Mon?.[0]?.[2]).toBe('Mathematics')
  })
})
```

## tests/student-onboarding.test.ts

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Controllable RPC mock — each test sets the next result. The store imports
// `supabase` at module load, so the mock must be declared before the import.
const rpc = vi.fn<(name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>()
vi.mock('../app/lib/supabase', () => ({ supabase: { rpc: (...a: [string, Record<string, unknown>?]) => rpc(...a) } }))
vi.mock('../app/lib/push', () => ({ sendPush: vi.fn(() => Promise.resolve()), enablePush: vi.fn(), pushSupported: () => false }))

import { useDashboard, type PendingStudent } from '../app/store'

const S = () => useDashboard.getState()

const pending = (over: Partial<PendingStudent> = {}): PendingStudent => ({
  dbId: 'd1', name: 'Neha', klass: 'Class 10', school: 'DPS', parent: '+91 90000 00000',
  address: '', code: 'TUT-ABCDEFGH', when: 'just now', ...over,
})

beforeEach(() => {
  rpc.mockReset()
  useDashboard.setState({
    stuSignup: { joinCode: 'ABC123', name: '', parent: '', klass: 'Class 10', school: '', address: '' },
    stuPending: null, pendingStudents: [], toast: '', screen: 'home', role: 'admin',
  })
})
afterEach(() => vi.clearAllTimers())

describe('studentSignup validation (no network on invalid input)', () => {
  const fill = (patch: Partial<ReturnType<typeof S>['stuSignup']>) =>
    useDashboard.getState().setStuSignup(patch)

  it('rejects a missing/short name', async () => {
    fill({ name: 'A', parent: '+91 90000 00000', school: 'DPS' })
    await S().studentSignup()
    expect(S().toast).toBe('Enter your full name')
    expect(rpc).not.toHaveBeenCalled()
    expect(S().stuPending).toBeNull()
  })

  it('rejects an invalid parent phone', async () => {
    fill({ name: 'Neha', parent: '123', school: 'DPS' })
    await S().studentSignup()
    expect(S().toast).toBe('Enter a valid parent phone number')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a blank class', async () => {
    fill({ name: 'Neha', parent: '+91 90000 00000', school: 'DPS', klass: '   ' })
    await S().studentSignup()
    expect(S().toast).toBe('Select your class')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a missing school (school is compulsory)', async () => {
    fill({ name: 'Neha', parent: '+91 90000 00000', school: '' })
    await S().studentSignup()
    expect(S().toast).toBe('Enter your school name')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('accepts a valid form, lands on the pending screen with the minted code', async () => {
    rpc.mockResolvedValueOnce({ data: { code: 'TUT-ZZZZ2345', name: 'Neha', centre: 'Bright Future' }, error: null })
    fill({ name: 'Neha Sharma', parent: '+91 90000 00000', school: 'DPS', address: '12 MG Rd' })
    await S().studentSignup()
    expect(rpc).toHaveBeenCalledWith('student_signup', expect.objectContaining({
      p_name: 'Neha Sharma', p_parent: '+91 90000 00000', p_class: 'Class 10',
      p_school: 'DPS', p_address: '12 MG Rd', p_join_code: 'ABC123',
    }))
    expect(S().screen).toBe('stuPending')
    expect(S().role).toBe('student')
    expect(S().stuPending).toEqual({ name: 'Neha', code: 'TUT-ZZZZ2345', centre: 'Bright Future' })
    // The form is cleared after a successful submit.
    expect(S().stuSignup.name).toBe('')
  })

  it('sends optional address as null when left blank', async () => {
    rpc.mockResolvedValueOnce({ data: { code: 'TUT-AAAA2345', name: 'Neha', centre: 'X' }, error: null })
    fill({ name: 'Neha Sharma', parent: '+91 90000 00000', school: 'DPS', address: '   ' })
    await S().studentSignup()
    expect(rpc).toHaveBeenCalledWith('student_signup', expect.objectContaining({ p_address: null }))
  })

  it('surfaces a server error and does not navigate', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Invalid centre code' } })
    fill({ name: 'Neha Sharma', parent: '+91 90000 00000', school: 'DPS' })
    await S().studentSignup()
    expect(S().toast).toBe('Invalid centre code')
    expect(S().screen).toBe('home')
    expect(S().stuPending).toBeNull()
  })
})

describe('approveStudent', () => {
  beforeEach(() => useDashboard.setState({ pendingStudents: [pending(), pending({ dbId: 'd2', name: 'Raj' })] }))

  it('removes the approved student from the queue and confirms', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await S().approveStudent('d1', 'Class 10-B', 'br1', '5000', '2026-08-01')
    expect(rpc).toHaveBeenCalledWith('approve_student', {
      p_id: 'd1', p_class: 'Class 10-B', p_branch_id: 'br1', p_fee: 5000, p_fee_due: '2026-08-01',
    })
    expect(S().pendingStudents.map(p => p.dbId)).toEqual(['d2'])
    expect(S().toast).toBe('Student approved')
  })

  it('passes a null fee when the amount is blank or zero', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await S().approveStudent('d1', '', null, '0', '')
    expect(rpc).toHaveBeenCalledWith('approve_student', expect.objectContaining({ p_fee: null, p_class: null, p_fee_due: null }))
  })

  it('keeps the student in the queue when the RPC errors', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Not allowed' } })
    await S().approveStudent('d1', 'Class 10', null, '', '')
    expect(S().pendingStudents.map(p => p.dbId)).toEqual(['d1', 'd2'])
    expect(S().toast).toBe('Not allowed')
  })
})

describe('rejectStudent', () => {
  beforeEach(() => useDashboard.setState({ pendingStudents: [pending(), pending({ dbId: 'd2' })] }))

  it('removes the declined student and confirms', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await S().rejectStudent('d1')
    expect(rpc).toHaveBeenCalledWith('reject_student', { p_id: 'd1' })
    expect(S().pendingStudents.map(p => p.dbId)).toEqual(['d2'])
    expect(S().toast).toBe('Request declined')
  })

  it('keeps the student when the RPC errors', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'nope' } })
    await S().rejectStudent('d1')
    expect(S().pendingStudents.length).toBe(2)
    expect(S().toast).toBe('nope')
  })
})
```

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

## vitest.config.ts

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```
