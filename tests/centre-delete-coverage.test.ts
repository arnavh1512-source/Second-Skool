import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACTIVITY_TABLES, CENTRE_DELETE_EXEMPT, LEAF_TABLES, NOT_ACTIVITY, SPINE_TABLES } from '../app/lib/centre-tables'

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

// The same drift, one screen over. ACTIVITY_TABLES decides which centres the
// console reports as "never used", and never-used is the prompt to delete one.
// fees, meetings and timetable were all missing from it, so a teacher who
// collected fees and built a timetable but had not yet marked attendance was
// listed as having never touched the app.
describe('activity detection covers every table that records work', () => {
  const scoped = readCentreScopedTables()
  const classified = new Set<string>([...ACTIVITY_TABLES, ...NOT_ACTIVITY, ...CENTRE_DELETE_EXEMPT])

  it('classifies every centre-scoped table as activity or not', () => {
    expect([...scoped].filter(t => !classified.has(t)).sort()).toEqual([])
  })

  it('counts the tables a teacher fills in by hand', () => {
    // Each of these is a deliberate action by a person. If any stops counting,
    // a live centre starts looking abandoned.
    for (const t of ['attendance', 'results', 'assignments', 'fees', 'meetings', 'timetable', 'notes', 'reminders', 'tests'])
      expect(ACTIVITY_TABLES).toContain(t)
  })

  it('never counts a table as both activity and not', () => {
    expect([...ACTIVITY_TABLES].filter(t => ([...NOT_ACTIVITY] as string[]).includes(t))).toEqual([])
  })

  it('only counts tables that are actually deleted with the centre', () => {
    // An activity table outside the delete lists would leave rows behind that
    // keep a deleted centre looking active.
    const deleted = new Set<string>([...LEAF_TABLES, ...SPINE_TABLES])
    expect([...ACTIVITY_TABLES].filter(t => !deleted.has(t)).sort()).toEqual([])
  })
})
