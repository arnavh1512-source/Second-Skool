# Second Skool — Sub-processors

**Version 1.0 (draft — not published)**
**Last updated: [EFFECTIVE DATE]**

Second Skool uses the third parties below to deliver the service. Each is a Sub-processor under our [Data Processing Agreement](./data-processing-agreement.md), is bound by a written contract with data protection obligations no less protective than ours, and processes data only on our instructions.

**We remain fully liable to our customers for our Sub-processors' acts and omissions.**

We give **30 days' notice** before adding or replacing a Sub-processor. To receive those notices, write to [SUBPROCESSOR NOTICE EMAIL]. If you object on reasonable data protection grounds within the notice period, see clause 5.5 of the DPA.

---

## Core infrastructure — all customers

| Sub-processor | Entity & country | What it does | Personal data it touches | Processing location |
|---|---|---|---|---|
| **Supabase** | Supabase, Inc., USA | Database, authentication, storage. This is where Centre Data lives. | All Centre Data — student names, guardian contacts, attendance, results, fees, timetables, staff records. Account credentials and auth tokens. | **[SUPABASE REGION]** |
| **Vercel** | Vercel, Inc., USA | Application hosting and content delivery. Runs the app code; data passes through in transit. | All data in transit between the user and the database. Request metadata and access logs. | Global edge network; functions in [VERCEL FUNCTION REGION] |
| **Google** | Google LLC / Google India, USA & India | (a) Google OAuth sign-in. (b) Firebase Cloud Messaging, which delivers web push notifications to Chrome and Android. | Sign-in: name, email address, profile picture, Google account ID. Push: device push endpoint and the notification content sent to it. | Global |

## Conditional — used only where the feature or setting is enabled

| Sub-processor | Entity & country | What it does | Personal data it touches | Processing location |
|---|---|---|---|---|
| **Razorpay** | Razorpay Software Private Limited, India | Collects subscription payments from coaching centres. | Payer name, email, phone, payment instrument details (held by Razorpay — we never receive card numbers). **No student data.** | India |
| **Upstash** | Upstash, Inc., USA | Distributed rate limiting. | An account identifier and a request counter. No names, no student data. | [UPSTASH REGION] |
| **Sentry** | Functional Software, Inc. (Sentry), USA | Error and exception monitoring. | Stack traces, request paths, an account identifier. Configured to exclude request bodies and personal data payloads. | [SENTRY REGION] |

## Browser push delivery — not contracted Sub-processors

Web push is delivered through whichever push service the recipient's own browser uses. We do not choose it and have no contract with it; the recipient's browser vendor does.

| Service | When it is used | What it receives |
|---|---|---|
| Google FCM | Chrome, Edge, Android browsers | Encrypted notification payload and the endpoint URL |
| Mozilla autopush | Firefox | As above |
| Apple Push Notification service | Safari on macOS/iOS | As above |

Payloads are encrypted end-to-end under the Web Push protocol; the push service relays them without being able to read the content.

---

## What we do not use

For the avoidance of doubt, Second Skool does **not** use:

- any advertising network or ad-tech vendor,
- Google Analytics, Meta Pixel, or any third-party behavioural analytics,
- any data broker, enrichment or lead-generation service,
- any customer-support tool that ingests Centre Data,
- any AI or machine-learning service that receives Centre Data.

If that changes, this page changes first, with 30 days' notice.

---

## Change log

| Date | Change |
|---|---|
| [EFFECTIVE DATE] | Initial version |

---

**Before publishing this page, verify:**
- [ ] The Supabase project region — if it is not `ap-south-1`, Centre Data is stored outside India and the Privacy Policy and DPA must say so.
- [ ] Whether Upstash and Sentry are actually configured in production. If the environment variables are unset, the features are inert — say "not currently used" rather than listing them as active.
- [ ] Razorpay onboarding status. Do not list a payment processor you have not signed with.
- [ ] The Vercel function region setting.
