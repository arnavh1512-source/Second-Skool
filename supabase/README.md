# Database

The database is defined by the numbered files in `migrations/`. They are the
only source of truth — there is no separate "current schema" file to keep in
sync, and no loose patches to remember the order of.

```
supabase/
  migrations/
    0000_schema_migrations.sql   ledger table (run first, always)
    0001_baseline.sql            the whole schema as of 2026-07-04
    0002_… → 0014_…              one change each, in the order they happened
  adopt-existing-database.sql    one-time, for the current production project
  tests/secure-code.test.sql     student-code lockout regression test
```

## Running them

Everything runs through the Supabase Dashboard → SQL Editor. Paste one file,
run it, move to the next.

**Fresh project** (new environment, a clone for testing, a new customer):

1. `migrations/0000_schema_migrations.sql`
2. `migrations/0001_baseline.sql`
3. every remaining file in numeric order

**The existing production project** — it already has 0001–0014 in it, so
re-running them is pointless work and needless risk:

1. `migrations/0000_schema_migrations.sql`
2. `adopt-existing-database.sql`

After that both databases are in the same place: the ledger knows what has run.

## Which migrations are still outstanding

```sql
select version from public.schema_migrations order by version;
```

Compare that list against the filenames in `migrations/`. Anything in the
directory but not in the table has not been applied yet.

## Adding a new migration

1. Create `migrations/00NN_short_name.sql` with the next number. Never edit or
   renumber a file that has already been applied anywhere — write a new one.
2. Make it idempotent (`create table if not exists`, `create or replace
   function`, `drop policy if exists` before `create policy`). A migration that
   cannot survive being run twice will eventually be run twice.
3. End it with the ledger block, matching the filename exactly:

   ```sql
   insert into public.schema_migrations (version) values ('00NN_short_name')
     on conflict (version) do nothing;
   ```

4. New tables need `enable row level security` plus policies scoped with
   `centre_id = public.current_centre()`. A table without RLS is a cross-tenant
   data leak, not a missing nice-to-have.

## Why the old files are gone

`schema.sql`, `multitenancy.sql`, `period-and-rollup.sql`,
`security-hardening.sql`, `rate-limit.sql` and `notes.sql` were folded into
`0001_baseline.sql` back when it was written as the consolidated schema — it
said so in its own header. Keeping both copies meant two descriptions of the
same tables drifting apart. They are in git history if they are ever needed.
