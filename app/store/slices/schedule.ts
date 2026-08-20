import { supabase } from '../../lib/supabase'
import { dbErr } from '../db'
import { isoDay } from '../format'
import type { Slice } from '../slice'
import type { MeetingItem } from '../types'

type Keys = 'saveMeeting' | 'addTimetableEntry' | 'updateTimetableEntry' | 'deleteTimetableEntry'

export const createScheduleSlice: Slice<Keys> = (set, get) => ({
  saveMeeting: (title, type, date, time) => {
    if (!title.trim()) { get().notify('Enter a title'); return }
    const { meetingsList } = get()
    const d = new Date(date || Date.now())
    const item: MeetingItem = {
      title, time, kind: type,
      day: String(d.getDate()).padStart(2, '0'),
      mon: d.toLocaleString('en', { month: 'short' }),
    }
    supabase.from('meetings').insert({ title, meeting_type: type, date: isoDay(d), time }).then(dbErr('save meeting', get().notify))
    set({ meetingsList: [item, ...meetingsList] })
    get().notify('Meeting scheduled · invites sent')
  },

  addTimetableEntry: (day, startTime, endTime, subject, klass, room) => {
    const { timetableData } = get()
    const updated = { ...timetableData }
    if (!updated[day]) updated[day] = []
    updated[day] = [...updated[day], [startTime, endTime, subject, klass, room]].sort((a, b) => a[0].localeCompare(b[0]))
    set({ timetableData: updated })
    supabase.from('timetable').insert({
      day, start_time: startTime, end_time: endTime,
      subject, class: klass, room: room || null,
    }).then(dbErr('add timetable', get().notify))
    get().notify(`Period added: ${subject} on ${day}`)
  },

  updateTimetableEntry: (day, oldP, startTime, endTime, subject, klass, room) => {
    const entry = [startTime, endTime, subject, klass, room]
    set((s) => ({ timetableData: { ...s.timetableData, [day]: (s.timetableData[day] ?? [])
      .map(x => (x[0] === oldP[0] && x[1] === oldP[1] && x[2] === oldP[2] && x[3] === oldP[3]) ? entry : x)
      .sort((a, b) => a[0].localeCompare(b[0])) } }))
    supabase.from('timetable')
      .update({ start_time: startTime, end_time: endTime, subject, class: klass, room: room || null })
      .eq('day', day).eq('start_time', oldP[0]).eq('end_time', oldP[1]).eq('subject', oldP[2]).eq('class', oldP[3])
      .then(dbErr('update period', get().notify))
    get().notify(`Period updated: ${subject} on ${day}`)
  },

  deleteTimetableEntry: (day, p) => {
    set((s) => ({ timetableData: { ...s.timetableData, [day]: (s.timetableData[day] ?? []).filter(x => !(x[0] === p[0] && x[1] === p[1] && x[2] === p[2] && x[3] === p[3])) } }))
    supabase.from('timetable').delete()
      .eq('day', day).eq('start_time', p[0]).eq('end_time', p[1]).eq('subject', p[2]).eq('class', p[3])
      .then(dbErr('remove period', get().notify))
    get().notify('Period removed')
  },
})
