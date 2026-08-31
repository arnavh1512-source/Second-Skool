// save_attendance(), which exists because both attendance paths used to read
// the register and then write it in two separate round trips.
//
// The live save's cost was a wrong sentence: two teachers marking the same
// class in the same minute both saw an empty register, both wrote, and both
// were told "Attendance saved" while the second silently replaced the first.
// The queue drain's cost was the register itself — its rule is "a queued mark
// writes only where nothing is there yet", it was enforced in the browser
// against a list read a round trip earlier, and it was then written with an
// upsert that UPDATES on conflict. A row landing in that gap was overwritten by
// a stale offline mark, and a stale Absent pushes a parent a message about a
// child who was in class.
//
// So the tests that matter here are not "does it insert" but "what happens to
// the second caller". One of them holds a real lock on a second connection.

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { DB_URL, act, denied, owner, seedCentre, type Centre } from './harness'

const suite = DB_URL ? describe : describe.skip

type Saved = { written: number; existing: { student_id: string; status: string }[] }

suite('save_attendance', () => {
  let c: pg.Client
  let a: Centre
  let b: Centre

  beforeAll(async () => {
    c = await owner()
    a = await seedCentre(c, 'Theta')
    b = await seedCentre(c, 'Iota')
  }, 60_000)

  afterAll(async () => { await c?.end() })

  /** One call as a member of a centre, rolled back with everything it wrote. */
  const save = (
    who: string,
    marks: { student_id: string; status: string }[],
    overwrite: boolean,
    day = '2026-08-20',
  ): Promise<Saved> =>
    act(c, { uid: who }, async q =>
      (await q('select public.save_attendance($1,$2,$3) as r',
        [day, JSON.stringify(marks), overwrite])).rows[0].r)

  const marksFor = (status: string) => a.students.map(s => ({ student_id: s.id, status }))

  it('writes the whole class when the register is empty', async () => {
    expect(await save(a.teacher, marksFor('Present'), false)).toEqual({ written: 2, existing: [] })
  })

  it('a stale queued mark cannot overwrite one somebody else already made', async () => {
    // The drain's whole rule, now enforced where the row lock is rather than in
    // a browser holding a list that is one round trip out of date.
    const out = await act(c, { uid: a.head }, async q => {
      await q(`insert into public.attendance (student_id, date, status)
               values ($1, '2026-08-20', 'Present')`, [a.students[0].id])
      const r = (await q('select public.save_attendance($1,$2,$3) as r',
        ['2026-08-20', JSON.stringify(marksFor('Absent')), false])).rows[0].r as Saved
      const kept = (await q(
        `select status from public.attendance where student_id = $1 and date = '2026-08-20'`,
        [a.students[0].id])).rows[0].status
      return { r, kept }
    })

    // Only the child nobody had answered for was written, and the disputed one
    // comes back carrying the status that beat it — which is exactly what the
    // teacher is shown in the conflict list.
    expect(out.r.written).toBe(1)
    expect(out.r.existing).toEqual([{ student_id: a.students[0].id, status: 'Present' }])
    expect(out.kept).toBe('Present')
  })

  it('the live save overwrites, and still says what was there', async () => {
    // She is looking at the class right now, so the newest mark is the true
    // one — but the screen must still be able to say "today was already
    // marked" rather than reporting a clean save over somebody else's work.
    const out = await act(c, { uid: a.head }, async q => {
      await q(`insert into public.attendance (student_id, date, status)
               values ($1, '2026-08-20', 'Present')`, [a.students[0].id])
      const r = (await q('select public.save_attendance($1,$2,$3) as r',
        ['2026-08-20', JSON.stringify(marksFor('Absent')), true])).rows[0].r as Saved
      const now = (await q(
        `select status from public.attendance where student_id = $1 and date = '2026-08-20'`,
        [a.students[0].id])).rows[0].status
      return { r, now }
    })

    expect(out.r.written).toBe(2)
    expect(out.r.existing.map(e => e.student_id)).toEqual([a.students[0].id])
    expect(out.now).toBe('Absent')
  })

  it('the same child twice in one save is a correction, not an error', async () => {
    // Postgres refuses to let ON CONFLICT touch a row twice in one statement,
    // so a duplicated student_id would abort the whole register with a message
    // no teacher could act on. The later mark is the correction and wins.
    const id = a.students[0].id
    const out = await act(c, { uid: a.head }, async q => {
      const r = (await q('select public.save_attendance($1,$2,$3) as r', ['2026-08-20', JSON.stringify([
        { student_id: id, status: 'Present' },
        { student_id: id, status: 'Absent' },
      ]), false])).rows[0].r as Saved
      const kept = (await q(
        `select status from public.attendance where student_id = $1 and date = '2026-08-20'`,
        [id])).rows[0].status
      return { r, kept }
    })
    expect(out.r.written).toBe(1)
    expect(out.kept).toBe('Absent')
  })

  it('a second caller waits for the first rather than racing past it', async () => {
    // The reason the fix is a single statement and not a tidier two. A row
    // written and not yet committed is invisible to a SELECT, so the old code
    // read an empty register and then overwrote a mark that was already being
    // made. ON CONFLICT DO UPDATE takes the row lock instead: the second caller
    // blocks until the first one is finished rather than reading around it.
    const other = new pg.Client({ connectionString: DB_URL })
    await other.connect()
    try {
      await c.query('begin')
      await c.query(`insert into public.attendance (student_id, date, status)
                     values ($1, '2026-08-19', 'Present')`, [a.students[0].id])

      await other.query('begin')
      await other.query(`set local statement_timeout = '1500ms'`)
      const msg = await denied(() => other.query('select public.save_attendance($1,$2,$3)',
        ['2026-08-19', JSON.stringify([{ student_id: a.students[0].id, status: 'Absent' }]), false]))
      expect(msg).toMatch(/statement timeout/i)
      await other.query('rollback')
    } finally {
      await c.query('rollback')
      await other.end()
    }
  })

  it('a teacher cannot mark a child at another centre', async () => {
    // SECURITY INVOKER on purpose: attendance_staff still decides who may
    // write, exactly as it did when the client wrote the rows itself.
    const msg = await denied(() => save(b.teacher, marksFor('Present'), false))
    expect(msg).toMatch(/row-level security|permission denied/i)
  })

  it('refuses a register for a class that has not happened yet', async () => {
    const msg = await denied(() => save(a.teacher, marksFor('Present'), false, '2099-01-01'))
    expect(msg).toMatch(/already happened/i)
  })

  it('refuses a save with nothing in it', async () => {
    expect(await denied(() => save(a.teacher, [], false))).toMatch(/no marks/i)
  })

  it('is not a function anon may call', async () => {
    // Students have no session at all and never mark a register.
    const msg = await denied(() => act(c, { role: 'anon' }, q =>
      q('select public.save_attendance($1,$2,$3)',
        ['2026-08-20', JSON.stringify(marksFor('Present')), false])))
    expect(msg).toMatch(/permission denied/i)
  })
})
