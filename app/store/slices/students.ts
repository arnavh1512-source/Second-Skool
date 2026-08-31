import { supabase } from '../../lib/supabase'
import { friendlyError } from '../errors'
import { enablePush, pushSupported, sendPush, sendStudentRequestPush } from '../../lib/push'
import { genStudentCode } from '../codes'
import { writeLocal } from '../../lib/storage'
import { claimStudentDevice, clearStudentCred, hasStudentToken, readStudentCred } from '../../lib/student-cred'
import { findStudent, indexOfStudent, studentKey } from '../../lib/student-key'
import { changedNothing, NOT_SAVED } from '../db'
import { isoDay } from '../format'
import { LIMITS, capLength, clampText } from '../validate'
import type { Slice } from '../slice'
import { mapSnapshot } from '../snapshot'
import type { FeeStatus, State, Student, StudentDevice, Tab } from '../types'

// Register this device against a student code while the head has not approved
// them yet.
//
// enablePush used to run only once a student was approved (and from the
// "turn on reminders" gate screen). But that gate only appears while
// permission is un-granted — so on any device that had already allowed
// notifications once, a newly joined student was subscribed nowhere at all,
// with the app showing every sign that alerts were on. Nothing could reach
// them, including the approval push above.
//
// Only when permission is already granted: at 'default' the gate screen asks
// properly, with a reason, and firing a bare browser dialog behind it is worse
// than waiting. At 'denied' there is nothing to do.
//
// Once per code per page load. The waiting screen re-checks every 15s and this
// sits on that path, so without the guard a student staring at "You're on the
// list" writes the same subscription row four times a minute for as long as
// they wait.
let subscribed = ''
const subscribePending = (code: string) => {
  if (subscribed === code) return
  if (!pushSupported() || Notification.permission !== 'granted') return
  subscribed = code
  // A failure must not be remembered as a success — the next poll should retry.
  enablePush('student', code).then(r => { if (!r.ok) subscribed = '' }).catch(() => { subscribed = '' })
}

type Keys =
  | 'setStudentField' | 'setNewStudent' | 'setStuSignup' | 'studentSignup'
  | 'deleteStudent' | 'addStudent' | 'importStudents' | 'approveStudent' | 'rejectStudent' | 'saveStudentEdit'
  | 'loadStudentByCode'
  | 'loadStudentDevices' | 'allowStudentDevice' | 'removeStudentDevice'

export const createStudentsSlice: Slice<Keys> = (set, get) => ({
  // Free text is capped here rather than at each input, because this is the
  // single door every roster edit goes through. Without it a 500-character
  // name propagated into fees, results, rankings, the timetable and the
  // student's own dashboard, breaking every layout it touched.
  // Local only. This used to fire a full-row UPDATE on every keystroke, which
  // meant the record was already saved (repeatedly, out of order) before the
  // Save button had validated anything — and clearing the name to retype it
  // sent an empty string straight into the students_text_lengths check, so the
  // head got a database error toast mid-word. Persisting is saveStudentEdit's
  // job now.
  setStudentField: (patch) => set((s) => {
    const capped = {
      ...patch,
      ...(patch.name   !== undefined && { name:   capLength(patch.name,   LIMITS.name) }),
      ...(patch.klass  !== undefined && { klass:  capLength(patch.klass,  LIMITS.klass) }),
      ...(patch.school !== undefined && { school: capLength(patch.school, LIMITS.school) }),
      ...(patch.parent !== undefined && { parent: capLength(patch.parent, LIMITS.parent) }),
    }
    // Resolve the student being edited by identity, not by position. The roster
    // reorders under an open edit screen on every background refresh, and the
    // WhatsApp share button lives on that very screen, so losing and regaining
    // focus is the ordinary flow rather than a rare race.
    const i = indexOfStudent(s.students, s.editId)
    if (i === -1) return {}
    const arr = [...s.students]; arr[i] = { ...arr[i], ...capped }
    return { students: arr }
  }),

  // Validate, then write, then report — in that order. Returns false when the
  // record was not saved so the caller can stay on the form.
  saveStudentEdit: async () => {
    const { students, editId } = get()
    const st = findStudent(students, editId)
    if (!st) { get().notify('That student is no longer on the roster', 'error'); return false }
    if (!st.name.trim()) { get().notify('Name is required', 'error'); return false }
    if (st.parent && !/^\+?\d[\d\s\-]{6,}$/.test(st.parent)) { get().notify('Invalid phone number', 'error'); return false }
    if (st.dbId) {
      // fee_status is deliberately absent. The edit form has no fee control, so
      // the only value this could send is whatever the badge happened to say
      // when the form opened — and since migration 0030 that column is derived
      // by the database from the fee rows themselves. Writing it back here
      // would let "fix a typo in the phone number" quietly restore a stale
      // badge over a payment somebody recorded thirty seconds ago.
      const res = await supabase.from('students').update({
        name: st.name.trim(), class: st.klass, school: st.school,
        parent_contact: st.parent,
      }).eq('id', st.dbId).select('id')
      if (res.error) { get().notify(friendlyError(res.error, 'update student'), 'error'); return false }
      // The row must exist — it was on the roster when the form opened. If it
      // is gone, or out of this centre's reach, the edit vanished and the form
      // must stay open rather than close on "Student record updated".
      if (changedNothing(res)) { get().notify(NOT_SAVED, 'error'); return false }
    }
    get().notify('Student record updated')
    return true
  },

  setNewStudent: (patch) => set((s) => ({ newStudent: { ...s.newStudent, ...patch } })),
  setStuSignup: (patch) => set((s) => ({ stuSignup: { ...s.stuSignup, ...patch } })),

  // Student self-registration. The RPC validates the centre join code + required
  // fields (name, parent, class, school), mints a code, and inserts a PENDING
  // student the head must approve. On success we land the student on the waiting
  // screen with their code (they save it now; it only works once approved).
  studentSignup: async () => {
    const { stuSignup: f } = get()
    if (f.name.trim().length < 2) { get().notify('Enter your full name', 'error'); return }
    if (!/^\+?\d[\d\s\-]{6,}$/.test(f.parent.trim())) { get().notify('Enter a valid parent phone number', 'error'); return }
    if (!f.klass.trim()) { get().notify('Select your class', 'error'); return }
    if (f.school.trim().length < 2) { get().notify('Enter your school name', 'error'); return }
    const { data, error } = await supabase.rpc('student_signup', {
      p_join_code: f.joinCode.trim(),
      p_name: clampText(f.name, LIMITS.name),
      p_parent: clampText(f.parent, LIMITS.parent),
      p_class: clampText(f.klass, LIMITS.klass),
      p_school: clampText(f.school, LIMITS.school),
      p_address: clampText(f.address, LIMITS.address) || null,
    })
    if (error || !data) { get().notify(friendlyError(error, 'register'), 'error'); return }
    const d = data as { code: string; name: string; centre: string }
    writeLocal('student_code', d.code)
    // Spend it immediately: this phone is definitionally the first device on a
    // code that is seconds old, so the claim is silent and this household never
    // sends the raw code again.
    claimStudentDevice(d.code).catch(() => {})
    // Let the head know a request is waiting (best-effort push). This cannot go
    // through sendPush: a self-registering student has no Supabase session, so
    // sendPush returned `not signed in` and the head was never told — the whole
    // point of the notification is to reach a head whose app is closed.
    sendStudentRequestPush(d.code).catch(() => {})
    set({
      stuPending: { name: d.name, code: d.code, centre: d.centre },
      stuSignup: { joinCode: '', name: '', parent: '', klass: 'Class 10', school: '', address: '' },
      role: 'student', staffStatus: 'none', screen: 'stuPending', tab: 'stuHome', authLoading: false,
    })
    subscribePending(d.code)
  },

  // Deleting a student cascades their attendance, results, fees and notes, so
  // this is the most destructive action in the app. It waits for the delete to
  // land before touching the roster — the previous version removed the row and
  // said "Student removed" immediately, so a failed delete left the head
  // believing a student was gone while every record was still in the database.
  deleteStudent: async () => {
    const { editId, students } = get()
    const student = findStudent(students, editId)
    if (!student) { get().notify('That student is no longer on the roster', 'error'); get().back(); return }
    if (student.dbId) {
      const { error } = await supabase.from('students').delete().eq('id', student.dbId)
      if (error) { get().notify('Could not remove student — nothing was deleted', 'error'); return }
    }
    set((s) => ({ students: s.students.filter(x => studentKey(x) !== editId), editId: '' }))
    get().notify('Student removed'); get().back()
  },

  // Awaited end to end. The success screen hands the parent a login code, so
  // it must not appear until the row it refers to actually exists.
  addStudent: async () => {
    const { newStudent: raw, students, branchesList } = get()
    if (!raw.name.trim()) { get().notify('Enter student name', 'error'); return }
    if (!raw.parent.trim()) { get().notify('Enter parent contact', 'error'); return }
    if (raw.parent && !/^\+?\d[\d\s\-]{6,}$/.test(raw.parent)) { get().notify('Invalid phone number', 'error'); return }
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
    // A student owes nothing until a fee row says otherwise, so a new student
    // added without an enrolment fee starts Paid rather than Due. Due with no
    // fee under it is a badge the family cannot act on and the head cannot
    // clear.
    const amt = Number(ns.fee)
    const student: Student = {
      name: ns.name, klass: ns.klass, batch: ns.batch || undefined, attendance: 0,
      feeStatus: amt > 0 ? 'Due' : 'Paid', school: ns.school, parent: ns.parent, id: code,
    }
    // Exact match. `includes` picked the first branch merely *containing* the
    // chosen name, so a centre with both "Main" and "Main Annexe" filed the
    // student under whichever happened to be listed first.
    const branchId = ns.branch ? branchesList.find(b => b.name === ns.branch)?.dbId : null
    // Show the row straight away so the roster feels instant, but do not claim
    // success until the insert lands.
    set({ students: [student, ...students] })
    // The student and their enrolment fee go in together or not at all. As two
    // requests, a drop between them left a student who owes nothing on the day
    // the head typed what they owe, and a teacher — allowed the child, refused
    // the money — got that outcome every single time.
    const { data, error } = await supabase.rpc('create_student', {
      p_name: ns.name, p_class: student.klass, p_batch: ns.batch || null, p_school: ns.school,
      p_parent_contact: ns.parent, p_student_code: code, p_address: ns.address,
      p_branch_id: branchId ?? null,
      p_fee_amount: amt > 0 ? amt : null,
      p_fee_due_date: amt > 0 ? (ns.feeDue || isoDay()) : null,
    })
    const created = data as { id?: string; status?: FeeStatus } | null
    if (error || !created?.id) {
      // Roll the optimistic row back. Leaving it stranded gave the head a
      // student who looked real — tappable, editable, counted in attendance —
      // but had no dbId, so every edit silently wrote nothing. Having been
      // told the save failed, they add the student again and now have two.
      set((s) => ({ students: s.students.filter(x => !(x.id === code && !x.dbId)) }))
      get().notify(friendlyError(error, 'save student'), 'error')
      return
    }
    set((s) => ({ students: s.students.map(x => x.id === code && !x.dbId
      ? { ...x, dbId: created.id, feeStatus: created.status ?? x.feeStatus } : x) }))
    set({ newStudent: { name: '', school: '', klass: 'Class 10', batch: '', branch: '', parent: '', address: '', fee: '', feeDue: '' }, lastAdded: { code, name: ns.name, parent: ns.parent } })
  },

  // A whole pasted roster, in one insert.
  //
  // Not optimistic, unlike addStudent: sixty provisional rows that have to be
  // unwound on a failure is a worse thing to get wrong than a moment's wait,
  // and the head is watching a progress button rather than a list. Postgres
  // takes the array or it takes none of it, so a failure leaves the roster
  // exactly as it was.
  //
  // Returns the codes it minted, in roster order, so the screen can hand them
  // out — an import that stops at "60 students added" has only moved the wall
  // from typing names to chasing sixty parents.
  importStudents: async (rows, branch) => {
    if (!rows.length) return null
    const { students, branchesList } = get()

    // Unique against the roster AND against the codes minted a moment ago in
    // this same loop — student_code is unique in the database, so one repeat
    // rejects the entire paste.
    const taken = new Set(students.map(s => s.id))
    const codes = rows.map(() => {
      let code = genStudentCode()
      while (taken.has(code)) code = genStudentCode()
      taken.add(code)
      return code
    })

    // No fee rows are created here — an imported roster is names, not money,
    // and the head sets fees afterwards. So the badge is Paid: fee_status now
    // defaults to Paid in the database for exactly this reason, and stamping
    // 'Due' on sixty students with no fee under any of them was the same lie
    // 0034 went through the table to erase.
    const branchId = branch ? branchesList.find(b => b.name === branch)?.dbId ?? null : null
    const { data, error } = await supabase.from('students').insert(
      rows.map((r, i) => ({
        name: r.name, class: r.klass, school: r.school, parent_contact: r.parent,
        student_code: codes[i], branch_id: branchId,
      })),
    ).select('id, student_code')
    if (error || !data) { get().notify(friendlyError(error, 'import students'), 'error'); return null }

    // Match the returned ids back by code rather than by position: PostgREST
    // does not promise the rows come back in the order they went in, and a
    // student wearing another student's dbId writes their marks and fees onto
    // the wrong child.
    const ids = new Map(data.map(d => [d.student_code as string, d.id as string]))
    const added: Student[] = rows.map((r, i) => ({
      name: r.name, klass: r.klass, attendance: 0, feeStatus: 'Paid',
      school: r.school, parent: r.parent, id: codes[i], dbId: ids.get(codes[i]),
      ...(branch ? { branch } : {}),
    }))
    set((s) => ({ students: [...added, ...s.students] }))
    get().notify(`${added.length} student${added.length === 1 ? '' : 's'} added`)
    return added.map(s => ({ code: s.id, name: s.name, parent: s.parent }))
  },

  approveStudent: async (dbId, klass, branchId, fee, feeDue, batch) => {
    // Read the code before the row leaves pendingStudents below — it is the
    // only handle we have for pushing to this student.
    const code = get().pendingStudents.find(p => p.dbId === dbId)?.code
    const amt = Number(fee)
    const { error } = await supabase.rpc('approve_student', {
      p_id: dbId,
      p_class: klass.trim() || null,
      p_branch_id: branchId,
      p_fee: fee.trim() && amt > 0 ? amt : null,
      p_fee_due: feeDue || null,
    })
    if (error) { get().notify(friendlyError(error, 'approve the student'), 'error'); return }
    // Batch isn't part of the approve RPC — persist it directly (RLS scopes the
    // update to the head's own centre). Non-blocking; roster refresh follows.
    if (batch && batch.trim()) {
      // Was awaited and thrown away — not even an error check. A failure here
      // left the student approved with no batch while the head was told the
      // approval succeeded, and the missing batch only showed up later when
      // she went looking for the child in a batch list they were not in.
      const res = await supabase.from('students').update({ batch: batch.trim() }).eq('id', dbId).select('id')
      if (res.error || changedNothing(res)) {
        get().notify(`Student approved, but the batch was not saved — set it from the roster`, 'error')
      }
    }
    set((s) => ({ pendingStudents: s.pendingStudents.filter(p => p.dbId !== dbId) }))
    // The waiting screen promises "you'll get in the moment they approve you".
    // Nothing was keeping that promise: approval sent no notification at all,
    // so a student who had closed the app had no way to learn they were in
    // short of reopening it and tapping Check approval on the off chance.
    // Best-effort — an approval must never fail because a push did.
    if (code) sendPush({
      studentCodes: [code],
      title: 'You\u2019re approved',
      body: 'Open the app to see your timetable, marks and fees.',
    }).catch(() => {})
    get().notify('Student approved')
    await get().refreshData()
  },

  rejectStudent: async (dbId) => {
    const { error } = await supabase.rpc('reject_student', { p_id: dbId })
    if (error) { get().notify(friendlyError(error, 'decline the request'), 'error'); return }
    set((s) => ({ pendingStudents: s.pendingStudents.filter(p => p.dbId !== dbId) }))
    get().notify('Request declined')
  },

  // The phones using this centre's student codes. RLS scopes the table to the
  // head's own centre, so a plain select is already tenant-safe.
  loadStudentDevices: async () => {
    const { data, error } = await supabase
      .from('student_devices')
      .select('id, label, approved, created_at, last_seen_at, students!inner(name)')
      .is('revoked_at', null)
      .order('approved', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) { get().notify(friendlyError(error, 'load the phones'), 'error'); return }
    const rows = (data ?? []) as unknown as {
      id: string; label: string | null; approved: boolean
      created_at: string; last_seen_at: string | null; students: { name: string } | { name: string }[]
    }[]
    const devices: StudentDevice[] = rows.map(r => ({
      dbId: r.id,
      studentName: (Array.isArray(r.students) ? r.students[0]?.name : r.students?.name) ?? 'Student',
      label: r.label ?? 'Unknown phone',
      allowed: r.approved,
      when: r.created_at,
      lastSeen: r.last_seen_at,
    }))
    set({ studentDevices: devices })
  },

  allowStudentDevice: async (dbId) => {
    const res = await supabase.from('student_devices').update({ approved: true }).eq('id', dbId).select('id')
    if (res.error || changedNothing(res)) {
      get().notify(friendlyError(res.error, 'allow this phone'), 'error'); return
    }
    set((s) => ({ studentDevices: s.studentDevices.map(d => d.dbId === dbId ? { ...d, allowed: true } : d) }))
    get().notify('Phone allowed')
  },

  // Revoking is a soft delete on purpose: the row is what makes the raw code
  // stop working for a student who has ever had a device, and deleting it would
  // hand the leaked code back its power.
  removeStudentDevice: async (dbId) => {
    const res = await supabase.from('student_devices').update({ revoked_at: new Date().toISOString() }).eq('id', dbId).select('id')
    if (res.error || changedNothing(res)) {
      get().notify(friendlyError(res.error, 'remove this phone'), 'error'); return
    }
    set((s) => ({ studentDevices: s.studentDevices.filter(d => d.dbId !== dbId) }))
    get().notify('Phone removed')
  },

  loadStudentByCode: async (code, navigate = true) => {
    const trimmed = code.trim()
    if (trimmed.length < 4) { if (navigate) get().notify('Enter your code', 'error'); return false }
    const { data, error } = await supabase.rpc('get_student_snapshot', { p_code: trimmed })
    if (error || !data) {
      // Distinguish a transient throttle from a genuinely dead code.
      const throttled = error?.message?.includes('Too many')
      // A code that resolves to nothing is dead (deleted/never valid). Drop it
      // so it stops re-firing "Invalid code" on every launch — this is what
      // hijacks a head's device when a stale test code is left in storage.
      // Never clear on a rate-limit: the code may be perfectly valid.
      if (!throttled) clearStudentCred()
      if (navigate) get().notify(throttled ? error!.message : 'Invalid code — check with your teacher', 'error')
      return false
    }
    const snap = data as { status?: string; student?: { name?: string; code?: string } }

    // Awaiting the head's approval — hold on the waiting screen (no dashboard data).
    if (snap.status === 'pending') {
      if (!hasStudentToken()) writeLocal('student_code', trimmed)
      subscribePending(trimmed)
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
      // A device waiting to be allowed keeps its token — that is the whole
      // point of the wait, and clearing it would make the head's approval land
      // on a device that had already forgotten who it was.
      if (snap.status !== 'device_pending') clearStudentCred()
      set({
        stuDenied: {
          name: prev?.name ?? snap.student?.name ?? '',
          centre: prev?.centre ?? '',
          reason: snap.status === 'device_pending' || snap.status === 'device_revoked' ? snap.status : undefined,
        },
        stuPending: null,
        role: 'student', staffStatus: 'none', screen: 'stuDenied', tab: 'stuHome', authLoading: false,
      })
      return false
    }

    // Once a token exists, `trimmed` IS the token, and writing it here would
    // put 64 hex characters on the waiting screen where the student's code
    // belongs.
    if (!hasStudentToken()) writeLocal('student_code', trimmed)
    // First launch on a phone that was already signed in with a raw code, or a
    // student who has just typed one. Either way the code works exactly once
    // more, and after this it is only a voucher.
    claimStudentDevice(trimmed).catch(() => {})
    const patch: Partial<State> = mapSnapshot(data)
    // The snapshot is this student's whole dataset, so a successful pull is a
    // sync in exactly the same sense as the staff one.
    patch.lastSyncedAt = Date.now()
    // Only navigate on the initial load; a background (focus) refresh just
    // updates the data and must not yank the student off their current screen.
    //
    // Except from a waiting screen, where being moved off IS the point. The
    // pending screen polls every 15s for exactly this, but polled with
    // navigate=false (rightly — navigate also turns on error toasts, and a
    // flaky signal would have popped "Invalid code" four times a minute). So
    // the poll could see the approval and then do nothing with it: the student
    // sat on "You're on the list" until they happened to tap Check approval by
    // hand. The decline path already flips the screen on a background poll;
    // this is the same rule applied to the outcome anyone actually waits for.
    const onWaitingScreen = get().screen === 'stuPending' || get().screen === 'stuDenied'
    if (navigate || onWaitingScreen) {
      Object.assign(patch, {
        role: 'student', staffStatus: 'none', screen: 'stuHome', tab: 'stuHome' as Tab,
        authLoading: false, stuPending: null, stuDenied: null, stuRankSubject: Object.keys(patch.rankData ?? {})[0] ?? '',
      })
      // Auto-prompt for push on login so students don't have to hunt for a
      // button. enablePush is idempotent and stays silent once permission is
      // decided (granted → re-subscribes, denied → no dialog); skip when denied
      // and swallow failures so a blocked prompt never disrupts login.
      if (pushSupported() && Notification.permission !== 'denied') enablePush('student', readStudentCred() ?? trimmed).catch(() => {})
    }
    set(patch)
    return true
  },
})
