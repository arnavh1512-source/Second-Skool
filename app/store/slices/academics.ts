import { supabase } from '../../lib/supabase'
import { isoDay, parseDay } from '../format'
import { LIMITS, clampText } from '../validate'
import type { Slice } from '../slice'
import type { AssignmentItem, BatchItem, BranchItem, SubjectItem } from '../types'

type Keys =
  | 'saveAssignment' | 'deleteAssignment' | 'addBranch' | 'deleteBranch'
  | 'addSubject' | 'deleteSubject' | 'addBatch' | 'deleteBatch'

// Every action here awaits its write and only then touches state. The previous
// version fired the query, updated the list and toasted success in the same
// tick, so a rejected insert (offline, RLS, duplicate) still showed "added" and
// left a row that existed only on screen until the next refresh removed it.
// A head who saw "Branch added" had no way to know it had not been.
export const createAcademicsSlice: Slice<Keys> = (set, get) => ({
  saveAssignment: async (title, subject, klass, dueDate, instructions) => {
    if (!title.trim()) { get().notify('Enter a title', 'error'); return false }
    // Was `new Date(dueDate || Date.now())`: leaving the date blank silently
    // set the homework due today and reported success. A teacher who tabbed
    // past the field told a class their work was due in a few hours.
    const d = parseDay(dueDate)
    if (!d) { get().notify('Pick a due date', 'error'); return false }
    const { subjects } = get()
    const item: AssignmentItem = {
      title, klass, due: `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`,
      // Exact match, like the refresh path and the database function both use.
      // `includes` on the bare number meant "Class 1" also counted Class 10,
      // 11 and 12, so the submitted-out-of count changed the moment the page
      // was refreshed and the real figure replaced it.
      submitted: 0, total: get().students.filter(s => s.klass === klass).length,
    }
    const subjectId = subjects.find(s => s.name === subject)?.dbId

    // Take the id back: without it the new assignment renders with no delete
    // button (it is gated on dbId) until the next full refresh.
    const { data, error } = await supabase.from('assignments').insert({
      title: clampText(title, LIMITS.title), class: klass, due_date: isoDay(d),
      instructions: instructions || null, subject_id: subjectId ?? null,
    }).select('id').single()
    if (error || !data) { get().notify('Could not create assignment — check your connection', 'error'); return false }

    set((s) => ({ assignmentsList: [{ ...item, dbId: data.id as string }, ...s.assignmentsList] }))
    // Only notify the class once the homework actually exists for them to open.
    await get().notifyClass(klass, 'New homework', `${title} — due ${item.due}`, 'homework')
    get().notify('Assignment created · class notified')
    return true
  },

  // Homework outlives the students it was set for: the class roster is
  // recomputed from whoever is in the class today, so deleting a student drops
  // an assignment to "0 students" and leaves it on the teacher's screen with no
  // way to clear it. Old assignments accumulated forever.
  deleteAssignment: async (dbId) => {
    const { error } = await supabase.from('assignments').delete().eq('id', dbId)
    if (error) { get().notify('Could not remove assignment', 'error'); return }
    set((s) => ({ assignmentsList: s.assignmentsList.filter(a => a.dbId !== dbId) }))
    get().notify('Assignment removed')
  },

  addBranch: async (name, address, isMain) => {
    const branch: BranchItem = { name, address, main: isMain, students: 0, staff: 0 }
    const { data, error } = await supabase
      .from('branches').insert({ name, address, is_main: isMain }).select().single()
    if (error || !data) { get().notify('Could not add branch — check your connection', 'error'); return false }

    set((s) => ({ branchesList: [{ ...branch, dbId: data.id }, ...s.branchesList] }))
    get().notify('Branch added')
    return true
  },

  deleteBranch: async (dbId) => {
    const { error } = await supabase.from('branches').delete().eq('id', dbId)
    if (error) { get().notify('Could not remove branch', 'error'); return }
    set((s) => ({ branchesList: s.branchesList.filter(b => b.dbId !== dbId) }))
    get().notify('Branch removed')
  },

  addSubject: async (name) => {
    if (get().subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) { get().notify('Subject already exists', 'error'); return false }
    const { data, error } = await supabase.from('subjects').insert({ name }).select().single()
    if (error || !data) { get().notify('Could not add subject — check your connection', 'error'); return false }

    const item: SubjectItem = { name, dbId: data.id }
    set((s) => ({ subjects: [...s.subjects, item] }))
    get().notify(`Subject "${name}" added`)
    return true
  },

  deleteSubject: async (dbId) => {
    const name = get().subjects.find(x => x.dbId === dbId)?.name
    // Remove everywhere: the subject row (DB cascades its tests/results;
    // assignments keep the record but drop the subject label) plus any
    // timetable periods that reference it by name. The subject row goes first —
    // if it fails there is nothing to reconcile and the UI is left untouched.
    const { error } = await supabase.from('subjects').delete().eq('id', dbId)
    if (error) { get().notify('Could not remove subject', 'error'); return }
    if (name) {
      const { error: periodErr } = await supabase.from('timetable').delete().eq('subject', name)
      // The subject is already gone, so this is a partial failure, not a total
      // one. Say so rather than claiming a clean removal.
      if (periodErr) get().notify('Subject removed, but its timetable periods could not be cleared', 'error')
    }

    set((s) => ({
      subjects: s.subjects.filter(x => x.dbId !== dbId),
      timetableData: Object.fromEntries(Object.entries(s.timetableData).map(([d, rows]) => [d, rows.filter(p => p[2] !== name)])),
      schedule: s.schedule.filter(c => c.subject !== name),
    }))
    get().notify('Subject removed everywhere')
  },

  addBatch: async (name) => {
    if (get().batches.some(b => b.name.toLowerCase() === name.toLowerCase())) { get().notify('Batch already exists', 'error'); return false }
    const { data, error } = await supabase.from('batches').insert({ name }).select().single()
    if (error || !data) { get().notify('Could not add batch — check your connection', 'error'); return false }

    const item: BatchItem = { name, dbId: data.id }
    set((s) => ({ batches: [...s.batches, item] }))
    get().notify(`Batch "${name}" added`)
    return true
  },

  deleteBatch: async (dbId) => {
    // Remove the batch row only. Students already assigned keep their batch
    // label (historical); the head can reassign them from the roster if needed.
    const { error } = await supabase.from('batches').delete().eq('id', dbId)
    if (error) { get().notify('Could not remove batch', 'error'); return }
    set((s) => ({ batches: s.batches.filter(x => x.dbId !== dbId) }))
    get().notify('Batch removed')
  },
})
