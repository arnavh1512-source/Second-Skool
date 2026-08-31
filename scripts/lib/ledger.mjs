// The pure half of `npm run db:pending`: given the migration filenames on disk
// and the versions the database says it has applied, work out how the two
// disagree. No I/O here on purpose — this is the part worth a unit test, and
// tests/migration-ledger.test.ts is that test.
//
// A version is a filename with the .sql taken off, which is exactly the string
// every migration writes into public.schema_migrations in its last block.

/**
 * @param {string[]} files    filenames from supabase/migrations, e.g. ['0000_x.sql']
 * @param {string[]} recorded versions from public.schema_migrations
 * @returns {{ versions: string[], pending: string[], drift: string[], gaps: string[] }}
 */
export function diffLedger(files, recorded) {
  const versions = files
    .filter(f => f.endsWith('.sql'))
    .map(f => f.replace(/\.sql$/, ''))
    .sort()

  const onDisk = new Set(versions)
  const applied = new Set(recorded)

  // Written here, never applied there. The ordinary case: files you have
  // committed since the last time you pasted SQL into the editor.
  const pending = versions.filter(v => !applied.has(v))

  // Applied there, no file here. Someone ran SQL by hand and it never became a
  // migration, or a file was renamed after it shipped. Either way the database
  // holds a change this repository cannot reproduce, which is the failure that
  // a rebuild from backup discovers far too late.
  const drift = recorded.filter(v => !onDisk.has(v)).sort()

  // A pending file that sorts *before* something already applied. Migrations
  // are meant to go on in filename order, so this means one was skipped rather
  // than simply not reached yet — applying it now runs it against a schema
  // later than the one it was written for.
  const newestApplied = versions.filter(v => applied.has(v)).pop()
  const gaps = newestApplied ? pending.filter(v => v < newestApplied) : []

  return { versions, pending, drift, gaps }
}
