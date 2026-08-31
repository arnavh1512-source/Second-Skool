// One centre trying to read and write another centre's children.
//
// Every table in this schema is scoped by a policy of the same shape —
// `is_staff() and centre_id = current_centre()` — and that shape has never been
// tested, only read. These tests build two real centres and then have the head
// of the second one do, deliberately, everything a bug or a crafted request
// could make the app do by accident.
//
// Two denials matter and they are not the same thing. RLS filtering rows to
// nothing is silent: a select returns zero rows and an update reports zero rows
// affected, with no error. A missing grant or a `with check` violation raises.
// Each test says which it expects, because a table with no policy at all also
// returns zero rows to a query that happens to match nothing.

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { DB_URL, act, denied, owner, seedCentre, type Centre } from './harness'

const suite = DB_URL ? describe : describe.skip

suite('tenant isolation', () => {
  let c: pg.Client
  let a: Centre
  let b: Centre

  beforeAll(async () => {
    c = await owner()
    a = await seedCentre(c, 'Alpha')
    b = await seedCentre(c, 'Beta')
  }, 60_000)

  afterAll(async () => { await c?.end() })

  // ── the roster ─────────────────────────────────────────────────────────────

  it("another centre's head cannot see the roster", async () => {
    const rows = await act(c, { uid: b.head }, async q =>
      (await q('select id from public.students where centre_id = $1', [a.id])).rows)
    expect(rows).toHaveLength(0)
  })

  it("another centre's head cannot rename a student", async () => {
    const n = await act(c, { uid: b.head }, async q =>
      (await q('update public.students set name = $1 where id = $2', ['Renamed', a.students[0].id])).rowCount)
    expect(n).toBe(0)
  })

  it("another centre's head cannot delete a student", async () => {
    const n = await act(c, { uid: b.head }, async q =>
      (await q('delete from public.students where id = $1', [a.students[0].id])).rowCount)
    expect(n).toBe(0)
  })

  it('a head cannot write a row into another centre', async () => {
    // Not silent: the row is well formed and the insert is allowed, so what
    // stops it is the policy's `with check` clause rejecting the centre_id.
    const msg = await denied(() => act(c, { uid: b.head }, q =>
      q(`insert into public.attendance (student_id, date, status, centre_id)
         values ($1, current_date - 1, 'Present', $2)`, [a.students[0].id, a.id])))
    expect(msg).toMatch(/row-level security/i)
  })

  // ── everything hanging off the roster ──────────────────────────────────────

  // Only tables seedCentre actually fills. A table with no rows in it passes
  // this test whether or not it has a policy, which is worse than no test.
  const scoped = ['fees', 'attendance', 'notifications'] as const
  for (const table of scoped) {
    it(`another centre's ${table} are invisible`, async () => {
      const rows = await act(c, { uid: b.head }, async q =>
        (await q(`select 1 from public.${table} where centre_id = $1`, [a.id])).rows)
      expect(rows).toHaveLength(0)
    })
  }

  it('the seeded rows really are there, so the emptiness above means something', async () => {
    // Guards against the whole file passing because seedCentre silently wrote
    // nothing. Read as the owner, who bypasses RLS.
    const { rows } = await c.query(
      `select (select count(*) from public.students     where centre_id = $1) as students,
              (select count(*) from public.fees         where centre_id = $1) as fees,
              (select count(*) from public.attendance   where centre_id = $1) as attendance,
              (select count(*) from public.notifications where centre_id = $1) as notifications`, [a.id])
    expect(rows[0]).toEqual({ students: '2', fees: '2', attendance: '2', notifications: '2' })
  })

  // ── the centre row itself ──────────────────────────────────────────────────

  it("a head cannot read another centre's row, join codes included", async () => {
    const rows = await act(c, { uid: b.head }, async q =>
      (await q('select join_code from public.centres where id = $1', [a.id])).rows)
    expect(rows).toHaveLength(0)
  })

  it("a head cannot rename another centre", async () => {
    const n = await act(c, { uid: b.head }, async q =>
      (await q('update public.centres set name = $1 where id = $2', ['Stolen', a.id])).rowCount)
    expect(n).toBe(0)
  })

  it('a head cannot change their own join code', async () => {
    // The column grant, not a policy: rotating a join code is regenerate-only,
    // and a head who could set it by hand could set it to another centre's.
    const msg = await denied(() => act(c, { uid: b.head }, q =>
      q('update public.centres set join_code = $1 where id = $2', ['STOLEN0000', b.id])))
    expect(msg).toMatch(/permission denied/i)
  })

  // ── people ─────────────────────────────────────────────────────────────────

  it("a head cannot read another centre's staff profiles", async () => {
    const rows = await act(c, { uid: b.head }, async q =>
      (await q('select id from public.profiles where id = $1', [a.head])).rows)
    expect(rows).toHaveLength(0)
  })

  it('a teacher cannot promote themselves to head', async () => {
    const msg = await denied(() => act(c, { uid: b.teacher }, q =>
      q(`update public.profiles set role = 'admin' where id = $1`, [b.teacher])))
    expect(msg).toMatch(/permission denied/i)
  })

  it('a teacher cannot move themselves into another centre', async () => {
    const msg = await denied(() => act(c, { uid: b.teacher }, q =>
      q('update public.profiles set centre_id = $1 where id = $2', [a.id, b.teacher])))
    expect(msg).toMatch(/permission denied/i)
  })

  it('a teacher cannot edit fees — reading them is the whole of it', async () => {
    const seen = await act(c, { uid: b.teacher }, async q =>
      (await q('select id from public.fees where centre_id = $1', [b.id])).rows)
    expect(seen.length).toBeGreaterThan(0)

    const n = await act(c, { uid: b.teacher }, async q =>
      (await q(`update public.fees set status = 'Paid' where centre_id = $1`, [b.id])).rowCount)
    expect(n).toBe(0)
  })

  // ── the two roles with nothing ─────────────────────────────────────────────

  const tables = ['students', 'fees', 'attendance', 'results', 'notifications',
                  'centres', 'teachers', 'branches', 'subjects', 'timetable'] as const

  for (const table of tables) {
    it(`anon sees nothing in ${table}`, async () => {
      const rows = await act(c, { role: 'anon' }, async q =>
        (await q(`select 1 from public.${table}`)).rows)
      expect(rows).toHaveLength(0)
    })

    it(`a signed-in account with no centre sees nothing in ${table}`, async () => {
      const rows = await act(c, { uid: a.outsider }, async q =>
        (await q(`select 1 from public.${table}`)).rows)
      expect(rows).toHaveLength(0)
    })
  }
})
