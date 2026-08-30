import { describe, it, expect } from 'vitest'
import { resolveBatch, parseQueue, queuedMarkCount, type QueuedBatch } from '../app/lib/att-queue'

const mark = (studentId: string, status: 'Present' | 'Absent', name = studentId) =>
  ({ studentId, code: `TUT-${studentId}`, name, status })

const batch = (marks: QueuedBatch['marks'], date = '2026-08-31'): QueuedBatch =>
  ({ id: 'b1', date, marks })

describe('resolveBatch', () => {
  it('writes every mark when the register is empty', () => {
    const r = resolveBatch(batch([mark('s1', 'Present'), mark('s2', 'Absent')]), [])
    expect(r.rows).toEqual([
      { student_id: 's1', date: '2026-08-31', status: 'Present' },
      { student_id: 's2', date: '2026-08-31', status: 'Absent' },
    ])
    expect(r.conflicts).toEqual([])
  })

  it('files under the day she marked, not the day it drains', () => {
    // A register queued on Tuesday evening and synced on Wednesday morning is
    // Tuesday's. Filing it under Wednesday would mark a class that never met.
    const r = resolveBatch(batch([mark('s1', 'Absent')], '2026-08-25'), [])
    expect(r.rows[0].date).toBe('2026-08-25')
  })

  it('never overwrites a mark that is already there', () => {
    // Hers was made offline, so it never reached the server; anything standing
    // was written by someone who was online after she lost signal.
    const r = resolveBatch(batch([mark('s1', 'Absent', 'Riya')]), [{ student_id: 's1', status: 'Present' }])
    expect(r.rows).toEqual([])
    expect(r.conflicts).toEqual([{ name: 'Riya', date: '2026-08-31', mine: 'Absent', theirs: 'Present' }])
  })

  it('says nothing when the register already agrees', () => {
    // Two people marking the same child absent is not a disagreement, and a
    // conflict list padded with non-conflicts is a list she stops reading.
    const r = resolveBatch(batch([mark('s1', 'Absent')]), [{ student_id: 's1', status: 'Absent' }])
    expect(r.rows).toEqual([])
    expect(r.conflicts).toEqual([])
  })

  it('applies the rest of the batch around a conflict', () => {
    // The whole point: one disputed child must not cost her the other 39.
    const r = resolveBatch(
      batch([mark('s1', 'Absent', 'Riya'), mark('s2', 'Present'), mark('s3', 'Absent')]),
      [{ student_id: 's1', status: 'Present' }],
    )
    expect(r.rows.map(x => x.student_id)).toEqual(['s2', 's3'])
    expect(r.conflicts).toHaveLength(1)
  })

  it('reports absences only for marks that actually wrote', () => {
    // A parent must not get "marked absent today" for a mark the register
    // refused — that is a push about something the app did not do.
    const r = resolveBatch(
      batch([mark('s1', 'Absent', 'Riya'), mark('s2', 'Absent', 'Aditya')]),
      [{ student_id: 's1', status: 'Present' }],
    )
    expect(r.absent.map(m => m.name)).toEqual(['Aditya'])
  })

  it('treats a status nobody expected as somebody else having answered', () => {
    // The column also allows 'Leave', which this screen cannot produce. A value
    // she cannot have written is by definition not hers to overwrite.
    const r = resolveBatch(batch([mark('s1', 'Present', 'Riya')]), [{ student_id: 's1', status: 'Leave' }])
    expect(r.rows).toEqual([])
    expect(r.conflicts[0].theirs).toBe('Leave')
  })
})

describe('parseQueue', () => {
  const good = JSON.stringify([{ id: 'b1', date: '2026-08-31', marks: [mark('s1', 'Absent')] }])

  it('reads back what saveQueue writes', () => {
    expect(parseQueue(good)).toHaveLength(1)
  })

  it('survives an empty, absent or unparseable value', () => {
    for (const raw of [null, '', 'not json', '{', 'null', '42', '"a string"', '{"not":"an array"}'])
      expect(parseQueue(raw)).toEqual([])
  })

  it('drops batches of the wrong shape and keeps the good ones', () => {
    // localStorage is user-editable and outlives the build that wrote it. One
    // bad entry must not cost her the register sitting next to it.
    const raw = JSON.stringify([
      { id: 'b1', date: '2026-08-31', marks: [mark('s1', 'Absent')] },
      { id: 'b2', date: 'yesterday', marks: [] },        // date not ISO
      { id: '', date: '2026-08-31', marks: [] },          // no id
      { id: 'b4', date: '31/08/2026', marks: [] },        // date in the local format
      { id: 'b5', date: '2026-08-31' },                   // no marks
      { id: 'b6', date: '2026-08-31', marks: 'nope' },
      null,
    ])
    expect(parseQueue(raw).map(b => b.id)).toEqual(['b1'])
  })

  it('drops a batch containing a single unusable mark', () => {
    // Half a register is worse than none: she would see it sync and never know
    // which child went missing from it.
    const raw = JSON.stringify([
      { id: 'b1', date: '2026-08-31', marks: [mark('s1', 'Absent'), { studentId: 's2', status: 'Late' }] },
    ])
    expect(parseQueue(raw)).toEqual([])
  })
})

describe('queuedMarkCount', () => {
  it('counts marks rather than batches', () => {
    // "3 registers waiting" means nothing to her; "5 marks waiting" is the size
    // of what she would lose by reinstalling.
    expect(queuedMarkCount([
      batch([mark('s1', 'Present'), mark('s2', 'Absent')]),
      batch([mark('s3', 'Present'), mark('s4', 'Present'), mark('s5', 'Absent')]),
    ])).toBe(5)
  })

  it('is zero for an empty queue', () => {
    expect(queuedMarkCount([])).toBe(0)
  })
})
