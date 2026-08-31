// The student code stops being the password.
//
// Until 0040 a student's login code was a bearer credential: whoever held the
// string could read that child's marks, fees, address and parent's number, from
// any phone, forever. It is a credential designed to be read out loud and
// forwarded, so treating it as a secret was never going to hold.
//
// Now the code buys a device token once and the token is what the phone sends
// afterwards. These tests pin down the three things that has to mean: the first
// phone works with no new step for anyone, the second phone is stopped until
// the centre allows it, and a removed phone cannot fall back to the raw code.

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { DB_URL, act, denied, owner, seedCentre, type Centre } from './harness'

const suite = DB_URL ? describe : describe.skip

suite('student devices', () => {
  let c: pg.Client
  let a: Centre
  let b: Centre
  // Its own centre, because the race test needs a student no other test here
  // has already given a phone to.
  let r: Centre

  beforeAll(async () => {
    c = await owner()
    a = await seedCentre(c, 'Voucher')
    b = await seedCentre(c, 'Bystander')
    r = await seedCentre(c, 'Racer')
  }, 60_000)

  afterAll(async () => { await c?.end() })

  /** Anon, committed — the way a phone actually calls it. */
  const claim = (code: string, label: string | null = null) =>
    act(c, { role: 'anon', commit: true }, async q =>
      (await q('select public.claim_student_device($1,$2) as r', [code, label])).rows[0].r)

  const snapshot = (cred: string) =>
    act(c, { role: 'anon' }, async q =>
      (await q('select public.get_student_snapshot($1) as r', [cred])).rows[0].r)

  it('the first phone on a code is allowed on the spot', async () => {
    const { token, approved } = await claim(a.students[0].code, 'First phone')
    expect(approved).toBe(true)
    expect(token).toMatch(/^[0-9a-f]{64}$/)

    const snap = await snapshot(token)
    expect(snap.status).toBe('approved')
    expect(snap.student.name).toBe(a.students[0].name)
  })

  it('the raw code stops working for that student once a phone holds it', async () => {
    // The compatibility window closing by itself, with nobody signed out: this
    // student's own phone kept working above, through its token.
    const snap = await snapshot(a.students[0].code)
    expect(snap).toBeNull()
  })

  it('a second phone is stored, but reads nothing until the centre allows it', async () => {
    const { token, approved } = await claim(a.students[0].code, 'Second phone')
    expect(approved).toBe(false)

    const snap = await snapshot(token)
    expect(snap).toEqual({ status: 'device_pending' })
  })

  it('the head can allow the second phone, and only in their own centre', async () => {
    const { rows } = await c.query(
      `select d.id, d.token_hash from public.student_devices d
        where d.student_id = $1 and not d.approved`, [a.students[0].id])
    expect(rows).toHaveLength(1)

    // Another centre's head is filtered to nothing by the policy — silently,
    // because this is a table write and RLS is the boundary, not a raised error.
    const stranger = await act(c, { uid: b.head }, async q =>
      (await q('update public.student_devices set approved = true where id = $1 returning id',
        [rows[0].id])).rowCount)
    expect(stranger).toBe(0)

    await act(c, { uid: a.head, commit: true }, q =>
      q('update public.student_devices set approved = true where id = $1', [rows[0].id]))
  })

  it('a removed phone loses access and cannot fall back to the raw code', async () => {
    const { token } = await claim(a.students[1].code, 'Phone to remove')
    expect((await snapshot(token)).status).toBe('approved')

    await act(c, { uid: a.head, commit: true }, q =>
      q(`update public.student_devices set revoked_at = now()
          where token_hash = encode(digest($1, 'sha256'), 'hex')`, [token]))

    expect(await snapshot(token)).toEqual({ status: 'device_revoked' })
    // And the code it was bought with is not a way back in: the revoked row is
    // still there, so the compatibility window stays shut for this student.
    expect(await snapshot(a.students[1].code)).toBeNull()
  })

  it('two phones claiming at the same instant cannot both be the first', async () => {
    // The property everything else here rests on, tested the only way it can be
    // proved: with two connections and one of them still open. Without the row
    // lock in 0041 both callers read an empty device table, both concluded they
    // were the household's first phone, and both let themselves in — which is
    // precisely the code-that-travelled case the design exists to stop.
    const student = r.students[0]
    const other = new pg.Client({ connectionString: DB_URL })
    await other.connect()
    try {
      await c.query('begin')
      await c.query('set local role anon')
      const first = (await c.query('select public.claim_student_device($1,$2) as r',
        [student.code, 'Racing phone A'])).rows[0].r
      expect(first.approved).toBe(true)

      // Still uncommitted. The second caller must not read around it.
      await other.query('begin')
      await other.query('set local role anon')
      await other.query(`set local statement_timeout = '1500ms'`)
      const msg = await denied(() => other.query('select public.claim_student_device($1,$2) as r',
        [student.code, 'Racing phone B']))
      expect(msg).toMatch(/statement timeout/i)
      await other.query('rollback')

      await c.query('commit')

      // And once the first claim is committed, the second one sees it.
      const second = await act(c, { role: 'anon', commit: true }, async q =>
        (await q('select public.claim_student_device($1,$2) as r',
          [student.code, 'Racing phone B'])).rows[0].r)
      expect(second.approved).toBe(false)
    } finally {
      await c.query('rollback').catch(() => {})
      await other.end()
    }
  })

  it('a code that does not exist is refused without saying so', async () => {
    const msg = await denied(() => claim('NOSUCHCODE'))
    expect(msg).toMatch(/Not found/)
  })

  it('claim_student_device is callable by anon, student_for_credential by nobody', async () => {
    const { rows } = await c.query(
      `select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as auth
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('claim_student_device', 'student_for_credential')`)
    const by = Object.fromEntries(rows.map(r => [r.proname, r]))
    expect(by.claim_student_device.anon).toBe(true)
    // The resolver reads any student in any centre from a raw string. Nothing
    // outside the database should be able to reach it.
    expect(by.student_for_credential.anon).toBe(false)
    expect(by.student_for_credential.auth).toBe(false)
  })

  it('anon cannot read the device table directly', async () => {
    const msg = await denied(() =>
      act(c, { role: 'anon' }, q => q('select token_hash from public.student_devices')))
    expect(msg).toMatch(/permission denied/i)
  })

  it("a head cannot see another centre's phones", async () => {
    const mine = await act(c, { uid: a.head }, async q =>
      (await q('select count(*)::int as n from public.student_devices')).rows[0].n)
    const theirs = await act(c, { uid: b.head }, async q =>
      (await q('select count(*)::int as n from public.student_devices')).rows[0].n)
    expect(mine).toBeGreaterThan(0)
    expect(theirs).toBe(0)
  })
})
