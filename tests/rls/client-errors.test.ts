// Crash reports go in through /api/log with the service role and nowhere else.
//
// The table is written by anyone's phone, so the lock that matters is on the
// other side: the anon key ships in every browser, and a signed-in user is one
// sign-up away. Neither may read another user's user agent or error text, and
// neither may write rows past the route's shape check and rate limits.

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { DB_URL, act, denied, newAccount, owner } from './harness'

const suite = DB_URL ? describe : describe.skip

suite('client_errors', () => {
  let c: pg.Client
  let user: string

  beforeAll(async () => {
    c = await owner()
    user = await newAccount(c, 'Crash Reader')
  })
  afterAll(async () => { await c?.end() })

  for (const role of ['anon', 'authenticated'] as const) {
    it(`${role} can neither read nor write it`, async () => {
      const as = { role, uid: role === 'authenticated' ? user : null }
      expect(await denied(() => act(c, as, q => q('select 1 from public.client_errors'))))
        .toMatch(/permission denied/)
      expect(await denied(() => act(c, as, q =>
        q(`insert into public.client_errors (event) values ('client.uncaught')`))))
        .toMatch(/permission denied/)
    })
  }

  it('keeps only the newest 5000 rows', async () => {
    await act(c, { role: 'service_role' }, async q => {
      await q(`insert into public.client_errors (event) select 'test.flood' from generate_series(1, 5010)`)
      const { rows: [r] } = await q('select count(*)::int as n, max(id) - min(id) as span from public.client_errors')
      expect(r.n).toBeLessThanOrEqual(5000)
      expect(Number(r.span)).toBeLessThan(5000)
    })
  })

  it('refuses an event name longer than the route allows', async () => {
    expect(await denied(() => act(c, { role: 'service_role' }, q =>
      q('insert into public.client_errors (event) values ($1)', ['x'.repeat(81)]))))
      .toMatch(/check constraint/)
  })
})
