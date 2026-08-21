import { supabase } from '../../lib/supabase'
import { enablePush, pushSupported, sendPush } from '../../lib/push'
import { genStudentCode } from '../codes'
import { dbErr } from '../db'
import { isoDay } from '../format'
import { LIMITS, capLength, clampText } from '../validate'
import type { Slice } from '../slice'
import { mapSnapshot } from '../snapshot'
import type { State, Student, Tab } from '../types'

type Keys =
  | 'setStudentField' | 'setNewStudent' | 'setStuSignup' | 'studentSignup'
  | 'deleteStudent' | 'addStudent' | 'approveStudent' | 'rejectStudent'
  | 'loadStudentByCode'

export const createStudentsSlice: Slice<Keys> = (set, get) => ({
  // Free text is capped here rather than at each input, because this is the
  // single door every roster edit goes through. Without it a 500-character
  // name propagated into fees, results, rankings, the timetable and the
  // student's own dashboard, breaking every layout it touched.
  setStudentField: (patch) => set((s) => {
    const capped = {
      ...patch,
      ...(patch.name   !== undefined && { name:   capLength(patch.name,   LIMITS.name) }),
      ...(patch.klass  !== undefined && { klass:  capLength(patch.klass,  LIMITS.klass) }),
      ...(patch.school !== undefined && { school: capLength(patch.school, LIMITS.school) }),
      ...(patch.parent !== undefined && { parent: capLength(patch.parent, LIMITS.parent) }),
    }
    const arr = [...s.students]; arr[s.editIndex] = { ...arr[s.editIndex], ...capped }
    const updated = arr[s.editIndex]
    if (updated.dbId) {
      supabase.from('students').update({
        name: updated.name, class: updated.klass, school: updated.school,
        parent_contact: updated.parent, fee_status: updated.feeStatus,
      }).eq('id', updated.dbId).then(dbErr('update student', get().notify))
    }
    return { students: arr }
  }),

  setNewStudent: (patch) => set((s) => ({ newStudent: { ...s.newStudent, ...patch } })),
  setStuSignup: (patch) => set((s) => ({ stuSignup: { ...s.stuSignup, ...patch } })),

  // Student self-registration. The RPC validates the centre join code + required
  // fields (name, parent, class, school), mints a code, and inserts a PENDING
  // student the head must approve. On success we land the student on the waiting
  // screen with their code (they save it now; it only works once approved).
  studentSignup: async () => {
    const { stuSignup: f } = get()
    if (f.name.trim().length < 2) { get().notify('Enter your full name'); return }
    if (!/^\+?\d[\d\s\-]{6,}$/.test(f.parent.trim())) { get().notify('Enter a valid parent phone number'); return }
    if (!f.klass.trim()) { get().notify('Select your class'); return }
    if (f.school.trim().length < 2) { get().notify('Enter your school name'); return }
    const { data, error } = await supabase.rpc('student_signup', {
      p_join_code: f.joinCode.trim(),
      p_name: clampText(f.name, LIMITS.name),
      p_parent: clampText(f.parent, LIMITS.parent),
      p_class: clampText(f.klass, LIMITS.klass),
      p_school: clampText(f.school, LIMITS.school),
      p_address: clampText(f.address, LIMITS.address) || null,
    })
    if (error || !data) { get().notify(error?.message || 'Could not register — check the centre code'); return }
    const d = data as { code: string; name: string; centre: string }
    if (typeof window !== 'undefined') localStorage.setItem('student_code', d.code)
    // Let the head know a request is waiting (best-effort push).
    sendPush({ notifyHead: true, title: 'New student request', body: `${d.name} has requested to join. Review and approve.` }).catch(() => {})
    set({
      stuPending: { name: d.name, code: d.code, centre: d.centre },
      stuSignup: { joinCode: '', name: '', parent: '', klass: 'Class 10', school: '', address: '' },
      role: 'student', staffStatus: 'none', screen: 'stuPending', tab: 'stuHome', authLoading: false,
    })
  },

  // Deleting a student cascades their attendance, results, fees and notes, so
  // this is the most destructive action in the app. It waits for the delete to
  // land before touching the roster — the previous version removed the row and
  // said "Student removed" immediately, so a failed delete left the head
  // believing a student was gone while every record was still in the database.
  deleteStudent: async () => {
    const { editIndex, students } = get()
    const student = students[editIndex]
    if (student?.dbId) {
      const { error } = await supabase.from('students').delete().eq('id', student.dbId)
      if (error) { get().notify('Could not remove student — nothing was deleted'); return }
    }
    set((s) => ({ students: s.students.filter((_, i) => i !== editIndex), editIndex: 0 }))
    get().notify('Student removed'); get().back()
  },

  addStudent: () => {
    const { newStudent: raw, students, branchesList } = get()
    if (!raw.name.trim()) { get().notify('Enter student name'); return }
    if (!raw.parent.trim()) { get().notify('Enter parent contact'); return }
    if (raw.parent && !/^\+?\d[\d\s\-]{6,}$/.test(raw.parent)) { get().notify('Invalid phone number'); return }
    const ns = {
      ...raw,
      name: clampText(raw.name, LIMITS.name),
      klass: clampText(raw.klass, LIMITS.klass),
      school: clampText(raw.school, LIMITS.school),
      parent: clampText(raw.parent, LIMITS.parent),
      address: clampText(raw.address, LIMITS.address),
    }
    let code = genStudentCode()
    while (students.some(s => s.id === code)) code = genStudentCode()
    const student: Student = {
      name: ns.name, klass: ns.klass, batch: ns.batch || undefined, attendance: 0,
      feeStatus: 'Due', school: ns.school, parent: ns.parent, id: code,
    }
    const branchId = ns.branch ? branchesList.find(b => b.name.includes(ns.branch))?.dbId : null
    supabase.from('students').insert({
      name: ns.name, class: student.klass, batch: ns.batch || null, school: ns.school,
      parent_contact: ns.parent, student_code: code, fee_status: 'Due',
      address: ns.address, branch_id: branchId ?? null,
    }).select().single().then(({ data, error }) => {
      if (error) { get().notify('Could not save student — check connection'); return }
      if (data) {
        set((s) => ({ students: s.students.map(x => x.id === code && !x.dbId ? { ...x, dbId: data.id } : x) }))
        // Optional enrolment fee — creates the first fee record so the student
        // immediately sees what's due (keeps status and fee records in sync).
        const amt = Number(ns.fee)
        if (amt > 0) {
          const period = new Date().toLocaleString('en', { month: 'short', year: 'numeric' })
          supabase.from('fees').insert({ student_id: data.id, amount: amt, period, due_date: ns.feeDue || isoDay(), status: 'Due' }).then(dbErr('add enrolment fee', get().notify))
        }
      }
    })
    set({ students: [student, ...students], newStudent: { name: '', school: '', klass: 'Class 10', batch: '', branch: '', parent: '', address: '', fee: '', feeDue: '' }, lastAdded: { code, name: ns.name, parent: ns.parent } })
  },

  approveStudent: async (dbId, klass, branchId, fee, feeDue, batch) => {
    const amt = Number(fee)
    const { error } = await supabase.rpc('approve_student', {
      p_id: dbId,
      p_class: klass.trim() || null,
      p_branch_id: branchId,
      p_fee: fee.trim() && amt > 0 ? amt : null,
      p_fee_due: feeDue || null,
    })
    if (error) { get().notify(error.message || 'Could not approve'); return }
    // Batch isn't part of the approve RPC — persist it directly (RLS scopes the
    // update to the head's own centre). Non-blocking; roster refresh follows.
    if (batch && batch.trim()) {
      await supabase.from('students').update({ batch: batch.trim() }).eq('id', dbId)
    }
    set((s) => ({ pendingStudents: s.pendingStudents.filter(p => p.dbId !== dbId) }))
    get().notify('Student approved')
    await get().refreshData()
  },

  rejectStudent: async (dbId) => {
    const { error } = await supabase.rpc('reject_student', { p_id: dbId })
    if (error) { get().notify(error.message || 'Could not decline'); return }
    set((s) => ({ pendingStudents: s.pendingStudents.filter(p => p.dbId !== dbId) }))
    get().notify('Request declined')
  },

  loadStudentByCode: async (code, navigate = true) => {
    const trimmed = code.trim()
    if (trimmed.length < 4) { if (navigate) get().notify('Enter your code'); return false }
    const { data, error } = await supabase.rpc('get_student_snapshot', { p_code: trimmed })
    if (error || !data) {
      // Distinguish a transient throttle from a genuinely dead code.
      const throttled = error?.message?.includes('Too many')
      // A code that resolves to nothing is dead (deleted/never valid). Drop it
      // so it stops re-firing "Invalid code" on every launch — this is what
      // hijacks a head's device when a stale test code is left in storage.
      // Never clear on a rate-limit: the code may be perfectly valid.
      if (!throttled && typeof window !== 'undefined') localStorage.removeItem('student_code')
      if (navigate) get().notify(throttled ? error!.message : 'Invalid code — check with your teacher')
      return false
    }
    const snap = data as { status?: string; student?: { name?: string; code?: string } }

    // Awaiting the head's approval — hold on the waiting screen (no dashboard data).
    if (snap.status === 'pending') {
      if (typeof window !== 'undefined') localStorage.setItem('student_code', trimmed)
      set({
        stuPending: { name: snap.student?.name ?? '', code: snap.student?.code ?? trimmed, centre: get().stuPending?.centre ?? '' },
        stuDenied: null,
        role: 'student', staffStatus: 'none', screen: 'stuPending', tab: 'stuHome', authLoading: false,
      })
      return false
    }

    // Request declined (or any non-approved state) — send the student to a clear
    // "declined" screen instead of leaving them on the hopeful waiting page. Drop
    // the saved code so a returning device doesn't silently retry it. This runs on
    // background polls too, so a live decline flips the screen immediately.
    if (snap.status && snap.status !== 'approved') {
      const prev = get().stuPending
      if (typeof window !== 'undefined') localStorage.removeItem('student_code')
      set({
        stuDenied: { name: prev?.name ?? snap.student?.name ?? '', centre: prev?.centre ?? '' },
        stuPending: null,
        role: 'student', staffStatus: 'none', screen: 'stuDenied', tab: 'stuHome', authLoading: false,
      })
      return false
    }

    if (typeof window !== 'undefined') localStorage.setItem('student_code', trimmed)
    const patch: Partial<State> = mapSnapshot(data)
    // Only navigate on the initial load; a background (focus) refresh just
    // updates the data and must not yank the student off their current screen.
    if (navigate) {
      Object.assign(patch, {
        role: 'student', staffStatus: 'none', screen: 'stuHome', tab: 'stuHome' as Tab,
        authLoading: false, stuPending: null, stuDenied: null, stuRankSubject: Object.keys(patch.rankData ?? {})[0] ?? '',
      })
      // Auto-prompt for push on login so students don't have to hunt for a
      // button. enablePush is idempotent and stays silent once permission is
      // decided (granted → re-subscribes, denied → no dialog); skip when denied
      // and swallow failures so a blocked prompt never disrupts login.
      if (pushSupported() && Notification.permission !== 'denied') enablePush('student', trimmed).catch(() => {})
    }
    set(patch)
    return true
  },
})
