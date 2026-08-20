import { supabase } from '../../lib/supabase'
import { dbErr } from '../db'
import { isoDay } from '../format'
import type { Slice } from '../slice'
import type { AssignmentItem, BatchItem, BranchItem, SubjectItem } from '../types'

type Keys =
  | 'saveAssignment' | 'addBranch' | 'deleteBranch'
  | 'addSubject' | 'deleteSubject' | 'addBatch' | 'deleteBatch'

export const createAcademicsSlice: Slice<Keys> = (set, get) => ({
  saveAssignment: (title, subject, klass, dueDate, instructions) => {
    if (!title.trim()) { get().notify('Enter a title'); return }
    const { assignmentsList, subjects } = get()
    const d = new Date(dueDate || Date.now())
    const item: AssignmentItem = {
      title, klass, due: `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`,
      submitted: 0, total: get().students.filter(s => s.klass.includes(klass.replace('Class ', ''))).length,
    }
    const subjectId = subjects.find(s => s.name === subject)?.dbId
    supabase.from('assignments').insert({
      title, class: klass, due_date: isoDay(d),
      instructions: instructions || null, subject_id: subjectId ?? null,
    }).then(dbErr('save assignment', get().notify))
    set({ assignmentsList: [item, ...assignmentsList] })
    get().notifyClass(klass, 'New homework', `${title} — due ${item.due}`, 'homework')
    get().notify('Assignment created · class notified')
  },

  addBranch: (name, address, isMain) => {
    const { branchesList } = get()
    const branch: BranchItem = { name, address, main: isMain, students: 0, staff: 0 }
    supabase.from('branches').insert({ name, address, is_main: isMain }).select().single()
      .then(({ data }) => {
        if (data) set((s) => ({ branchesList: s.branchesList.map(b => b.name === name && !b.dbId ? { ...b, dbId: data.id } : b) }))
      })
    set({ branchesList: [branch, ...branchesList] })
    get().notify('Branch added')
  },

  deleteBranch: (dbId) => {
    set((s) => ({ branchesList: s.branchesList.filter(b => b.dbId !== dbId) }))
    supabase.from('branches').delete().eq('id', dbId).then(dbErr('delete branch', get().notify))
    get().notify('Branch removed')
  },

  addSubject: (name) => {
    const { subjects: list } = get()
    if (list.some(s => s.name.toLowerCase() === name.toLowerCase())) { get().notify('Subject already exists'); return }
    const item: SubjectItem = { name, dbId: '' }
    supabase.from('subjects').insert({ name }).select().single()
      .then(({ data }) => {
        if (data) set((s) => ({ subjects: s.subjects.map(x => x.name === name && !x.dbId ? { ...x, dbId: data.id } : x) }))
      })
    set({ subjects: [...list, item] })
    get().notify(`Subject "${name}" added`)
  },

  deleteSubject: (dbId) => {
    const name = get().subjects.find(x => x.dbId === dbId)?.name
    // Remove everywhere: the subject row (DB cascades its tests/results;
    // assignments keep the record but drop the subject label) plus any
    // timetable periods that reference it by name.
    set((s) => ({
      subjects: s.subjects.filter(x => x.dbId !== dbId),
      timetableData: Object.fromEntries(Object.entries(s.timetableData).map(([d, rows]) => [d, rows.filter(p => p[2] !== name)])),
      schedule: s.schedule.filter(c => c.subject !== name),
    }))
    supabase.from('subjects').delete().eq('id', dbId).then(dbErr('delete subject', get().notify))
    if (name) supabase.from('timetable').delete().eq('subject', name).then(dbErr('remove periods', get().notify))
    get().notify('Subject removed everywhere')
  },

  addBatch: (name) => {
    const { batches: list } = get()
    if (list.some(b => b.name.toLowerCase() === name.toLowerCase())) { get().notify('Batch already exists'); return }
    const item: BatchItem = { name, dbId: '' }
    supabase.from('batches').insert({ name }).select().single()
      .then(({ data }) => {
        if (data) set((s) => ({ batches: s.batches.map(x => x.name === name && !x.dbId ? { ...x, dbId: data.id } : x) }))
      })
    set({ batches: [...list, item] })
    get().notify(`Batch "${name}" added`)
  },

  deleteBatch: (dbId) => {
    // Remove the batch row only. Students already assigned keep their batch
    // label (historical); the head can reassign them from the roster if needed.
    set((s) => ({ batches: s.batches.filter(x => x.dbId !== dbId) }))
    supabase.from('batches').delete().eq('id', dbId).then(dbErr('delete batch', get().notify))
    get().notify('Batch removed')
  },
})
