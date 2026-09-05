import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/push'
import type { IconName } from '../../components/Icon'
import { dbErr } from '../db'
import { timeAgo } from '../format'
import type { Slice } from '../slice'

export const createNotificationsSlice: Slice<'saveReminder' | 'notifyClass' | 'loadReminderHistory'> = (set, get) => ({
  saveReminder: async (type, message, targetClass, filter) => {
    const { students } = get()
    // The composer pre-fills a template, so an empty message means the head
    // cleared it. Nothing stopped that: a blank notification went to every
    // parent in the centre, and the receipt below called it a success.
    if (!message.trim()) { get().notify('Write a message before sending', 'error'); return }
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
    // Narrows whatever the filter left, rather than being the alternative to
    // it. A head chasing fees inside one class asked for both conditions, and
    // the class used to be dropped the moment a filter was present.
    if (targetClass && targetClass !== 'all') targets = targets.filter(s => s.klass === targetClass)

    const label = type === 'Notice' ? 'Notice' : `${type} reminder`

    // A filter that matches nobody used to write a reminders row anyway and
    // then report "sent to 0 students" in the success colour — a head chasing
    // unpaid fees read that as done and stopped chasing.
    if (!targets.length) {
      get().notify(`Nobody matches that group — the ${label.toLowerCase()} was not sent`, 'error')
      return
    }

    // Awaited, not fired and forgotten. The success toast below used to appear
    // before a single row had been written, so a failed insert read to the
    // teacher as "sent to 24 students". It also used to carry on after the
    // failure and still claim success at the end; it stops here now.
    const remRes = await supabase.from('reminders').insert({ type, message, target_class: targetClass })
    if (remRes.error) { dbErr('send reminder', get().notify)(remRes); return }

    const rows = targets.map(s => ({ student_id: s.dbId, title, detail: message, icon }))
    const notifRes = await supabase.from('notifications').insert(rows)
    if (notifRes.error) { dbErr('send notifications', get().notify)(notifRes); return }

    // One toast, not three. notify() is a single slot with a timer: each call
    // clobbers the last, so the push result appeared and was destroyed in the
    // same tick by the count that followed it, and QA reported seeing no
    // receipt at all. The receipt says both halves in one sentence — who got
    // it in the app, and what happened on their phones.
    const codes = targets.map(s => s.id).filter(Boolean)
    const push = codes.length ? await sendPush({ studentCodes: codes, title, body: message }) : null
    const to = `${label} sent to ${targets.length} student${targets.length === 1 ? '' : 's'}`

    // The in-app reminder landed for everyone regardless — the notifications
    // insert above already succeeded — so a push problem is a footnote, never
    // a failure. But staying silent about it is indistinguishable from "push
    // is broken": the teacher presses send, nothing buzzes, and she cannot
    // tell whether the feature failed or nobody has turned notifications on.
    if (!push) get().notify(to)
    else if (push.error) get().notify(`${to}, but their phones could not be alerted`, 'error')
    else if (push.sent) get().notify(`${to} · ${push.sent} phone${push.sent === 1 ? '' : 's'} alerted`)
    // Subscriptions the push service refused. Distinct from "nobody
    // subscribed": the student thinks notifications are on, so telling them to
    // check their phone settings would send them hunting for a fault that
    // isn't there. Name the real remedy instead.
    else if (push.undelivered) get().notify(`${to} · ${push.undelivered} device(s) need notifications re-enabled`)
    else get().notify(`${to} · nobody has phone notifications on yet`)

    // No local stuNotifications push: that array is the *student's* own feed,
    // and this code runs in a staff session. It only ever grew N duplicate
    // rows sharing one dbId inside a store slice no staff screen reads.
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

  // Every reminder ever sent has been written to `reminders` since the first
  // release and nothing has ever read them back. A head who could not
  // remember whether she had already chased this month's fees had two
  // choices: ask a parent, or send it twice. This is the third.
  loadReminderHistory: async () => {
    const { data, error } = await supabase.from('reminders')
      .select('id, type, message, target_class, created_at')
      .order('created_at', { ascending: false }).limit(50)
    if (error) { dbErr('load the reminder history', get().notify)({ error }); return }
    set({
      reminderHistory: (data ?? []).map(r => ({
        dbId: r.id as string,
        type: (r.type as string) ?? 'Notice',
        message: (r.message as string) ?? '',
        targetClass: (r.target_class as string) ?? null,
        when: timeAgo(r.created_at as string),
      })),
    })
  },
})
