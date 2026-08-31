// Reports which migrations the live database has not seen. Read-only: it opens
// a connection, runs one select against public.schema_migrations, and prints.
// It writes nothing, ever — applying migrations stays a thing a human does in
// the Supabase SQL editor.
//
//   SUPABASE_DB_URL='postgresql://...' npm run db:pending
//
// Why this exists. scripts/migrate.mjs replays every migration from zero, so it
// proves the schema can be rebuilt but says nothing about the database actually
// serving the app — that one has had files pasted into it by hand, one at a
// time, over months. The only record of what landed is the ledger each
// migration writes in its last block, and until now nothing read it back. A
// file that never got pasted looked exactly like a file that did. 0026 was
// applied but never recorded and went unnoticed for months; this is the command
// that would have said so in two seconds.
//
// Exit code is 0 when the database matches the repository and 1 when it does
// not, so it can gate a deploy without anyone reading the output.

import { readdirSync } from 'node:fs'
import pg from 'pg'
import { diffLedger } from './lib/ledger.mjs'

const MIGRATIONS = new URL('../supabase/migrations/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
if (!url) {
  console.error(`SUPABASE_DB_URL is not set.

  Supabase Dashboard > Connect > Session pooler > copy the URI, then:
    SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@aws-...pooler.supabase.com:5432/postgres' npm run db:pending

  Nothing is written to this database. The connection is used for one select.`)
  process.exit(2)
}

// The dashboard hands the URI over with the password still written as a
// bracketed placeholder, and every set of instructions writes it in angle
// brackets. Neither character is legal in a URI, so either one always means a
// placeholder survived the paste — worth catching here rather than as an
// authentication failure that reads like a wrong password.
if (/[[\]<>]/.test(url)) {
  console.error('The connection string still contains a placeholder — anything in [ ] or < > is a description, not a value. Paste the real URI from Supabase > Connect.')
  process.exit(2)
}

const host = (() => { try { return new URL(url).hostname } catch { return '' } })()
const local = host === 'localhost' || host === '127.0.0.1'

const client = new pg.Client({
  connectionString: url,
  // TLS is verified. The password to this database travels over this link, so
  // turning verification off to make a connection error go away would be
  // trading the whole point of the encryption for a shorter afternoon.
  ssl: !local,
  connectionTimeoutMillis: 15000,
})

try {
  await client.connect()
} catch (e) {
  if (/self-signed|unable to verify|certificate/i.test(e.message)) {
    console.error(`TLS verification failed: ${e.message}

  Do not disable verification. Download the project's certificate
  (Supabase > Project Settings > Database > SSL configuration) and let Node
  trust it — NODE_EXTRA_CA_CERTS is built in and needs no code here:
    NODE_EXTRA_CA_CERTS=/path/to/prod-ca.crt npm run db:pending`)
    process.exit(2)
  }
  throw e
}

let recorded
try {
  const { rows } = await client.query('select version from public.schema_migrations order by version')
  recorded = rows.map(r => r.version)
} catch (e) {
  if (e.code === '42P01') {
    console.error('This database has no public.schema_migrations table, so it has never had 0000_schema_migrations.sql applied. Either it is the wrong database, or it predates the ledger.')
    process.exit(1)
  }
  throw e
} finally {
  await client.end()
}

const { versions, pending, drift, gaps } = diffLedger(readdirSync(MIGRATIONS), recorded)

console.log(`${host || 'database'}\n${versions.length} migrations on disk, ${recorded.length} recorded in the database.\n`)

if (pending.length) {
  console.log(`pending — written here, never applied there:\n  ${pending.join('\n  ')}\n`)
  console.log('  Apply them in this order, in the Supabase SQL editor, one file at a time.\n')
}

if (drift.length) {
  console.log(`drift — recorded there, no file here:\n  ${drift.join('\n  ')}\n`)
  console.log('  The database holds a change this repository cannot reproduce. Find out what it was\n  and write it as a migration before the next rebuild needs it.\n')
}

if (gaps.length) {
  console.log(`out of order — pending, but older than something already applied:\n  ${gaps.join('\n  ')}\n`)
  console.log('  These were skipped rather than not yet reached. Read them before applying:\n  they were written against an earlier schema than the one they would now run on.\n')
}

if (!pending.length && !drift.length) {
  console.log('In sync. Every migration in the repository is recorded in the database.')
  process.exit(0)
}

process.exit(1)
