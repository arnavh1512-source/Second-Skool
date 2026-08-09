import { describe, it, expect, beforeEach } from 'vitest'
import { useDashboard } from '../app/store'

// These exercise the pure state transitions (no network) that decide what the
// user sees right after auth, plus the attendance-class regression fix.

const reset = () => useDashboard.setState({ attClass: '', students: [], screen: 'home', role: 'admin', staffStatus: 'approved' })

describe('setAuth landing screen', () => {
  beforeEach(reset)

  // Every staff member now passes a details gate ahead of the status routing,
  // so these cases hand over a completed profile. The gate itself is covered
  // by the block at the bottom.
  const done = { done: true }

  it('sends an approved head/admin to home', () => {
    useDashboard.getState().setAuth('u1', 'admin', 'a@x.com', 'approved', true, done)
    expect(useDashboard.getState().screen).toBe('home')
    expect(useDashboard.getState().role).toBe('admin')
  })

  it('sends an approved teacher to home', () => {
    useDashboard.getState().setAuth('u2', 'teacher', 't@x.com', 'approved', true, done)
    expect(useDashboard.getState().screen).toBe('home')
  })

  it('sends a pending teacher to the pending screen', () => {
    useDashboard.getState().setAuth('u3', 'teacher', 't@x.com', 'pending', true, done)
    expect(useDashboard.getState().screen).toBe('pending')
  })

  it('sends a rejected user to the denied screen', () => {
    useDashboard.getState().setAuth('u4', 'teacher', 't@x.com', 'rejected', true, done)
    expect(useDashboard.getState().screen).toBe('denied')
  })

  it('sends an unregistered signed-in user to register', () => {
    useDashboard.getState().setAuth('u5', 'student', 's@x.com', 'none', true, done)
    expect(useDashboard.getState().screen).toBe('register')
  })

  it('always clears the auth splash loader', () => {
    useDashboard.setState({ authLoading: true })
    useDashboard.getState().setAuth('u6', 'admin', 'a@x.com', 'approved', true, done)
    expect(useDashboard.getState().authLoading).toBe(false)
  })

  it('stores every profile detail for the profile screen', () => {
    useDashboard.getState().setAuth('u7', 'admin', 'a@x.com', 'approved', true, {
      name: 'Arnav Hendre', phone: '+91 90000 00000', subject: 'Physics', qualification: 'M.Sc.', done: true,
    })
    const s = useDashboard.getState()
    expect(s.myName).toBe('Arnav Hendre')
    expect(s.myPhone).toBe('+91 90000 00000')
    expect(s.mySubject).toBe('Physics')
    expect(s.myQualification).toBe('M.Sc.')
  })

  it('defaults the profile fields to empty when not provided', () => {
    useDashboard.getState().setAuth('u8', 'teacher', 't@x.com', 'approved', true, done)
    const s = useDashboard.getState()
    expect(s.myName).toBe('')
    expect(s.myPhone).toBe('')
    expect(s.mySubject).toBe('')
    expect(s.myQualification).toBe('')
  })

  // The gate has to beat every status branch except 'rejected'. A teacher
  // waiting for approval still owes the head a name and a number — that join
  // request is unactionable without them.
  it('sends a staff member with no saved details to the setup screen', () => {
    useDashboard.getState().setAuth('u9', 'student', 's@x.com', 'none', true)
    expect(useDashboard.getState().screen).toBe('profileSetup')
    expect(useDashboard.getState().profileDone).toBe(false)
  })

  it('gates a pending teacher on their details too', () => {
    useDashboard.getState().setAuth('u10', 'teacher', 't@x.com', 'pending', true)
    expect(useDashboard.getState().screen).toBe('profileSetup')
  })

  it('gates an approved member whose profile predates the details fields', () => {
    useDashboard.getState().setAuth('u11', 'admin', 'a@x.com', 'approved', true)
    expect(useDashboard.getState().screen).toBe('profileSetup')
  })

  it('never gates a rejected user — there is nothing for them to complete', () => {
    useDashboard.getState().setAuth('u12', 'teacher', 't@x.com', 'rejected', true)
    expect(useDashboard.getState().screen).toBe('denied')
  })
})

describe('loadStudents', () => {
  beforeEach(reset)

  it('defaults attClass to the first student class when none is set', () => {
    useDashboard.getState().loadStudents([{ id: 'TUT-1', name: 'A', klass: 'Class 10', attendance: 0, feeStatus: 'Due', school: '', parent: '' }])
    expect(useDashboard.getState().attClass).toBe('Class 10')
  })

  it('preserves an existing attClass across a refresh (regression)', () => {
    useDashboard.setState({ attClass: 'Class 9' })
    useDashboard.getState().loadStudents([{ id: 'TUT-1', name: 'A', klass: 'Class 10', attendance: 0, feeStatus: 'Due', school: '', parent: '' }])
    expect(useDashboard.getState().attClass).toBe('Class 9')
  })

  it('leaves attClass empty when there are no students', () => {
    useDashboard.getState().loadStudents([])
    expect(useDashboard.getState().attClass).toBe('')
  })
})
