// A wrong guess has to leave a mark.
//
// Before 0046 half the code-guessing paths recorded the miss and then raised
// 'Not found', and the raise rolled the record back with it — so those paths
// were never throttled at all. These tests make the misses real: anon,
// committed, the way PostgREST runs them, and then count what survived.
//
// Every call here comes from a documentation address (RFC 5737) set in the
// request headers, so this file fills its own bucket and never the 'unknown'
// one the other suites share.

import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import pg from 'pg'
import { DB_URL, act, denied, owner, type Q } from './harness'

const suite = DB_URL ? describe : describe.skip

const NET = '203.0.113.0/24'
const headers = (ip: string) => JSON.stringify({ 'x-real-ip': ip })

suite('code guessing throttle', () => {
  let c: pg.Client

  const clear = () => c.query('delete from public.code_attempts where ip in ($1, $2)', [NET, '198.51.100.0/24'])
  const recorded = async () =>
    (await c.query('select count(*)::int as n from public.code_attempts where ip = $1', [NET])).rows[0].n

  /** One anonymous request from `ip`, committed. */
  const from = <T>(ip: string, fn: (q: Q) => Promise<T>) =>
    act(c, { role: 'anon', commit: true }, async q => {
      await q(`select set_config('request.headers', $1, true)`, [headers(ip)])
      return fn(q)
    })

  const miss = (ip = '203.0.113.9') =>
    from(ip, async q => (await q('select public.claim_student_device($1, null) as r', ['NOSUCHCODE'])).rows[0].r)

  beforeAll(async () => { c = await owner() })
  beforeEach(clear)
  afterAll(async () => { await clear(); await c?.end() })

  it('every guessing path records its miss', async () => {
    expect(await miss()).toEqual({ error: 'not_found' })

    const ticket = await from('203.0.113.9', async q =>
      (await q('select public.file_ticket($1,$2,$3,$4,$5,$6,$7) as r',
        ['NOSUCHCODE', 'Open my marks', 'Nothing loads', 'Marks', 'always', null, '{}'])).rows[0].r)
    expect(ticket).toBeNull()

    const reply = await from('203.0.113.9', async q =>
      (await q('select public.reply_ticket($1,$2,$3) as r',
        ['NOSUCHCODE', '00000000-0000-0000-0000-000000000000', 'Still broken'])).rows[0].r)
    expect(reply).toBe(false)

    const signup = await from('203.0.113.9', async q =>
      (await q('select public.student_signup($1,$2,$3,$4,$5) as r',
        ['NOSUCH', 'Guess Child', '9000000000', '10', 'Test School'])).rows[0].r)
    expect(signup).toEqual({ error: 'invalid_join_code' })

    expect(await recorded()).toBe(4)
  })

  it('sixty misses from one /24 shut that block out, and only that block', async () => {
    // Different hosts in the same block: rotating addresses buys nothing.
    for (let i = 0; i < 60; i++) await miss(`203.0.113.${i + 1}`)

    const msg = await denied(() => miss('203.0.113.200'))
    expect(msg).toMatch(/Too many attempts/)

    expect(await miss('198.51.100.7')).toEqual({ error: 'not_found' })
  }, 30_000)
})
