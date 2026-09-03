import { describe, it, expect } from 'vitest'
import { changedMarks, writeOrder } from '../app/lib/results-edit'

describe('changedMarks', () => {
  it('writes a mark that was corrected', () => {
    expect(changedMarks('t1', [{ studentId: 's1', typed: '54', published: 45 }]))
      .toEqual([{ test_id: 't1', student_id: 's1', marks: 54 }])
  })

  it('writes a mark for a student who had none', () => {
    expect(changedMarks('t1', [{ studentId: 's1', typed: '30', published: null }]))
      .toEqual([{ test_id: 't1', student_id: 's1', marks: 30 }])
  })

  it('leaves an unchanged mark out of the write', () => {
    expect(changedMarks('t1', [{ studentId: 's1', typed: '45', published: 45 }])).toEqual([])
  })

  // The rule that makes this an edit and not a delete.
  it('treats a cleared box as untouched, never as a removal', () => {
    expect(changedMarks('t1', [{ studentId: 's1', typed: '', published: 45 }])).toEqual([])
    expect(changedMarks('t1', [{ studentId: 's1', typed: '   ', published: 45 }])).toEqual([])
  })

  it('keeps a zero, which is a real mark', () => {
    expect(changedMarks('t1', [{ studentId: 's1', typed: '0', published: 45 }]))
      .toEqual([{ test_id: 't1', student_id: 's1', marks: 0 }])
  })

  it('picks only the rows that moved out of a whole class', () => {
    expect(changedMarks('t1', [
      { studentId: 's1', typed: '45', published: 45 },
      { studentId: 's2', typed: '38', published: 83 },
      { studentId: 's3', typed: '', published: 12 },
    ])).toEqual([{ test_id: 't1', student_id: 's2', marks: 38 }])
  })
})

describe('writeOrder', () => {
  it('raises the maximum before the marks that need the room', () => {
    expect(writeOrder(50, 100)).toBe('test-first')
  })

  it('brings the marks down before lowering the maximum under them', () => {
    expect(writeOrder(100, 50)).toBe('marks-first')
  })

  it('does not care which way round when the maximum is unchanged', () => {
    expect(writeOrder(50, 50)).toBe('test-first')
  })
})
