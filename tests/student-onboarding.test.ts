import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Controllable RPC mock — each test sets the next result. The store imports
// `supabase` at module load, so the mock must be declared before the import.
const rpc = vi.fn<(name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>()
vi.mock('../app/lib/supabase', () => ({ supabase: { rpc: (...a: [string, Record<string, unknown>?]) => rpc(...a) } }))
const sendPush = vi.fn(() => Promise.resolve())
const enablePush = vi.fn(() => Promise.resolve({ ok: true }))
const supported = { on: false }
vi.mock('../app/lib/push', () => ({
  sendPush: (...a: unknown[]) => sendPush(...(a as [])),
  enablePush: (...a: unknown[]) => enablePush(...(a as [])),
  pushSupported: () => supported.on,
}))

import { useDashboard, type PendingStudent } from '../app/store'

const S = () => useDashboard.getState()

const pending = (over: Partial<PendingStudent> = {}): PendingStudent => ({
  dbId: 'd1', name: 'Neha', klass: 'Class 10', school: 'DPS', parent: '+91 90000 00000',
  address: '', code: 'TUT-ABCDEFGH', when: 'just now', ...over,
})

beforeEach(() => {
  rpc.mockReset()
  sendPush.mockClear()
  enablePush.mockClear()
  supported.on = false
  useDashboard.setState({
    stuSignup: { joinCode: 'ABC123', name: '', parent: '', klass: 'Class 10', school: '', address: '' },
    stuPending: null, pendingStudents: [], toast: '', screen: 'home', role: 'admin',
  })
})
afterEach(() => { vi.clearAllTimers(); vi.unstubAllGlobals() })

describe('studentSignup validation (no network on invalid input)', () => {
  const fill = (patch: Partial<ReturnType<typeof S>['stuSignup']>) =>
    useDashboard.getState().setStuSignup(patch)

  it('rejects a missing/short name', async () => {
    fill({ name: 'A', parent: '+91 90000 00000', school: 'DPS' })
    await S().studentSignup()
    expect(S().toast).toBe('Enter your full name')
    expect(rpc).not.toHaveBeenCalled()
    expect(S().stuPending).toBeNull()
  })

  it('rejects an invalid parent phone', async () => {
    fill({ name: 'Neha', parent: '123', school: 'DPS' })
    await S().studentSignup()
    expect(S().toast).toBe('Enter a valid parent phone number')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a blank class', async () => {
    fill({ name: 'Neha', parent: '+91 90000 00000', school: 'DPS', klass: '   ' })
    await S().studentSignup()
    expect(S().toast).toBe('Select your class')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a missing school (school is compulsory)', async () => {
    fill({ name: 'Neha', parent: '+91 90000 00000', school: '' })
    await S().studentSignup()
    expect(S().toast).toBe('Enter your school name')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('accepts a valid form, lands on the pending screen with the minted code', async () => {
    rpc.mockResolvedValueOnce({ data: { code: 'TUT-ZZZZ2345', name: 'Neha', centre: 'Bright Future' }, error: null })
    fill({ name: 'Neha Sharma', parent: '+91 90000 00000', school: 'DPS', address: '12 MG Rd' })
    await S().studentSignup()
    expect(rpc).toHaveBeenCalledWith('student_signup', expect.objectContaining({
      p_name: 'Neha Sharma', p_parent: '+91 90000 00000', p_class: 'Class 10',
      p_school: 'DPS', p_address: '12 MG Rd', p_join_code: 'ABC123',
    }))
    expect(S().screen).toBe('stuPending')
    expect(S().role).toBe('student')
    expect(S().stuPending).toEqual({ name: 'Neha', code: 'TUT-ZZZZ2345', centre: 'Bright Future' })
    // The form is cleared after a successful submit.
    expect(S().stuSignup.name).toBe('')
  })

  it('sends optional address as null when left blank', async () => {
    rpc.mockResolvedValueOnce({ data: { code: 'TUT-AAAA2345', name: 'Neha', centre: 'X' }, error: null })
    fill({ name: 'Neha Sharma', parent: '+91 90000 00000', school: 'DPS', address: '   ' })
    await S().studentSignup()
    expect(rpc).toHaveBeenCalledWith('student_signup', expect.objectContaining({ p_address: null }))
  })

  it('surfaces a server error and does not navigate', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'Invalid centre code — check with your teacher' } })
    fill({ name: 'Neha Sharma', parent: '+91 90000 00000', school: 'DPS' })
    await S().studentSignup()
    expect(S().toast).toBe('Invalid centre code — check with your teacher')
    expect(S().screen).toBe('home')
    expect(S().stuPending).toBeNull()
  })

  it('translates a failure that carries no human-written message', async () => {
    // A dropped connection or an unmapped Postgres code. The raw text is
    // useless to a student, so she gets a sentence she can act on instead.
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Failed to fetch' } })
    fill({ name: 'Neha Sharma', parent: '+91 90000 00000', school: 'DPS' })
    await S().studentSignup()
    expect(S().toast).toContain('No internet')
    expect(S().stuPending).toBeNull()
  })
})

describe('approveStudent', () => {
  beforeEach(() => useDashboard.setState({ pendingStudents: [pending(), pending({ dbId: 'd2', name: 'Raj' })] }))

  it('removes the approved student from the queue and confirms', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await S().approveStudent('d1', 'Class 10-B', 'br1', '5000', '2026-08-01')
    expect(rpc).toHaveBeenCalledWith('approve_student', {
      p_id: 'd1', p_class: 'Class 10-B', p_branch_id: 'br1', p_fee: 5000, p_fee_due: '2026-08-01',
    })
    expect(S().pendingStudents.map(p => p.dbId)).toEqual(['d2'])
    expect(S().toast).toBe('Student approved')
  })

  it('passes a null fee when the amount is blank or zero', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await S().approveStudent('d1', '', null, '0', '')
    expect(rpc).toHaveBeenCalledWith('approve_student', expect.objectContaining({ p_fee: null, p_class: null, p_fee_due: null }))
  })

  it('keeps the student in the queue when the RPC errors', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'Not authorized' } })
    await S().approveStudent('d1', 'Class 10', null, '', '')
    expect(S().pendingStudents.map(p => p.dbId)).toEqual(['d1', 'd2'])
    expect(S().toast).toBe('Not authorized')
  })

  it('translates a permission failure that arrives as a bare SQLSTATE', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission denied for table students' } })
    await S().approveStudent('d1', 'Class 10', null, '', '')
    expect(S().pendingStudents.map(p => p.dbId)).toEqual(['d1', 'd2'])
    expect(S().toast).toBe("You don't have permission to do that. Ask the centre head.")
  })
})

describe('rejectStudent', () => {
  beforeEach(() => useDashboard.setState({ pendingStudents: [pending(), pending({ dbId: 'd2' })] }))

  it('removes the declined student and confirms', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await S().rejectStudent('d1')
    expect(rpc).toHaveBeenCalledWith('reject_student', { p_id: 'd1' })
    expect(S().pendingStudents.map(p => p.dbId)).toEqual(['d2'])
    expect(S().toast).toBe('Request declined')
  })

  it('keeps the student when the RPC errors', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'Request not found or already handled' } })
    await S().rejectStudent('d1')
    expect(S().pendingStudents.length).toBe(2)
    expect(S().toast).toBe('Request not found or already handled')
  })
})

// A student sat on "You're on the list" long after the head had approved them.
// Three separate things had to be wrong at once for that, and all three were.
describe('the promise on the waiting screen', () => {
  // The waiting screen polls every 15s, and polls with navigate=false because
  // navigate also switches on error toasts. So the poll could see the approval
  // and do nothing with it — the only working exit was tapping Check approval.
  it('leaves the waiting screen when a background poll finds the student approved', async () => {
    useDashboard.setState({ screen: 'stuPending', role: 'student', stuPending: { name: 'Neha', code: 'TUT-ABCDEFGH', centre: 'Sharma Classes' } })
    rpc.mockResolvedValueOnce({ data: { status: 'approved', student: { name: 'Neha', code: 'TUT-ABCDEFGH' } }, error: null })

    expect(await S().loadStudentByCode('TUT-ABCDEFGH', false)).toBe(true)
    expect(S().screen).toBe('stuHome')
    expect(S().stuPending).toBe(null)
  })

  it('still does not yank an approved student off the screen they are on', async () => {
    // The rule the navigate flag exists for. A focus refresh on the fees screen
    // must update the data and nothing else.
    useDashboard.setState({ screen: 'stuFees', role: 'student', stuPending: null })
    rpc.mockResolvedValueOnce({ data: { status: 'approved', student: { name: 'Neha', code: 'TUT-ABCDEFGH' } }, error: null })

    await S().loadStudentByCode('TUT-ABCDEFGH', false)
    expect(S().screen).toBe('stuFees')
  })

  // Nothing told the student they were in. Approval sent no push at all.
  it('notifies the student when the head approves them', async () => {
    useDashboard.setState({ pendingStudents: [pending()] })
    rpc.mockResolvedValueOnce({ data: null, error: null })

    await S().approveStudent('d1', 'Class 10', null, '', '')
    expect(sendPush).toHaveBeenCalledWith(expect.objectContaining({ studentCodes: ['TUT-ABCDEFGH'] }))
  })

  it('does not tell the student they are approved when the approval failed', async () => {
    useDashboard.setState({ pendingStudents: [pending()] })
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'Not authorized' } })

    await S().approveStudent('d1', 'Class 10', null, '', '')
    expect(sendPush).not.toHaveBeenCalled()
  })

  // And it could not have been delivered anyway: the only thing that ever
  // subscribed a pending student was the "turn on reminders" gate screen,
  // which is skipped on any device that already granted permission.
  it('subscribes a student who is still waiting for approval', async () => {
    // pushSupported() is what guards this in the browser, and it already
    // checks Notification exists — the mock above bypasses that, so stand one up.
    vi.stubGlobal('Notification', { permission: 'granted' })
    supported.on = true
    useDashboard.setState({ screen: 'stuPending', role: 'student' })
    rpc.mockResolvedValueOnce({ data: { status: 'pending', student: { name: 'Neha', code: 'TUT-ABCDEFGH' } }, error: null })

    await S().loadStudentByCode('TUT-ABCDEFGH', false)
    expect(enablePush).toHaveBeenCalledWith('student', 'TUT-ABCDEFGH')
  })

  it('does not subscribe when the browser cannot do push at all', async () => {
    supported.on = false
    rpc.mockResolvedValueOnce({ data: { status: 'pending', student: { name: 'Neha', code: 'TUT-ABCDEFGH' } }, error: null })

    await S().loadStudentByCode('TUT-ABCDEFGH', false)
    expect(enablePush).not.toHaveBeenCalled()
  })
})
