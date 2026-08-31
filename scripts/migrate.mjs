// Applies supabase/test/bootstrap.sql and then every migration, in filename
// order, to the database in DATABASE_URL. It exists for one reason: nothing
// else ever runs these files from zero. The Supabase project has had them
// applied one at a time over months, in an order history rather than the
// filenames decide, on top of state that no longer exists. A migration that
// only works because of what happened to be in the database when it was pasted
// looks identical to one that works — until the day a second centre needs its
// own project, or this one has to be rebuilt from the backup.
//
// So this is the fresh-database test. `node scripts/migrate.mjs` against an
// empty Postgres either replays the whole schema or names the file that broke.
//
// It is also the setup step for the RLS suite, which needs a real database
// with the real policies on it.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const MIGRATIONS = new URL('../supabase/migrations/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const BOOTSTRAP = new URL('../supabase/test/bootstrap.sql', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Point it at a throwaway Postgres — this script is destructive by nature and must never see production.')
  process.exit(1)
}

const files = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()

const client = new pg.Client({ connectionString: url })
await client.connect()

try {
  await client.query(readFileSync(BOOTSTRAP, 'utf8'))
  console.log('bootstrap  ok')

  for (const f of files) {
    // One query() call per file is one implicit transaction, so a file that
    // fails half way leaves nothing behind and the error names it exactly.
    try {
      await client.query(readFileSync(join(MIGRATIONS, f), 'utf8'))
      console.log(`${f}  ok`)
    } catch (e) {
      console.error(`\n${f}  FAILED\n  ${e.message}${e.hint ? `\n  hint: ${e.hint}` : ''}${e.where ? `\n  at: ${e.where}` : ''}`)
      process.exit(1)
    }
  }

  // Every file is supposed to record itself in the last block. A file that
  // forgets leaves a database whose ledger disagrees with its own schema,
  // which is what happened to 0026 and went unnoticed for months.
  const { rows } = await client.query('select version from public.schema_migrations order by version')
  const recorded = new Set(rows.map(r => r.version))
  const missing = files.map(f => f.replace(/\.sql$/, '')).filter(v => !recorded.has(v))
  if (missing.length) {
    console.error(`\nApplied but never recorded in schema_migrations:\n  ${missing.join('\n  ')}`)
    process.exit(1)
  }

  console.log(`\n${files.length} migrations applied and recorded.`)
} finally {
  await client.end()
}
