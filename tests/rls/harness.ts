// The unit tests in tests/*.test.ts are pure logic on purpose — no DOM, no
// network, no database. That rule is what keeps them fast and honest, and it
// is also why none of them can say anything about row level security, which is
// the only thing standing between one tuition centre's records and another's.
// Every policy in this app has been reviewed by reading it. None has ever been
// attacked.
//
// So this suite is deliberately outside that rule: it talks to a real Postgres
// with the real migrations applied, signs in as one centre's head, and tries to
// read and write another centre's children. It runs in CI against a throwaway
// container and is skipped entirely when DATABASE_URL is absent, which is why
// `npx vitest run` stays green on a laptop with no database on it.

import { randomUUID } from 'node:crypto'
import pg from 'pg'

export const DB_URL = process.env.DATABASE_URL ?? ''

/** The owning connection. Superuser, bypasses RLS — used only to set the stage. */
export const owner = async (): Promise<pg.Client> => {
  const c = new pg.Client({ connectionString: DB_URL })
  await c.connect()
  return c
}

export type Q = (sql: string, params?: unknown[]) => Promise<pg.QueryResult>

type Who = { role?: 'authenticated' | 'anon' | 'service_role'; uid?: string | null; commit?: boolean }

/**
 * Runs `fn` in a transaction shaped like a real request: the caller's JWT
 * subject in the GUC auth.uid() reads, and the API role PostgREST would have
 * switched to. Rolls back afterwards unless `commit` is set, so an attack that
 * unexpectedly succeeds cannot leak into the next test.
 */
export async function act<T>(c: pg.Client, who: Who, fn: (q: Q) => Promise<T>): Promise<T> {
  const { role = 'authenticated', uid = null, commit = false } = who
  await c.query('begin')
  try {
    // set_config's third argument is is_local: the setting dies with the
    // transaction, exactly like a request-scoped claim.
    await c.query('select set_config($1, $2, true)', ['request.jwt.claim.sub', uid ?? ''])
    await c.query(`set local role ${role}`)
    const out = await fn((sql, params) => c.query(sql, params as never))
    await c.query(commit ? 'commit' : 'rollback')
    return out
  } catch (e) {
    await c.query('rollback').catch(() => {})
    throw e
  }
}

/**
 * Asserts the block raised, and returns the message. Two different denials
 * matter here and the tests say which they expect: a function that refuses out
 * loud, versus RLS quietly filtering rows to nothing. Conflating them is how a
 * missing policy passes for a working one.
 */
export async function denied(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn()
  } catch (e) {
    return (e as Error).message
  }
  throw new Error('expected this to be refused, but it succeeded')
}

export type Centre = {
  id: string
  studentJoinCode: string
  head: string
  teacher: string
  outsider: string
  students: { id: string; code: string; name: string }[]
}

/** Creates an account the way a Google sign-in does: a row in auth.users, and
 *  the handle_new_user trigger writes the profile. */
export async function newAccount(c: pg.Client, name: string): Promise<string> {
  const id = randomUUID()
  await c.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,
    [id, `${id}@example.test`, JSON.stringify({ full_name: name })],
  )
  return id
}

/**
 * A whole centre, built through the same functions the app calls — create_centre,
 * join_centre, approve_teacher, student_signup. Seeding by direct insert would
 * be shorter and would also quietly skip the paths most worth testing.
 */
export async function seedCentre(c: pg.Client, label: string): Promise<Centre> {
  const head = await newAccount(c, `${label} Head`)
  const teacher = await newAccount(c, `${label} Teacher`)
  const outsider = await newAccount(c, `${label} Outsider`)

  const created = await act(c, { uid: head, commit: true }, async q =>
    (await q('select public.create_centre($1) as r', [`${label} Tuition`])).rows[0].r)

  await act(c, { uid: teacher, commit: true }, q => q('select public.join_centre($1)', [created.join_code]))
  await act(c, { uid: head, commit: true }, async q => {
    await q('select public.approve_teacher($1)', [teacher])
  })

  const students: Centre['students'] = []
  for (const nm of [`${label} Child A`, `${label} Child B`]) {
    // Signs up as anon, exactly like the join screen: no session, just the code.
    const signup = await act(c, { role: 'anon', commit: true }, async q =>
      (await q('select public.student_signup($1,$2,$3,$4,$5) as r',
        [created.student_join_code, nm, '9000000000', '10', 'Test School'])).rows[0].r)

    const row = await c.query(
      'select id, student_code, name from public.students where student_code = $1', [signup.code])

    // The head approves and sets the first fee, which is where fee rows come
    // from in real life — approve_student writes it and lets the centre_id
    // column default fill itself in from the head's session.
    await act(c, { uid: head, commit: true }, q =>
      q('select public.approve_student($1,$2,$3,$4,$5)', [row.rows[0].id, '10', null, 1000, null]))

    students.push({ id: row.rows[0].id, code: row.rows[0].student_code, name: row.rows[0].name })
  }

  // A day of attendance and one notification each. "The other centre cannot see
  // this" is only worth asserting when there is something there to fail to see:
  // against empty tables every isolation test passes for free.
  await act(c, { uid: head, commit: true }, async q => {
    for (const s of students) {
      await q(`insert into public.attendance (student_id, status) values ($1, 'Present')`, [s.id])
      await q(`insert into public.notifications (student_id, title, detail) values ($1, $2, $3)`,
        [s.id, 'Fee due', 'Please pay this month'])
    }
  })

  return {
    id: created.centre_id,
    studentJoinCode: created.student_join_code,
    head, teacher, outsider, students,
  }
}
