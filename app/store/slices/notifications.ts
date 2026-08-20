import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/push'
import type { IconName } from '../../components/Icon'
import { dbErr } from '../db'
import type { Slice } from '../slice'

export const createNotificationsSlice: Slice<'saveReminder' | 'notifyClass'> = (set, get) => ({
  saveReminder: (type, message, targetClass, filter) => {
    const { students } = get()
    const icons: Record<string, IconName> = { Notice: 'notice', Test: 'test', Absence: 'absence', Fee: 'fees', Homework: 'homework' }
    const icon: IconName = icons[type] ?? 'reminder'
    const title = type === 'Notice' ? 'Notice' : `${type} Reminder`

    let targets = students.filter(s => s.dbId)
    if (filter === 'absentees') targets = targets.filter(s => s.attendance === 0)
    else if (filter === 'fees_due') targets = targets.filter(s => s.feeStatus !== 'Paid')
    else if (targetClass && targetClass !== 'all') targets = targets.filter(s => s.klass === targetClass)

    supabase.from('reminders').insert({ type, message, target_class: targetClass }).then(dbErr('send reminder', get().notify))
    if (targets.length) {
      const rows = targets.map(s => ({ student_id: s.dbId, title, detail: message, icon }))
      supabase.from('notifications').insert(rows).then(dbErr('send notifications', get().notify))
      // Push to students who enabled notifications; report the result so it's
      // clear whether any device actually got a lock-screen alert.
      const codes = targets.map(s => s.id).filter(Boolean)
      if (codes.length) sendPush({ studentCodes: codes, title, body: message })
        .then(r => {
          // Always say what happened. The in-app reminder lands for everyone
          // regardless (notifications insert above), but staying silent on 0
          // devices is indistinguishable from "push is broken" — the teacher
          // presses send, nothing buzzes, and there's no way to tell whether
          // the feature failed or simply nobody has turned notifications on.
          if (r.error) get().notify(`Push failed: ${r.error}`)
          else if (r.sent) get().notify(`Also pushed to ${r.sent} device(s)`)
          // Subscriptions the push service refused. Distinct from "nobody
          // subscribed": the student thinks notifications are on, so telling
          // them to check their phone settings would send them hunting for a
          // fault that isn't there. Name the real remedy instead.
          else if (r.undelivered) get().notify(`${r.undelivered} device(s) need notifications re-enabled`)
          else get().notify('Sent in-app — no student has phone notifications on yet')
        })
    }

    const now = new Date().toISOString()
    const newNotifs = targets.map(() => ({
      icon, tint: '#eaf1fc', title, detail: message, when: 'Just now', dbId: now,
    }))
    set((s) => ({ stuNotifications: [...newNotifs, ...s.stuNotifications] }))
    get().notify(`${type === 'Notice' ? 'Notice' : `${type} reminder`} sent to ${targets.length} students`)
  },

  // Auto-notify students when staff adds content (homework, results, notes,
  // absence). Inserts in-app notification rows and fires a best-effort push.
  notifyClass: (klass, title, detail, icon) => {
    const { students } = get()
    let targets = students.filter(s => s.dbId)
    if (klass && klass !== 'all') targets = targets.filter(s => s.klass === klass)
    if (!targets.length) return
    const rows = targets.map(s => ({ student_id: s.dbId, title, detail, icon }))
    supabase.from('notifications').insert(rows).then(dbErr('send notifications', get().notify))
    const codes = targets.map(s => s.id).filter(Boolean)
    if (codes.length) sendPush({ studentCodes: codes, title, body: detail })
      .then(r => { if (!r.error) get().notify(`Notified ${targets.length} student(s) · push to ${r.sent} device(s)`) })
  },
})
