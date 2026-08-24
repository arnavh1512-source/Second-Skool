import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CENTRE_DELETE_EXEMPT, LEAF_TABLES, SPINE_TABLES } from '../app/lib/centre-tables'

// Every table that references centres(id) has to be cleared before the centre
// row can go, because none of those FKs cascade. The delete list is hand-written
// and the schema is not, so the two drift silently: `batches` landed in
// migration 0006 and was never added, and Postgres refused the parent with
// "violates foreign key constraint batches_centre_id_fkey". The operator console
// reported the centre wiped but not removed, and it could not be retried away.
// This test is the thing that would have caught it.

const MIGRATIONS = join(__dirname, '..', 'supabase', 'migrations')

const readAllTables = (): Set<string> => {
  const found = new Set<string>()
  for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort())
    for (const m of readFileSync(join(MIGRATIONS, file), 'utf8')
      .matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/gi))
      found.add(m[1].toLowerCase())
  return found
}

// Matches both shapes the migrations use to attach a table to a centre:
//   create table ... ( ... centre_id uuid references public.centres(id) ... )
//   alter table public.x add column ... centre_id uuid references public.centres(id)
const readCentreScopedTables = (): Set<string> => {
  const found = new Set<string>()
  for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8')

    for (const m of sql.matchAll(/alter\s+table\s+(?:only\s+)?(?:public\.)?(\w+)[\s\S]{0,400}?centre_id[\s\S]{0,160}?references\s+(?:public\.)?centres\s*\(/gi))
      found.add(m[1].toLowerCase())

    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\s*\)\s*;/gi))
      if (/centre_id[^,\n]*references\s+(?:public\.)?centres\s*\(/i.test(m[2])) found.add(m[1].toLowerCase())
  }
  return found
}

describe('centre delete covers every centre-scoped table', () => {
  const scoped = readCentreScopedTables()
  const handled = new Set<string>([...LEAF_TABLES, ...SPINE_TABLES, ...CENTRE_DELETE_EXEMPT])

  it('finds the centre-scoped tables in the migrations at all', () => {
    // Guards the regexes themselves: a parser that silently matched nothing
    // would make every assertion below pass while checking nothing.
    expect(scoped.size).toBeGreaterThan(10)
    expect(scoped.has('students')).toBe(true)
    expect(scoped.has('batches')).toBe(true)
  })

  it('leaves no centre-scoped table unaccounted for', () => {
    expect([...scoped].filter(t => !handled.has(t)).sort()).toEqual([])
  })

  it('lists no table that is not in the schema', () => {
    // The other direction: a mistyped or dropped table name would make the
    // delete loop fail on every single run. Checked against every table the
    // migrations create, not against `scoped` — push_subscriptions carries a
    // bare centre_id with no FK, so it is centre-scoped in fact but invisible
    // to the constraint scan.
    const all = readAllTables()
    expect([...LEAF_TABLES, ...SPINE_TABLES].filter(t => !all.has(t)).sort()).toEqual([])
  })

  it('deletes leaves before the spine', () => {
    // attendance and attendance_monthly point at students; results point at
    // tests; timetable points at teachers. Order is what makes the delete work.
    const order: string[] = [...LEAF_TABLES, ...SPINE_TABLES]
    expect(order.indexOf('attendance')).toBeLessThan(order.indexOf('students'))
    expect(order.indexOf('attendance_monthly')).toBeLessThan(order.indexOf('students'))
    expect(order.indexOf('results')).toBeLessThan(order.indexOf('tests'))
    expect(order.indexOf('timetable')).toBeLessThan(order.indexOf('teachers'))
  })

  it('never deletes profiles', () => {
    // Erasing a centre must not erase the people who were in it — they are
    // detached instead, which is also what gives the head a way back in.
    expect([...LEAF_TABLES, ...SPINE_TABLES]).not.toContain('profiles')
  })
})
