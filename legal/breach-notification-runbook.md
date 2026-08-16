# Breach Notification Runbook

> **INTERNAL DOCUMENT. DO NOT PUBLISH.**
> This is an operational playbook, not a customer-facing policy. Publishing it would tell an attacker exactly what we do and how fast.

**Version 1.0 (draft)** · **Owner: [INCIDENT LEAD NAME]** · **Last reviewed: [DATE]**

---

## 0. The one thing to remember

**The clock starts when you become aware, not when you finish investigating.**

You do not need a complete picture to notify. Partial notification on time beats a complete notification that is late. Our DPA promises customers notification within **48 hours**, and within **24 hours** where children's data is involved — which, on this platform, is almost always.

---

## 1. What counts as a breach

Under the DPDP Act, a *personal data breach* is any unauthorised processing, or accidental disclosure, acquisition, sharing, use, alteration, destruction or loss of access to personal data, that compromises its **confidentiality, integrity or availability**.

Note the last word. **Losing data counts. So does losing access to it.**

### It IS a breach

- Any cross-tenant data leak — one centre seeing another's students. **Treat as critical regardless of record count.**
- Row-level security bypassed, or an API route returning data outside the caller's centre.
- The service-role key exposed, leaked, committed, or logged.
- An operator-console compromise, or unexplained privileged access in the logs.
- Unauthorised access to the Supabase project or the Vercel account.
- Database records destroyed or corrupted without a recoverable backup.
- A device holding production credentials lost or stolen.
- A dependency compromise that could have read data.
- A phishing success against anyone with production access.

### It probably is NOT a breach

- A centre's own staff member misusing data they were legitimately given — that is the centre's incident, but tell them.
- A user forgetting their password.
- A brief outage with no data loss (availability degraded but not lost; log it, monitor for pattern).
- A vulnerability found and fixed with evidence it was never exploited — **document the evidence**; without it, treat as a breach.

**When in doubt, treat it as a breach.** The cost of an unnecessary notification is embarrassment. The cost of a missed one is a penalty of up to ₹250 crore and the end of the business.

---

## 2. Severity

| Level | Definition | Notify customers | Notify Board |
|---|---|---|---|
| **SEV-1** | Any child's data exposed to an unauthorised party. Cross-tenant leak. Credential compromise with data access. | **24 hours** | Yes, immediately |
| **SEV-2** | Adult account data exposed. Confirmed unauthorised access with no evidence of exfiltration. | 48 hours | Yes |
| **SEV-3** | Irrecoverable data loss affecting one centre. Extended availability loss. | 48 hours | Assess |
| **SEV-4** | Vulnerability found, no evidence of exploitation, fixed. | Not required; consider disclosing | No |

Given the customer base, **default to SEV-1**.

---

## 3. The first hour

Work in this order. Do not skip step 3 to get to step 4 faster.

### 3.1 Contain (0–15 min)

- Rotate `SUPABASE_SERVICE_ROLE_KEY` if there is any chance it is involved. Rotate first, ask later — it is a two-minute change in Supabase and Vercel.
- Revoke suspicious sessions: Supabase Dashboard → Authentication → Users → sign out.
- If a route is leaking, take it down. A 503 is better than a leak. Redeploy with the route disabled, or roll back to the last known-good deployment in Vercel.
- If the operator console is implicated, remove the entry from `ALLOWED` in `app/lib/operator.ts` and deploy.
- Do **not** delete logs, tables or evidence. Ever.

### 3.2 Preserve evidence (15–30 min)

- Snapshot Vercel logs for the window, to a file, off-platform.
- Snapshot Supabase logs and, if available, a point-in-time database snapshot from before the incident.
- Screenshot anything ephemeral.
- Start `incidents/[YYYY-MM-DD]-[slug].md` and write everything down as you go. **Timestamps in IST, and note when each fact became known.** The "became aware" time is the legally significant one and you will be asked to prove it.

### 3.3 Assess (30–60 min)

Answer these, in writing, even if the answer is "unknown at this time":

1. What data? Which tables, which fields?
2. **Were children's records involved?** (Almost certainly yes → SEV-1.)
3. How many individuals, and how many centres?
4. Which centres specifically? You will need to name them to notify them.
5. Was data actually accessed or exfiltrated, or was it merely exposed?
6. What was the root cause?
7. Is it contained now? How do you know?
8. Can the same class of fault exist anywhere else?

### 3.4 Decide (by 60 min)

Assign a severity. Name an incident lead. Set the notification deadline as an actual clock time, and write it at the top of the incident file.

---

## 4. Notifying customers (centres)

Send within 24 hours for SEV-1, 48 hours for SEV-2/3. To the registered email of every affected centre. From a named person, not `noreply@`.

**Do not** send one blast to all centres. Notify the affected ones individually; if unaffected centres need reassurance, that is a separate, later message.

### Template

> Subject: Security incident affecting your Second Skool data — action may be required
>
> Dear [CENTRE NAME],
>
> I am writing to tell you about a security incident affecting data you hold on Second Skool. We became aware of it at [TIME] on [DATE].
>
> **What happened.** [Plain description. No jargon, no minimising.]
>
> **What data was involved.** [Specific categories and, where known, the specific students or records. Say clearly whether children's records were affected.]
>
> **How many people.** [Number, or best estimate, and say it is an estimate.]
>
> **What we have done.** [Containment steps, with times.]
>
> **What this means for you.** As the Data Fiduciary for this data, you may have your own obligation to notify the affected data principals and the Data Protection Board of India. We will give you everything you need to do that. [If we hold a view on whether their duty is triggered, say so, and say it is not legal advice.]
>
> **What you should do.** [Specific actions, or "no action required from you at this stage".]
>
> **What happens next.** We will update you by [DATE/TIME] and send a full report by [DATE].
>
> I am sorry this happened. Reply to this email or call me on [PHONE] with any question.
>
> [NAME], [TITLE], [LEGAL ENTITY NAME]

**Never say:** "out of an abundance of caution", "we take security very seriously", "no evidence of misuse" (unless you have actually looked and can say what you looked at), or "a small number of users" when you know the number.

---

## 5. Notifying the Data Protection Board

Where the incident engages our own duty as a Data Fiduciary (our account holders' data, our logs) we notify directly. Where the affected data is Centre Data, the duty is primarily the centre's — but we support it and, on current guidance, may also have a reporting obligation.

The DPDP Rules contemplate an **initial intimation without delay**, followed by **detailed particulars within 72 hours** (extendable on request).

> **⚠️ Verify the current position before relying on this.** The DPDP Rules and the Board's filing mechanism are phasing in. Confirm the live requirement and filing channel at the time of the incident — check [meity.gov.in](https://www.meity.gov.in) — rather than trusting this document's timeline.

**Initial intimation** — nature, extent, timing and location of the breach; likely consequences.

**Within 72 hours** — the above plus: broad description of events and circumstances; mitigation measures taken and to be taken; findings on who caused it; remedial measures to prevent recurrence; and confirmation of the notice given to affected data principals.

Keep the filing reference. Keep everything.

---

## 6. Notifying individuals

Where the affected people are our own account holders, we notify them directly.

Where they are students and guardians, **the centre notifies them** — we do not have the relationship and should not contact a parent out of the blue. Give the centre a draft they can adapt, so their notification is accurate rather than improvised.

The notice must be in clear plain language and must state: what happened, what data, the likely consequences, what safety measures the individual can take, our contact point for questions, and — critically — it must not be buried in other content.

---

## 7. Also notify

| Who | When |
|---|---|
| CERT-In | Certain classes of cyber incident must be reported within **6 hours** under the 2022 CERT-In directions. **Check whether this applies** — the timeline is much shorter than DPDP's. Report at [cert-in.org.in](https://www.cert-in.org.in). |
| Supabase / Vercel support | Immediately, if the incident involves their platform |
| Cyber-insurance | Immediately, if a policy exists — late notice can void cover |
| Razorpay | If any payment data is implicated |
| Police / cybercrime portal | For criminal intrusion, extortion, or ransomware |

---

## 8. After

Within **5 business days** of closure:

- Write a post-mortem in `incidents/`. Blameless on people, unsparing on systems.
- Ship the fix, and a test that would have caught it.
- Sweep for the same class of fault elsewhere.
- Send affected centres a written closure report.
- Update this runbook with whatever it got wrong.

---

## 9. Contacts and credentials

| | |
|---|---|
| Incident lead | [NAME], [PHONE], [EMAIL] |
| Backup lead | [NAME], [PHONE], [EMAIL] |
| Legal counsel | [NAME], [FIRM], [PHONE] |
| Supabase project | `lfrxlignexqzresgymlx` — dashboard → Settings → API to rotate keys |
| Vercel project | [VERCEL PROJECT] — Deployments → Instant Rollback |
| Cyber-insurance policy | [INSURER], policy [NUMBER], claims [PHONE] |

**Set these up before you need them:**

- [ ] Legal counsel who has read our DPA, on retainer or at least on speed dial
- [ ] Cyber-insurance quote
- [ ] Supabase **point-in-time recovery enabled** — without it, step 3.2 has nothing to snapshot and a destructive incident is unrecoverable
- [ ] A tested restore. An untested backup is a rumour.
- [ ] A monitored `[SECURITY EMAIL]` inbox — a responsible discloser who cannot reach you will disclose publicly instead
- [ ] Alerting on privileged-access log events, so "become aware" happens through monitoring rather than through a customer's phone call

---

## 10. Quarterly drill

Once a quarter, pick a scenario and walk it through on paper in 30 minutes:

- The service-role key is in a public GitHub commit.
- A centre head reports seeing another centre's students.
- The production database is empty.
- A parent emails saying their child's marks were visible to a stranger.

Time yourself against the 24-hour clock. Fix whatever the drill exposes. A runbook nobody has ever run is decoration.
