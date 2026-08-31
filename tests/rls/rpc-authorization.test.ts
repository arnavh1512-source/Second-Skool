// The functions, rather than the tables.
//
// Half of this schema's writes go through RPCs, and the two kinds of function
// in it fail in opposite directions. A SECURITY INVOKER function runs as the
// caller, so RLS still applies and a cross-centre call finds nothing to act on
// — it reports zero rows and says nothing. A SECURITY DEFINER function runs as
// its owner with RLS switched off, so the only thing between it and every
// centre's data is the is_head() / is_staff() check written at the top of the
// body; there, silence would be the bug and an exception is the pass.
//
// These tests pin down which is which, function by function.

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { DB_URL, act, denied, owner, seedCentre, type Centre } from './harness'

const suite = DB_URL ? describe : describe.skip

suite('rpc authorization', () => {
  let c: pg.Client
  let a: Centre
  let b: Centre

  beforeAll(async () => {
    c = await owner()
    a = await seedCentre(c, 'Gamma')
    b = await seedCentre(c, 'Delta')
  }, 60_000)

  afterAll(async () => { await c?.end() })

  const call = (uid: string, sql: string, params: unknown[]) =>
    act(c, { uid }, async q => (await q(sql, params)).rows[0].r)

  // ── the fee writes: SECURITY INVOKER, so RLS is the boundary ───────────────

  it("mark_fees_paid finds nothing when aimed at another centre's student", async () => {
    const r = await call(b.head, 'select public.mark_fees_paid($1) as r', [a.students[0].id])
    expect(r).toEqual({ student: 0, fees: 0 })
  })

  it("reopen_fees_today finds nothing when aimed at another centre's student", async () => {
    const r = await call(b.head, 'select public.reopen_fees_today($1) as r', [a.students[0].id])
    // Since 0034 the settled badge comes back with the row counts, and it is
    // null here because nothing was settled: the student could not be locked.
    expect(r).toEqual({ student: 0, fees: 0, status: null })
  })

  it("sync_fee_status finds nothing when aimed at another centre's student", async () => {
    const r = await call(b.head, 'select public.sync_fee_status($1) as r', [a.students[0].id])
    expect(r).toEqual({ student: 0, status: null })
  })

  it("the other centre's fee is still Due after all three", async () => {
    const { rows } = await c.query('select status from public.fees where student_id = $1', [a.students[0].id])
    expect(rows.map(r => r.status)).toEqual(['Due'])
  })

  it('the same call works for the head who owns the student', async () => {
    // The mirror image, and the reason the three above prove anything: the
    // function is not simply broken for everyone.
    const r = await act(c, { uid: a.head }, async q =>
      (await q('select public.mark_fees_paid($1) as r', [a.students[0].id])).rows[0].r)
    expect(r).toEqual({ student: 1, fees: 1 })
  })

  it('students cannot execute the fee functions at all', async () => {
    const msg = await denied(() => act(c, { role: 'anon' }, q =>
      q('select public.mark_fees_paid($1)', [a.students[0].id])))
    expect(msg).toMatch(/permission denied/i)
  })

  // ── the staff writes: SECURITY DEFINER, so the check in the body is it ─────

  it('approve_student refuses an account that is not staff', async () => {
    const msg = await denied(() => act(c, { uid: a.outsider }, q =>
      q('select public.approve_student($1)', [a.students[0].id])))
    expect(msg).toMatch(/not authorized/i)
  })

  it('approve_teacher refuses a teacher', async () => {
    const msg = await denied(() => act(c, { uid: b.teacher }, q =>
      q('select public.approve_teacher($1)', [b.teacher])))
    expect(msg).toMatch(/not authorized/i)
  })

  it('grant_head refuses a teacher', async () => {
    const msg = await denied(() => act(c, { uid: b.teacher }, q =>
      q('select public.grant_head($1)', [b.teacher])))
    expect(msg).toMatch(/not authorized/i)
  })

  it("grant_head runs for a head but touches nobody in another centre", async () => {
    // A head is authorized, so no exception — the `centre_id = current_centre()`
    // in the UPDATE is the only thing protecting the other centre's teacher.
    await act(c, { uid: b.head, commit: true }, q => q('select public.grant_head($1)', [a.teacher]))
    const { rows } = await c.query('select role from public.profiles where id = $1', [a.teacher])
    expect(rows[0].role).toBe('teacher')
  })

  it('remove_staff refuses to remove the head who called it', async () => {
    const msg = await denied(() => act(c, { uid: b.head }, q =>
      q('select public.remove_staff($1)', [b.head])))
    expect(msg).toMatch(/cannot remove yourself/i)
  })

  // ── delete_centre: the operator's, and nobody else's ───────────────────────

  it('a head cannot execute delete_centre', async () => {
    const msg = await denied(() => act(c, { uid: b.head }, q =>
      q('select public.delete_centre($1, $2)', [b.id, ['students']])))
    expect(msg).toMatch(/permission denied/i)
  })

  it('delete_centre refuses to clear an exempt table even for the operator', async () => {
    const msg = await denied(() => act(c, { role: 'service_role' }, q =>
      q('select public.delete_centre($1, $2)', [b.id, ['profiles']])))
    expect(msg).toMatch(/must never be cleared/i)
  })

  it('delete_centre refuses a table that is not centre-scoped', async () => {
    const msg = await denied(() => act(c, { role: 'service_role' }, q =>
      q('select public.delete_centre($1, $2)', [b.id, ['schema_migrations']])))
    expect(msg).toMatch(/not a centre-scoped table/i)
  })

  // ── the student paths, which have no session at all ────────────────────────

  it("a student code from one centre does not reach another centre's data", async () => {
    const snap = await act(c, { role: 'anon' }, async q =>
      (await q('select public.get_student_snapshot($1) as r', [a.students[0].code])).rows[0].r)
    expect(snap.student.name).toBe(a.students[0].name)
    expect(snap.student.code).toBe(a.students[0].code)
    // Nothing belonging to the other centre came back with it.
    expect(JSON.stringify(snap)).not.toContain(b.students[0].code)
    expect(JSON.stringify(snap)).not.toContain(b.students[0].name)
  })

  it('a guessed student code returns nothing', async () => {
    const snap = await act(c, { role: 'anon' }, async q =>
      (await q('select public.get_student_snapshot($1) as r', ['TUT-NOTREAL'])).rows[0].r)
    expect(snap).toBeNull()
  })

  it('the throttle behind the guessing paths is not callable directly', async () => {
    const msg = await denied(() => act(c, { role: 'anon' }, q =>
      q('select public.code_attempt_guard()')))
    expect(msg).toMatch(/permission denied/i)
  })

  it('signing up with one centre code cannot land a student in another', async () => {
    const signup = await act(c, { role: 'anon', commit: true }, async q =>
      (await q('select public.student_signup($1,$2,$3,$4,$5) as r',
        [b.studentJoinCode, 'Crossover Child', '9000000001', '9', 'Test School'])).rows[0].r)
    const { rows } = await c.query(
      'select centre_id, status from public.students where student_code = $1', [signup.code])
    expect(rows[0].centre_id).toBe(b.id)
    expect(rows[0].status).toBe('pending')
  })

  it('a wrong centre code is refused rather than guessed at', async () => {
    const msg = await denied(() => act(c, { uid: a.outsider }, q =>
      q('select public.join_centre($1)', ['NOTACODE00'])))
    expect(msg).toMatch(/invalid centre code/i)
  })
})
