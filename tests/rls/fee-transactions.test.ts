// The fee functions, tested for what they leave behind rather than for who may
// call them — rpc-authorization.test.ts already covers the boundary.
//
// Two things are being pinned down here. First, that the badge on the student
// row and the fee rows underneath it never disagree, because that disagreement
// is what the whole 0030/0034 pair exists to prevent: a family reading "Due"
// against a list where every row says Paid has no way to tell which one is
// lying, and neither does the head. Second, that a call which changes nothing
// says so — a fee function that reports success while RLS quietly filtered its
// write away is how a head comes to believe money was collected.
//
// Every test runs inside act(), which rolls back, so the rows one test writes
// cannot become the next one's starting position.

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { DB_URL, act, denied, owner, seedCentre, type Centre } from './harness'

const suite = DB_URL ? describe : describe.skip

suite('fee writes', () => {
  let c: pg.Client
  let a: Centre
  let b: Centre

  beforeAll(async () => {
    c = await owner()
    a = await seedCentre(c, 'Epsilon')
    b = await seedCentre(c, 'Zeta')
  }, 60_000)

  afterAll(async () => { await c?.end() })

  const student = () => a.students[0].id

  /** Runs `fn` as the head of centre A and throws away everything it wrote. */
  const asHead = <T>(fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>) =>
    act(c, { uid: a.head }, fn)

  const badge = async (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) =>
    (await q('select fee_status from public.students where id = $1', [student()])).rows[0].fee_status

  // ── the bug 0034 fixes ────────────────────────────────────────────────────

  it('reopening a student with only historical paid fees changes nothing', async () => {
    // The mis-tap this guards against: a head opens a fully settled student,
    // taps the badge by accident, and the undo has nothing to undo. Before
    // 0034 the badge flipped to Due anyway, and no fee row agreed with it.
    const out = await asHead(async q => {
      await q('select public.mark_fees_paid($1)', [student()])
      // Age the payment. Reopen deliberately only touches TODAY's collections,
      // so this is what "collected in an earlier month" looks like to it.
      await q(`update public.fees set paid_date = current_date - 40 where student_id = $1`, [student()])
      await q(`update public.students set fee_status = 'Paid' where id = $1`, [student()])

      const r = (await q('select public.reopen_fees_today($1) as r', [student()])).rows[0].r
      return { r, badge: await badge(q), rows: (await q(
        'select status from public.fees where student_id = $1', [student()])).rows.map(x => x.status) }
    })

    expect(out.r.fees).toBe(0)
    expect(out.r.status).toBe('Paid')
    expect(out.badge).toBe('Paid')
    expect(out.rows).toEqual(['Paid'])
  })

  it("reopening a payment taken today does reopen it, and the badge follows", async () => {
    // The mirror image, and the reason the test above proves anything: reopen
    // is not simply inert.
    const out = await asHead(async q => {
      await q('select public.mark_fees_paid($1)', [student()])
      const r = (await q('select public.reopen_fees_today($1) as r', [student()])).rows[0].r
      return { r, badge: await badge(q), paid: (await q(
        'select paid_date from public.fees where student_id = $1', [student()])).rows[0].paid_date }
    })

    expect(out.r.fees).toBe(1)
    expect(out.r.status).toBe('Due')
    expect(out.badge).toBe('Due')
    expect(out.paid).toBeNull()
  })

  it('a student with no fee rows at all reads Paid', async () => {
    const out = await asHead(async q => {
      await q('delete from public.fees where student_id = $1', [student()])
      const r = (await q('select public.sync_fee_status($1) as r', [student()])).rows[0].r
      return { r, badge: await badge(q) }
    })
    expect(out.r.status).toBe('Paid')
    expect(out.badge).toBe('Paid')
  })

  // ── add_fee ───────────────────────────────────────────────────────────────

  it('add_fee writes the row and the badge together', async () => {
    const out = await asHead(async q => {
      await q('select public.mark_fees_paid($1)', [student()])
      const r = (await q(`select public.add_fee($1, 500, 'Sep 2026', current_date + 7) as r`, [student()])).rows[0].r
      return { r, badge: await badge(q), count: (await q(
        `select count(*) from public.fees where student_id = $1 and status = 'Due'`, [student()])).rows[0].count }
    })
    expect(out.r).toMatchObject({ student: 1, fees: 1, status: 'Due' })
    expect(out.badge).toBe('Due')
    expect(out.count).toBe('1')
  })

  it("add_fee writes nothing into another centre's student", async () => {
    const r = await act(c, { uid: b.head }, async q =>
      (await q(`select public.add_fee($1, 500, 'Sep 2026', current_date) as r`, [student()])).rows[0].r)
    expect(r).toEqual({ student: 0, fees: 0, status: null })

    const { rows } = await c.query('select count(*) from public.fees where student_id = $1', [student()])
    expect(rows[0].count).toBe('1') // the one seedCentre made, and nothing else
  })

  it('a teacher cannot add a fee', async () => {
    // fees_head is the write policy. The student row is readable to a teacher,
    // so the lock succeeds and the insert is what gets refused — out loud,
    // because a with-check violation raises rather than filtering.
    const msg = await denied(() => act(c, { uid: a.teacher }, q =>
      q(`select public.add_fee($1, 500, 'Sep 2026', current_date)`, [student()])))
    expect(msg).toMatch(/row-level security/i)
  })

  // ── add_fee_plan ──────────────────────────────────────────────────────────

  it('add_fee_plan writes every installment under one plan id', async () => {
    const out = await asHead(async q => {
      const r = (await q(`select public.add_fee_plan($1, $2::json) as r`, [student(), JSON.stringify([
        { amount: 1000, period: 'Sep 2026', due_date: '2026-09-05' },
        { amount: 1000, period: 'Oct 2026', due_date: '2026-10-05' },
        { amount: 1000, period: 'Nov 2026', due_date: '2026-11-05' },
      ])])).rows[0].r
      return { r, rows: (await q(
        'select amount, plan_id from public.fees where plan_id = $1', [r.plan_id])).rows }
    })
    expect(out.r).toMatchObject({ student: 1, fees: 3, status: 'Due' })
    expect(out.rows).toHaveLength(3)
    expect(new Set(out.rows.map(r => r.plan_id)).size).toBe(1)
  })

  it('add_fee_plan refuses an empty plan', async () => {
    const msg = await denied(() => asHead(q =>
      q(`select public.add_fee_plan($1, '[]'::json)`, [student()])))
    expect(msg).toMatch(/at least one installment/i)
  })

  it("add_fee_plan writes nothing into another centre's student", async () => {
    const r = await act(c, { uid: b.head }, async q =>
      (await q(`select public.add_fee_plan($1, $2::json) as r`, [student(),
        JSON.stringify([{ amount: 1, period: 'Sep 2026', due_date: '2026-09-05' }])])).rows[0].r)
    expect(r).toEqual({ student: 0, fees: 0, status: null })
  })

  // ── delete_fee ────────────────────────────────────────────────────────────

  it('delete_fee removes the row and recomputes the badge from what is left', async () => {
    const out = await asHead(async q => {
      const fee = (await q('select id from public.fees where student_id = $1', [student()])).rows[0].id
      const r = (await q('select public.delete_fee($1) as r', [fee])).rows[0].r
      return { r, badge: await badge(q), left: (await q(
        'select count(*) from public.fees where student_id = $1', [student()])).rows[0].count }
    })
    expect(out.r).toMatchObject({ student: 1, fees: 1, status: 'Paid' })
    expect(out.badge).toBe('Paid')
    expect(out.left).toBe('0')
  })

  it("a teacher's delete is filtered away, and says so instead of succeeding", async () => {
    const fee = (await c.query('select id from public.fees where student_id = $1', [student()])).rows[0].id
    const r = await act(c, { uid: a.teacher }, async q =>
      (await q('select public.delete_fee($1) as r', [fee])).rows[0].r)
    expect(r).toEqual({ student: 0, fees: 0, status: null })

    const { rows } = await c.query('select count(*) from public.fees where id = $1', [fee])
    expect(rows[0].count).toBe('1')
  })

  it("delete_fee finds nothing when aimed at another centre's fee", async () => {
    const fee = (await c.query('select id from public.fees where student_id = $1', [student()])).rows[0].id
    const r = await act(c, { uid: b.head }, async q =>
      (await q('select public.delete_fee($1) as r', [fee])).rows[0].r)
    expect(r).toEqual({ student: 0, fees: 0, status: null })
  })

  // ── delete_fee_plan ───────────────────────────────────────────────────────

  it('delete_fee_plan takes the unpaid installments and leaves the collected ones', async () => {
    const out = await asHead(async q => {
      const plan = (await q(`select public.add_fee_plan($1, $2::json) as r`, [student(), JSON.stringify([
        { amount: 1000, period: 'Sep 2026', due_date: '2026-09-05' },
        { amount: 1000, period: 'Oct 2026', due_date: '2026-10-05' },
      ])])).rows[0].r.plan_id

      // One installment is collected. Deleting it later would erase money that
      // changed hands from the fees-collected report.
      await q(`update public.fees set status = 'Paid', paid_date = current_date
               where plan_id = $1 and period = 'Sep 2026'`, [plan])

      const r = (await q('select public.delete_fee_plan($1, $2) as r', [plan, student()])).rows[0].r
      return { r, left: (await q(
        'select period, status from public.fees where plan_id = $1', [plan])).rows }
    })
    expect(out.r.fees).toBe(1)
    expect(out.left).toEqual([{ period: 'Sep 2026', status: 'Paid' }])
  })

  it('delete_fee_plan reports zero when every installment is already paid', async () => {
    const r = await asHead(async q => {
      const plan = (await q(`select public.add_fee_plan($1, $2::json) as r`, [student(),
        JSON.stringify([{ amount: 1000, period: 'Sep 2026', due_date: '2026-09-05' }])])).rows[0].r.plan_id
      await q(`update public.fees set status = 'Paid', paid_date = current_date where plan_id = $1`, [plan])
      return (await q('select public.delete_fee_plan($1, $2) as r', [plan, student()])).rows[0].r
    })
    expect(r).toEqual({ student: 0, fees: 0, status: null })
  })

  // ── create_student ────────────────────────────────────────────────────────

  const mk = (fee: string) =>
    `select public.create_student('Nita','Class 9','','St Xavier','9000000123',
       'TUT-NEW1', 'Addr', null, ${fee}) as r`

  it('creates the student and their enrolment fee in one call', async () => {
    const out = await asHead(async q => {
      const r = (await q(mk('2000, current_date + 5'))).rows[0].r
      return { r, fees: (await q(
        'select amount, status from public.fees where student_id = $1', [r.id])).rows }
    })
    expect(out.r).toMatchObject({ student: 1, fees: 1, status: 'Due' })
    expect(out.fees).toEqual([{ amount: '2000.00', status: 'Due' }])
  })

  it('a student added without a fee is Paid, not Due', async () => {
    // The badge means "at least one fee row is unpaid". With no fee rows there
    // is nothing for the parent to pay and nothing for the head to clear, so
    // Due would be a badge neither of them can act on.
    const out = await asHead(async q => {
      const r = (await q(mk('null'))).rows[0].r
      return { r, badge: (await q(
        'select fee_status from public.students where id = $1', [r.id])).rows[0].fee_status }
    })
    expect(out.r).toMatchObject({ student: 1, fees: 0, status: 'Paid' })
    expect(out.badge).toBe('Paid')
  })

  it('a teacher is told the fee is not theirs to set, in words', async () => {
    // fees_head would refuse this anyway, as an unreadable with-check violation
    // — and only after the student row had been written. The named check turns
    // it into a sentence and takes the student row down with it.
    const msg = await denied(() => act(c, { uid: a.teacher }, q =>
      q(mk('2000, current_date'))))
    expect(msg).toMatch(/only the head can set a fee/i)
  })

  it('a teacher can still add a student without a fee', async () => {
    const r = await act(c, { uid: a.teacher }, async q => (await q(mk('null'))).rows[0].r)
    expect(r).toMatchObject({ student: 1, fees: 0, status: 'Paid' })
  })

  it('anon cannot execute create_student', async () => {
    const msg = await denied(() => act(c, { role: 'anon' }, q => q(mk('null'))))
    expect(msg).toMatch(/permission denied/i)
  })

  // ── the other doors into the students table ───────────────────────────────

  it('a student who signs up and waits is not Due before anyone has billed them', async () => {
    const badge = await asHead(async q => {
      // What student_signup() writes, including its literal 'Due' — the table
      // is what overrules it, so every path is covered and not just that one.
      const id = (await q(`insert into public.students
        (name, class, school, parent_contact, student_code, fee_status, status)
        values ('Waiting','Class 8','St Xavier','9000000124','TUT-WAIT','Due','pending')
        returning id`)).rows[0].id
      return (await q('select fee_status from public.students where id = $1', [id])).rows[0].fee_status
    })
    expect(badge).toBe('Paid')
  })

  it('approving with a fee turns the badge Due, and approving without one leaves it Paid', async () => {
    const out = await asHead(async q => {
      const add = async (code: string) => (await q(`insert into public.students
        (name, class, school, parent_contact, student_code, status)
        values ('Waiting','Class 8','St Xavier','9000000124',$1,'pending') returning id`, [code])).rows[0].id
      const billed = await add('TUT-BILL')
      const free = await add('TUT-FREE')
      await q('select public.approve_student($1, null, null, 1500, current_date)', [billed])
      await q('select public.approve_student($1)', [free])
      const badge = async (id: string) =>
        (await q('select fee_status from public.students where id = $1', [id])).rows[0].fee_status
      return { billed: await badge(billed), free: await badge(free) }
    })
    expect(out).toEqual({ billed: 'Due', free: 'Paid' })
  })

  // ── the roles with nothing ────────────────────────────────────────────────

  for (const fn of ['add_fee($1, 1, $2, current_date)', 'add_fee_plan($1, \'[]\'::json)',
                    'delete_fee($1)', 'delete_fee_plan($1, $1)', 'fee_status_of($1)'] as const) {
    it(`anon cannot execute ${fn.split('(')[0]}`, async () => {
      const msg = await denied(() => act(c, { role: 'anon' }, q =>
        q(`select public.${fn}`, fn.includes('$2') ? [student(), 'Sep 2026'] : [student()])))
      expect(msg).toMatch(/permission denied/i)
    })
  }
})
