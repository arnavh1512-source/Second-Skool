import { describe, it, expect } from 'vitest'
// The JSDoc on diffLedger is what gives this import its types: allowJs resolves
// the .mjs, and the annotations there are the only thing standing between this
// test and `any`.
import { diffLedger } from '../scripts/lib/ledger.mjs'

// `npm run db:pending` compares the migration files in this repository against
// the versions the live database recorded in public.schema_migrations. The
// comparison itself lives in scripts/lib/ledger.mjs with no I/O in it, which is
// the half worth pinning down: the failure it exists to catch (0026 applied but
// never recorded) went unnoticed for months precisely because nobody was
// checking, so the check had better be right.

const files = ['0000_a.sql', '0001_b.sql', '0002_c.sql', 'README.md']

describe('diffLedger', () => {
  it('reports nothing when the database matches the repository', () => {
    const { pending, drift, gaps } = diffLedger(files, ['0000_a', '0001_b', '0002_c'])
    expect(pending).toEqual([])
    expect(drift).toEqual([])
    expect(gaps).toEqual([])
  })

  it('ignores anything that is not a .sql file', () => {
    expect(diffLedger(files, []).versions).toEqual(['0000_a', '0001_b', '0002_c'])
  })

  it('lists the files that were written here but never applied there', () => {
    const { pending, gaps } = diffLedger(files, ['0000_a'])
    expect(pending).toEqual(['0001_b', '0002_c'])
    // Not gaps: these are simply the ones not reached yet.
    expect(gaps).toEqual([])
  })

  it('lists a version recorded in the database that has no file here', () => {
    // Someone ran SQL by hand, or a file was renamed after it shipped. Either
    // way the database holds a change this repository cannot reproduce.
    const { drift, pending } = diffLedger(files, ['0000_a', '0001_b', '0002_c', '0009_by_hand'])
    expect(drift).toEqual(['0009_by_hand'])
    expect(pending).toEqual([])
  })

  it('calls out a pending file older than something already applied', () => {
    // 0001 was skipped rather than not yet reached: applying it now runs it
    // against a schema later than the one it was written for.
    const { pending, gaps } = diffLedger(files, ['0000_a', '0002_c'])
    expect(pending).toEqual(['0001_b'])
    expect(gaps).toEqual(['0001_b'])
  })

  it('finds no gaps when the database is empty', () => {
    const { pending, gaps } = diffLedger(files, [])
    expect(pending).toEqual(['0000_a', '0001_b', '0002_c'])
    expect(gaps).toEqual([])
  })

  it('does not care what order the database returned its rows in', () => {
    const { drift } = diffLedger(['0001_b.sql'], ['0009_z', '0000_a'])
    expect(drift).toEqual(['0000_a', '0009_z'])
  })
})
