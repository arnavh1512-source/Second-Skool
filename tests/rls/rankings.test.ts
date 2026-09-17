// A student sees a ranking of their own class, and nobody else's.
//
// 0045 scoped get_student_snapshot's rankings to the student's class. The UI
// splits staff boards by class too, but a student has no filter to pick: the
// server hands over one list and the phone renders it. So the only place that
// stops a Class 9 child seeing Class 10 names and scores is the where clause,
// and this pins it down against a real database.

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { DB_URL, act, owner, seedCentre, type Centre } from './harness'

const suite = DB_URL ? describe : describe.skip

suite('student rankings', () => {
  let c: pg.Client
  let a: Centre
  let junior: { id: string; code: string }

  beforeAll(async () => {
    c = await owner()
    a = await seedCentre(c, 'Ranker')

    const signup = await act(c, { role: 'anon', commit: true }, async q =>
      (await q('select public.student_signup($1,$2,$3,$4,$5) as r',
        [a.studentJoinCode, 'Ranker Junior', '9000000001', '9', 'Test School'])).rows[0].r)
    const row = await c.query('select id, student_code from public.students where student_code = $1', [signup.code])
    junior = { id: row.rows[0].id, code: row.rows[0].student_code }

    // Both classes are marked in the same subject, which is the case that
    // leaked before 0045: one subject key, everyone in the centre under it.
    await act(c, { uid: a.head, commit: true }, async q => {
      await q('select public.approve_student($1,$2,$3,$4,$5)', [junior.id, '9', null, 1000, null])
      const subject = (await q(`insert into public.subjects (name) values ('Maths') returning id`)).rows[0].id
      const senior = (await q(`insert into public.tests (name, subject_id, class, max_marks) values ('Unit 1', $1, '10', 50) returning id`, [subject])).rows[0].id
      const juniorTest = (await q(`insert into public.tests (name, subject_id, class, max_marks) values ('Unit 1', $1, '9', 50) returning id`, [subject])).rows[0].id
      for (const s of a.students) await q('insert into public.results (test_id, student_id, marks) values ($1,$2,40)', [senior, s.id])
      await q('insert into public.results (test_id, student_id, marks) values ($1,$2,30)', [juniorTest, junior.id])
    })
  }, 60_000)

  afterAll(async () => { await c?.end() })

  const rankings = (cred: string) =>
    act(c, { role: 'anon' }, async q =>
      (await q('select public.get_student_snapshot($1) as r', [cred])).rows[0].r.rankings)

  it('a Class 9 student receives no Class 10 rows', async () => {
    const board = await rankings(junior.code)
    expect(board.Maths.map((r: { id: string }) => r.id)).toEqual([junior.id])
  })

  it('a Class 10 student receives no Class 9 rows', async () => {
    const board = await rankings(a.students[0].code)
    const ids = board.Maths.map((r: { id: string }) => r.id)
    expect(ids).not.toContain(junior.id)
    expect(ids.sort()).toEqual(a.students.map(s => s.id).sort())
  })
})
