import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/push'
import type { IconName } from '../../components/Icon'
import { dbErr } from '../db'
import type { Slice } from '../slice'

export const createNotificationsSlice: Slice<'saveReminder' | 'notifyClass'> = (_set, get) => ({
  saveReminder: async (type, message, targetClass, filter) => {
    const { students } = get()
    const icons: Record<string, IconName> = { Notice: 'notice', Test: 'test', Absence: 'absence', Fee: 'fees', Homework: 'homework' }
    const icon: IconName = icons[type] ?? 'reminder'
    const title = type === 'Notice' ? 'Notice' : `${type} Reminder`

    let targets = students.filter(s => s.dbId)
    // Not `attendance === 0`. A student added this morning has no attendance
    // rows yet, so the mapper leaves the percentage at its 0 default — and an
    // "Absence Reminder" to a parent on their child's first day is exactly the
    // kind of wrong that loses a centre. Only students who have actually been
    // marked at least once, and who missed at least one of those days, count.
    if (filter === 'absentees') targets = targets.filter(s => (s.attendanceMarked ?? 0) > 0 && s.attendance < 100)
    else if (filter === 'fees_due') targets = targets.filter(s => s.feeStatus !== 'Paid')
    else if (targetClass && targetClass !== 'all') targets = targets.filter(s => s.klass === targetClass)

    // Awaited, not fired and forgotten. The success toast below used to appear
    // before a single row had been written, so a failed insert read to the
    // teacher as "sent to 24 students".
    const remRes = await supabase.from('reminders').insert({ type, message, target_class: targetClass })
    dbErr('send reminder', get().notify)(remRes)
    if (targets.length) {
      const rows = targets.map(s => ({ student_id: s.dbId, title, detail: message, icon }))
      const notifRes = await supabase.from('notifications').insert(rows)
      dbErr('send notifications', get().notify)(notifRes)
      if (notifRes.error) return
      // Push to students who enabled notifications; report the result so it's
      // clear whether any device actually got a lock-screen alert.
      const codes = targets.map(s => s.id).filter(Boolean)
      if (codes.length) await sendPush({ studentCodes: codes, title, body: message })
        .then(r => {
          // Always say what happened. The in-app reminder lands for everyone
          // regardless (notifications insert above), but staying silent on 0
          // devices is indistinguishable from "push is broken" — the teacher
          // presses send, nothing buzzes, and there's no way to tell whether
          // the feature failed or simply nobody has turned notifications on.
          if (r.error) get().notify('Could not send the phone notification. It was still sent inside the app.', 'error')
          else if (r.sent) get().notify(`Also pushed to ${r.sent} device(s)`)
          // Subscriptions the push service refused. Distinct from "nobody
          // subscribed": the student thinks notifications are on, so telling
          // them to check their phone settings would send them hunting for a
          // fault that isn't there. Name the real remedy instead.
          else if (r.undelivered) get().notify(`${r.undelivered} device(s) need notifications re-enabled`)
          else get().notify('Sent in-app — no student has phone notifications on yet')
        })
    }

    // No local stuNotifications push: that array is the *student's* own feed,
    // and this code runs in a staff session. It only ever grew N duplicate
    // rows sharing one dbId inside a store slice no staff screen reads.
    get().notify(`${type === 'Notice' ? 'Notice' : `${type} reminder`} sent to ${targets.length} students`)
  },

  // Auto-notify students when staff adds content (homework, results, notes,
  // absence). Inserts in-app notification rows and fires a best-effort push.
  notifyClass: async (klass, title, detail, icon) => {
    const { students } = get()
    let targets = students.filter(s => s.dbId)
    if (klass && klass !== 'all') targets = targets.filter(s => s.klass === klass)
    if (!targets.length) return
    const rows = targets.map(s => ({ student_id: s.dbId, title, detail, icon }))
    // Awaited so a rejected insert surfaces as an error toast instead of
    // vanishing while the caller reports success.
    const res = await supabase.from('notifications').insert(rows)
    dbErr('send notifications', get().notify)(res)
    if (res.error) return
    const codes = targets.map(s => s.id).filter(Boolean)
    if (codes.length) await sendPush({ studentCodes: codes, title, body: detail })
      .then(r => { if (!r.error) get().notify(`Notified ${targets.length} student(s) · push to ${r.sent} device(s)`) })
  },
})
