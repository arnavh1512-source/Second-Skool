# Backups and restore

The Supabase free plan takes **no backups**. No daily snapshots, no
point-in-time recovery, no export button. If this project is deleted or
corrupted, every student record, parent phone number and home address goes with
it and there is nothing to restore from.

[`.github/workflows/backup.yml`](../.github/workflows/backup.yml) is the
free-tier substitute: a nightly `pg_dump` at 01:30 IST, stored as a private
GitHub artifact for 90 days.

## Setting it up

One secret, once.

1. Supabase Dashboard → **Connect** → the **Direct / Connection string** tab →
   Connection Method: **Session pooler** → copy the URI. It looks like:
   ```
   postgresql://postgres.lfrxlignexqzresgymlx:PASSWORD@aws-N-ap-south-1.pooler.supabase.com:5432/postgres
   ```
   It has to be the **session** pooler on port **5432**. The transaction pooler
   (6543) does not hold a session open and `pg_dump` cannot work through it.
   The direct connection is IPv6-only and GitHub's runners are IPv4, so the
   pooler is the only route in. Two tells that you copied the right one: the
   user is `postgres.<ref>` rather than plain `postgres`, and the host ends in
   `pooler.supabase.com` rather than `supabase.co`. The workflow checks both
   and fails with a readable message rather than a timeout.

   Ignore the "Enable IPv4 add-on" banner on that tab — it is a paid add-on
   for a problem the session pooler solves for free.

   The password must not contain characters that need percent-encoding in a
   URI (`@ / : ? # %`). If you are resetting it, pick a long alphanumeric one
   and the whole class of confusing auth failures disappears.

2. GitHub → Settings → Secrets and variables → Actions → New repository secret
   - Name: `SUPABASE_DB_URL`
   - Value: the URI above

3. Optional but recommended — add a second secret `BACKUP_PASSPHRASE` (any long
   random string, stored in your password manager). The dumps are then
   encrypted with AES256. Without it they are plain gzip, which is only
   acceptable while this repository stays private. **If this repo ever becomes
   public, artifacts become world-readable and this secret is mandatory.**

4. Actions tab → Database backup → **Run workflow** to confirm it works
   without waiting for the overnight run.

## What gets dumped

| File | Contents |
|---|---|
| `public.sql.gz` | Full schema and data for everything the app owns |
| `auth-users.sql.gz` | Rows only, from `auth.users` and `auth.identities` |

`auth` is dumped data-only on purpose. A fresh Supabase project builds the auth
schema itself, so its structure is never what you want to restore — the user
rows are.

Neither file contains `DROP` statements. A dump full of `DROP TABLE` sitting in
an artifact is a loaded gun.

## Restoring

Download the artifact from the workflow run, then:

```bash
gpg --decrypt public.sql.gz.gpg > public.sql.gz   # only if encrypted
gunzip public.sql.gz auth-users.sql.gz
```

Into a **fresh** Supabase project:

```bash
psql "$NEW_DB_URL" -f public.sql
psql "$NEW_DB_URL" -f auth-users.sql
```

Then re-point `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` in Vercel at the new project and redeploy.

Restoring `auth-users.sql` into a project that already has users will collide
on primary keys. That is the correct behaviour — it stops you silently
half-merging two user tables. For a partial restore, edit the file down to the
rows you need.

## Do the drill

A backup nobody has restored is a guess. Once, spin up a throwaway Supabase
project, restore into it, and sign in. Twenty minutes now beats finding out
during an actual outage.

## When to stop using this

Supabase Pro ($25/mo) gives 7 days of managed daily backups and PITR as an
add-on. The moment this project earns money, that is the better answer and this
workflow becomes a belt-and-braces second copy rather than the only one.

## Scheduled workflows go dormant

GitHub disables `schedule` triggers on repositories with no activity for 60
days. If commits stop for two months, backups stop too — silently. Re-enable
from the Actions tab.
