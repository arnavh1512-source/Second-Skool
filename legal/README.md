# Second Skool — legal pack

Drafts, not published. Nothing here is linked from the app yet.

## What's here

| File | Audience | Status |
|---|---|---|
| `terms-of-service.md` | The coaching centre (your customer) | Draft |
| `privacy-policy.md` | Everyone — public page | Draft |
| `data-processing-agreement.md` | The centre's lawyer | Draft |
| `childrens-data-addendum.md` | Schools that ask specifically about minors | Draft |
| `acceptable-use-policy.md` | Public page, referenced by ToS | Draft |
| `refund-and-cancellation-policy.md` | Public page — Razorpay requires it live | Draft |
| `grievance-redressal.md` | Public page — statutory | Draft |
| `sub-processors.md` | Public page, referenced by the DPA | Draft |
| `breach-notification-runbook.md` | **Internal only — never publish** | Draft |

## Before any of this goes live

**1. Fill the placeholders.** Every `[SQUARE BRACKET]` is a decision you have to make. Grep for them:

```bash
grep -rn "\[[A-Z_ ]*\]" legal/
```

The main ones: legal entity name and form, registered address, GSTIN, the domain, a support email that isn't your personal Gmail, and the Supabase region.

**2. Check the Supabase region.** Project `lfrxlignexqzresgymlx`. If it isn't `ap-south-1`, students' data sits outside India. That's permitted under the DPDP Act — it's a blacklist model, not a whitelist — but it must be stated accurately in the Privacy Policy and the DPA, and school chains will ask. Confirm it in the Supabase dashboard before publishing.

**3. Get a lawyer to read the ToS and the DPA.** Not the whole pack — those two. They carry the liability cap and the indemnity, and they're the documents that decide who is holding the bag if student data leaks. An Indian tech/privacy lawyer, a few thousand rupees, one afternoon. Children's data is the wrong place to launch on AI-drafted paperwork alone.

**4. Confirm which DPDP obligations are actually live.** The Act's obligations phase in on notified deadlines. Verify the current position before relying on any timeline stated in these drafts — particularly the breach-notification windows in the runbook.

## What is still missing from the product

These documents describe behaviour the app does not yet have:

- **No record of acceptance.** Nothing captures that a centre agreed to the ToS, or when, or which version. You need a `terms_accepted_at` and `terms_version` on the centre or the owner's profile, captured at centre creation.
- **No parental-consent record.** The DPA makes the centre warrant it holds verifiable parental consent for every student. Right now there is nowhere for them to record that, so the warranty is unfalsifiable — fine legally, weak in practice. A consent-obtained flag and date per student would make it real.
- **No data export.** The ToS promises the centre can export its data within 30 days of termination. There is no export today.
- **No deletion-on-request path for a single student.** Centre-wide deletion exists in the operator console; per-student erasure does not.

None of these block signing a first customer. All of them will be asked about by the second one.
