import { describe, it, expect } from 'vitest'
import { studentKey, findStudent, indexOfStudent, teacherKey } from '../app/lib/student-key'

// The roster as the app actually holds it: ordered created_at DESC, so the
// newest student is at index 0 and every earlier student sits one slot further
// down than they did a moment ago.
const roster = [
  { id: 'SS-0003', dbId: 'uuid-c', name: 'Chirag' },
  { id: 'SS-0002', dbId: 'uuid-b', name: 'Bhavna' },
  { id: 'SS-0001', dbId: 'uuid-a', name: 'Anita' },
]

/** What a background refresh does: a new student lands at the front. */
const afterNewStudent = [{ id: 'SS-0004', dbId: 'uuid-d', name: 'Deepak' }, ...roster]

describe('studentKey', () => {
  it('prefers the database id, which is what every write is keyed on', () => {
    expect(studentKey({ id: 'SS-0001', dbId: 'uuid-a' })).toBe('uuid-a')
  })

  // A student added seconds ago has no uuid until the insert returns, but they
  // are already on screen and already tappable.
  it('falls back to the student code before the insert returns', () => {
    expect(studentKey({ id: 'SS-0009' })).toBe('SS-0009')
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['an empty object', {}],
  ])('returns an empty key for %s rather than throwing', (_label, input) => {
    expect(studentKey(input)).toBe('')
  })
})

describe('findStudent', () => {
  // The whole point: the key survives the reorder, an index does not.
  it('finds the same student after a refresh has shifted every position', () => {
    const key = studentKey(roster[0])
    expect(roster[0].name).toBe('Chirag')
    expect(afterNewStudent[0].name).toBe('Deepak')
    expect(findStudent(afterNewStudent, key)?.name).toBe('Chirag')
  })

  it('finds a student by their code when they have no database id yet', () => {
    const pending = [{ id: 'SS-0007', name: 'Esha' }, ...roster]
    expect(findStudent(pending, 'SS-0007')?.name).toBe('Esha')
  })

  // Deleted on another device, or their approval revoked between renders.
  it('returns undefined when the student has gone, so callers can bail out', () => {
    expect(findStudent(roster, 'uuid-gone')).toBeUndefined()
  })

  it.each([
    ['an empty key', ''],
    ['a key on an empty roster', 'uuid-a'],
  ])('returns undefined for %s', (label, key) => {
    expect(findStudent(label === 'an empty key' ? roster : [], key)).toBeUndefined()
  })

  it('never resolves an empty key to the student whose key is also empty', () => {
    expect(findStudent([{ name: 'Nameless' } as never], '')).toBeUndefined()
  })
})

describe('indexOfStudent', () => {
  it('tracks the moving position of a remembered student', () => {
    const key = studentKey(roster[2])
    expect(indexOfStudent(roster, key)).toBe(2)
    expect(indexOfStudent(afterNewStudent, key)).toBe(3)
  })

  it('returns -1 when the student has gone, so callers cannot index blindly', () => {
    expect(indexOfStudent(roster, 'uuid-gone')).toBe(-1)
    expect(indexOfStudent(roster, '')).toBe(-1)
  })
})

describe('teacherKey', () => {
  it('prefers the database id', () => {
    expect(teacherKey({ dbId: 'uuid-t', name: 'Shirly' })).toBe('uuid-t')
  })

  // Teacher rows carry no code, so the name is all that is left.
  it('falls back to the name', () => {
    expect(teacherKey({ name: 'Shirly' })).toBe('Shirly')
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
  ])('returns an empty key for %s', (_label, input) => {
    expect(teacherKey(input)).toBe('')
  })
})

// The defect these helpers exist to kill, stated as a test: mark by position and
// a refresh moves the mark onto someone else; mark by key and it stays put.
describe('marks survive a roster reorder', () => {
  it('an index-keyed absence lands on the wrong student after a refresh', () => {
    const byIndex: Record<number, string> = { 0: 'absent' }
    expect(roster[0].name).toBe('Chirag')
    expect(afterNewStudent[0].name).toBe('Deepak')
    // Same record, same lookup, different child.
    expect(byIndex[0]).toBe('absent')
    expect(afterNewStudent[0].name).not.toBe('Chirag')
  })

  it('a key-keyed absence stays on the student it was given to', () => {
    const byKey: Record<string, string> = { [studentKey(roster[0])]: 'absent' }
    for (const list of [roster, afterNewStudent]) {
      const marked = list.filter(s => byKey[studentKey(s)] === 'absent')
      expect(marked.map(s => s.name)).toEqual(['Chirag'])
    }
  })
})
