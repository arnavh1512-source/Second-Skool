import { supabase } from '../../lib/supabase'
import { changedNothing, dbErr, NOT_SAVED } from '../db'
import { isoDay, parseDay } from '../format'
import type { Slice } from '../slice'
import type { MeetingItem } from '../types'

// The narrow slice of the query builder matchPeriod needs: enough to chain the
// filters, without importing the whole PostgrestFilterBuilder generic soup.
// Generic so the real builder type — and with it the awaited result — survives.
type TimetableQuery<T> = { eq: (col: string, val: string) => T; is: (col: string, val: null) => T }

type Keys = 'saveMeeting' | 'deleteMeeting' | 'addTimetableEntry' | 'updateTimetableEntry' | 'deleteTimetableEntry'

// Every action here fired its write and announced success in the same tick.
// The timetable is the schedule the whole centre works from, so a period that
// looked added but never saved sent a teacher to an empty room. Each one now
// awaits the write and rolls the local state back if it fails.
// A period is identified by every column of timetable_period_room_unique
// (day, start, end, subject, class, room). Matching on all but the room let two
// legitimately distinct periods — same class, same slot, different rooms — be
// updated or deleted together by one tap on either of them.
const matchPeriod = <T extends TimetableQuery<T>>(q: T, day: string, p: readonly string[]): T => {
  const withCols = q.eq('day', day).eq('start_time', p[0]).eq('end_time', p[1]).eq('subject', p[2]).eq('class', p[3])
  return p[4] ? withCols.eq('room', p[4]) : withCols.is('room', null)
}

const samePeriod = (a: readonly string[], b: readonly string[]) =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && (a[4] ?? '') === (b[4] ?? '')

export const createScheduleSlice: Slice<Keys> = (set, get) => ({
  saveMeeting: async (title, type, date, time) => {
    const notify = get().notify
    if (!title.trim()) { notify('Enter a title', 'error'); return false }
    if (!get().online) { notify('No internet — the meeting has NOT been saved. Try again once you are back online.', 'error'); return false }

    // Same reason as saveAssignment: an empty date used to fall back to today
    // and be announced as scheduled, so a meeting nobody had picked a day for
    // appeared on the parents' home screen for this afternoon.
    const d = parseDay(date)
    if (!d) { notify('Pick a date for the meeting', 'error'); return false }

    const before = get().meetingsList
    const item: MeetingItem = {
      title, time, kind: type,
      day: String(d.getDate()).padStart(2, '0'),
      mon: d.toLocaleString('en', { month: 'short' }),
    }
    set({ meetingsList: [item, ...before] })

    const res = await supabase.from('meetings').insert({ title, meeting_type: type, date: isoDay(d), time })
    if (res.error) { set({ meetingsList: before }); dbErr('save the meeting', notify)(res); return false }

    // Was "Meeting scheduled · invites sent". Nothing in this action sends an
    // invite — no email, no push, no notification row — so the second half was
    // simply untrue, and a head who trusted it did not tell anyone in person.
    notify('Meeting scheduled')
    return true
  },

  // Meetings were the one thing the app could create and never take back. A
  // parent-teacher meeting moved or called off stayed on every parent's home
  // screen as though it were still happening, and the head had no way to
  // correct it. Head-only, because that is what the meetings_head policy
  // allows: a teacher's delete is filtered out by RLS and comes back as the
  // silent zero-row success PostgREST gives for a row you cannot touch, which
  // is exactly what changedNothing is here to catch.
  deleteMeeting: async (dbId) => {
    const notify = get().notify
    if (!get().online) { notify('No internet - the meeting has NOT been cancelled. Try again once you are back online.', 'error'); return }

    const before = get().meetingsList
    set({ meetingsList: before.filter(m => m.dbId !== dbId) })

    const res = await supabase.from('meetings').delete().eq('id', dbId).select('id')
    if (res.error) { set({ meetingsList: before }); dbErr('cancel the meeting', notify)(res); return }
    if (changedNothing(res)) { set({ meetingsList: before }); notify(NOT_SAVED, 'error'); return }

    notify('Meeting cancelled')
  },

  addTimetableEntry: async (day, startTime, endTime, subject, klass, room) => {
    const notify = get().notify
    if (!get().online) { notify('No internet — the period has NOT been added. Try again once you are back online.', 'error'); return false }

    const before = get().timetableData
    const updated = { ...before }
    updated[day] = [...(updated[day] ?? []), [startTime, endTime, subject, klass, room]].sort((a, b) => a[0].localeCompare(b[0]))
    set({ timetableData: updated })

    const res = await supabase.from('timetable').insert({
      day, start_time: startTime, end_time: endTime,
      subject, class: klass, room: room || null,
    })
    if (res.error) { set({ timetableData: before }); dbErr('add the period', notify)(res); return false }

    notify(`Period added: ${subject} on ${day}`)
    return true
  },

  updateTimetableEntry: async (day, oldP, startTime, endTime, subject, klass, room) => {
    const notify = get().notify
    if (!get().online) { notify('No internet — the period has NOT been changed. Try again once you are back online.', 'error'); return false }

    const before = get().timetableData
    const entry = [startTime, endTime, subject, klass, room]
    set((s) => ({ timetableData: { ...s.timetableData, [day]: (s.timetableData[day] ?? [])
      .map(x => samePeriod(x, oldP) ? entry : x)
      .sort((a, b) => a[0].localeCompare(b[0])) } }))

    const res = await matchPeriod(supabase.from('timetable')
      .update({ start_time: startTime, end_time: endTime, subject, class: klass, room: room || null }), day, oldP).select('id')
    if (res.error) { set({ timetableData: before }); dbErr('update the period', notify)(res); return false }
    // The period being edited was on screen a moment ago, so it must match. If
    // it does not, another device changed or removed it first — and without
    // this the edit stayed on screen as though it had been saved, which is how
    // two teachers end up reading two different timetables.
    if (changedNothing(res)) { set({ timetableData: before }); notify(NOT_SAVED, 'error'); return false }

    notify(`Period updated: ${subject} on ${day}`)
    return true
  },

  deleteTimetableEntry: async (day, p) => {
    const notify = get().notify
    if (!get().online) { notify('No internet — the period has NOT been removed. Try again once you are back online.', 'error'); return }

    const before = get().timetableData
    set((s) => ({ timetableData: { ...s.timetableData, [day]: (s.timetableData[day] ?? []).filter(x => !samePeriod(x, p)) } }))

    const res = await matchPeriod(supabase.from('timetable').delete(), day, p).select('id')
    if (res.error) { set({ timetableData: before }); dbErr('remove the period', notify)(res); return }
    // Same as the update: a delete that matched nothing removed the period
    // from this screen only, and it came back on the next refresh.
    if (changedNothing(res)) { set({ timetableData: before }); notify(NOT_SAVED, 'error'); return }

    notify('Period removed')
  },
})
