import { supabase } from '../../lib/supabase'
import { dbErr } from '../db'
import { isoDay } from '../format'
import type { Slice } from '../slice'
import type { MeetingItem } from '../types'

type Keys = 'saveMeeting' | 'addTimetableEntry' | 'updateTimetableEntry' | 'deleteTimetableEntry'

// Every action here fired its write and announced success in the same tick.
// The timetable is the schedule the whole centre works from, so a period that
// looked added but never saved sent a teacher to an empty room. Each one now
// awaits the write and rolls the local state back if it fails.
export const createScheduleSlice: Slice<Keys> = (set, get) => ({
  saveMeeting: async (title, type, date, time) => {
    const notify = get().notify
    if (!title.trim()) { notify('Enter a title', 'error'); return false }
    if (!get().online) { notify('No internet — the meeting has NOT been saved. Try again once you are back online.', 'error'); return false }

    const before = get().meetingsList
    const d = new Date(date || Date.now())
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
      .map(x => (x[0] === oldP[0] && x[1] === oldP[1] && x[2] === oldP[2] && x[3] === oldP[3]) ? entry : x)
      .sort((a, b) => a[0].localeCompare(b[0])) } }))

    const res = await supabase.from('timetable')
      .update({ start_time: startTime, end_time: endTime, subject, class: klass, room: room || null })
      .eq('day', day).eq('start_time', oldP[0]).eq('end_time', oldP[1]).eq('subject', oldP[2]).eq('class', oldP[3])
    if (res.error) { set({ timetableData: before }); dbErr('update the period', notify)(res); return false }

    notify(`Period updated: ${subject} on ${day}`)
    return true
  },

  deleteTimetableEntry: async (day, p) => {
    const notify = get().notify
    if (!get().online) { notify('No internet — the period has NOT been removed. Try again once you are back online.', 'error'); return }

    const before = get().timetableData
    set((s) => ({ timetableData: { ...s.timetableData, [day]: (s.timetableData[day] ?? []).filter(x => !(x[0] === p[0] && x[1] === p[1] && x[2] === p[2] && x[3] === p[3])) } }))

    const res = await supabase.from('timetable').delete()
      .eq('day', day).eq('start_time', p[0]).eq('end_time', p[1]).eq('subject', p[2]).eq('class', p[3])
    if (res.error) { set({ timetableData: before }); dbErr('remove the period', notify)(res); return }

    notify('Period removed')
  },
})
