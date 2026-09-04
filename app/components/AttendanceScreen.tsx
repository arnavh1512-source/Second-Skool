'use client'

import { useEffect, useRef, useState } from 'react'
import { isoDay, parseDay } from '../store/format'
import { useDashboard, initials, av } from '../store'
import { PrimaryButton, EmptyState, Chip, classesOf } from './Shell'
import { earliestMarkableDay, pickAttendanceClass, seedMarks } from '../lib/attendance'
import { queuedMarksForDay } from '../lib/att-queue'
import { Icon } from './Icon'
import { studentKey } from '../lib/student-key'

// One shared empty register, so the seeding effect below does not see a brand
// new object on every render of a day that has not loaded yet.
const NO_MARKS: Record<string, string> = {}

// One past day's register, read straight from the database rather than from the
// daily rows the provider already holds. Those are capped, newest first, so on
// a centre big enough to fill the cap the older days fall off the end — and a
// register that looks empty because it was never loaded is indistinguishable
// from one that was never marked. Saving that would write a full set of
// Presents over a day somebody had already answered honestly.
async function fetchDayMarks(day: string): Promise<Record<string, string>> {
  const { supabase } = await import('../lib/supabase')
  const { data, error } = await supabase.from('attendance').select('student_id,status').eq('date', day)
  if (error) throw error
  const out: Record<string, string> = {}
  for (const r of data ?? []) out[r.student_id as string] = r.status as string
  return out
}

export function AttendanceScreen() {
  const { attClass, att, students, back, set, toggleAtt, saveAttendance, go, role, attConflicts, dismissAttConflicts, attToday, attQueue, lastSyncedAt, online, notify } = useDashboard()
  const classes = classesOf(students)

  // The day being marked. Today until she says otherwise, and a past day is a
  // correction: the register for a day that has already happened was wrong, or
  // never got filled in at all, and until now there was no door into it.
  const today = isoDay()
  const [day, setDay] = useState(today)
  const correcting = day !== today

  // What the centre already has for that day. Today's comes free with the
  // provider's load and survives going offline; a past day has to be read, and
  // `loaded` is what stops her saving a register she has not actually seen.
  const [pastMarks, setPastMarks] = useState<{ day: string; marks: Record<string, string> } | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const loaded = !correcting || pastMarks?.day === day
  const recorded = correcting ? (pastMarks?.day === day ? pastMarks.marks : NO_MARKS) : attToday

  useEffect(() => {
    if (!correcting) return
    let alive = true
    fetchDayMarks(day)
      .then(marks => { if (alive) setPastMarks({ day, marks }) })
      .catch(() => { if (alive) setLoadFailed(true) })
    return () => { alive = false }
  }, [correcting, day])

  const selClass = pickAttendanceClass(classes, attClass)

  // Student objects, not names — the roster is passed straight to saveAttendance,
  // which needs the database id. Resolving by name broke centres with two
  // students of the same name (both mapped to the first one's record).
  const roster = students.filter(s => s.klass === selClass)

  // att is keyed by the student, so a roster reorder can no longer move a mark
  // onto somebody else.
  //
  // Seeded once per class rather than on every render, and never again while
  // she stays on it: the screen re-renders on every background refresh, and a
  // seed that ran then would wipe marks she was halfway through making. The ref
  // is what makes "once" mean once — comparing selClass to attClass could not,
  // because on the first mount they are already equal and nothing seeded at all.
  //
  // "Once" only counts once there is something to seed from. Both sources
  // arrive after the first paint — the register with the provider's first load,
  // the queue with the client effect that reads localStorage — so latching on
  // the very first run would fix an all-present register in place and never
  // correct it, which is the bug f7a4a7e fixed arriving through another door.
  //
  // Keyed by class *and* day, so switching to a day she wants to correct
  // reseeds from that day's register rather than leaving today's marks sitting
  // on the screen under yesterday's date.
  const ready = (lastSyncedAt !== null || attQueue.length > 0) && loaded
  const seededFor = useRef<string | null>(null)
  useEffect(() => {
    if (!ready) return
    const seedKey = `${day}|${selClass}`
    if (seededFor.current === seedKey) return
    seededFor.current = seedKey
    set({
      attClass: selClass,
      att: seedMarks(roster, recorded, queuedMarksForDay(attQueue, day)),
    })
  }, [ready, day, selClass, roster, recorded, attQueue, set])
  const absentCount = roster.reduce((a, s) => a + (att[studentKey(s)] === 'absent' ? 1 : 0), 0)
  const presentCount = roster.length - absentCount

  return (
    <div className="td-screen td-wide">
      <div className="flex items-center gap-3.5 mb-[18px]">
        <button onClick={back} className="w-[42px] h-[42px] rounded-[14px] border border-td-border bg-td-card flex items-center justify-center cursor-pointer shrink-0">
          <Icon name="back" size={18} color="var(--color-td-dark)" />
        </button>
        <div>
          <div className="text-xl td-strong">{correcting ? 'Correct Attendance' : 'Mark Attendance'}</div>
          <div className="text-xs text-td-muted">{(parseDay(day) ?? new Date()).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>

      {/* A day that has already happened can be opened and put right. Offline it
          cannot: correcting a register the phone is unable to read back would
          mean saving a screen full of Presents over marks nobody can see. */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <label htmlFor="att-day" className="text-xs text-td-subtle font-semibold">Day</label>
        <input
          id="att-day"
          type="date"
          value={day}
          max={today}
          min={isoDay(earliestMarkableDay(new Date()))}
          disabled={!online}
          onChange={e => { setDay(e.target.value || today); setLoadFailed(false) }}
          className="border border-td-border bg-td-card rounded-[12px] px-3 py-2 text-[13px] text-td-dark disabled:opacity-60"
        />
        {correcting && (
          <button onClick={() => { setDay(today); setLoadFailed(false) }} className="text-[12px] font-bold text-td-muted underline cursor-pointer">
            Back to today
          </button>
        )}
      </div>

      {!online && (
        <div className="text-[12px] text-td-muted mb-4">An earlier day can only be corrected while you are online.</div>
      )}

      {correcting && loadFailed && (
        <div className="mb-4 rounded-[14px] border p-3.5 text-[12px] text-td-on-red" style={{ background: 'var(--color-td-tint-red)', borderColor: 'var(--color-td-edge-red)' }}>
          That day&apos;s register could not be loaded, so it cannot be corrected right now. Try again in a moment.
        </div>
      )}

      {/* Marks she made offline that the register had already answered for by
          the time the phone reconnected. Shown rather than resolved, because
          only she knows which of the two is right — and it sits above the
          roster so the correction is one tap away from being re-entered. */}
      {attConflicts.length > 0 && (
        <div className="mb-4 rounded-[14px] border p-3.5" style={{ background: 'var(--color-td-tint-red)', borderColor: 'var(--color-td-edge-red)' }}>
          <div className="text-[13px] font-bold text-td-on-red">
            {attConflicts.length} {attConflicts.length === 1 ? 'mark was' : 'marks were'} already answered by someone else
          </div>
          <div className="text-[12px] text-td-on-red mt-1 mb-2.5 opacity-90">
            These were marked on this phone while it was offline. The centre already had a different answer, so yours was not applied. Mark them again if yours is right.
          </div>
          <ul className="flex flex-col gap-1.5">
            {attConflicts.map((c, i) => (
              <li key={`${c.name}-${c.date}-${i}`} className="text-[12px] text-td-on-red flex flex-wrap gap-x-1.5">
                <span className="font-bold">{c.name}</span>
                <span className="opacity-80">{c.date}</span>
                <span>· you marked {c.mine.toLowerCase()}, centre has {c.theirs.toLowerCase()}</span>
              </li>
            ))}
          </ul>
          <button onClick={dismissAttConflicts} className="mt-3 text-[12px] font-bold underline text-td-on-red cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {classes.length === 0 ? (
        <EmptyState
          title="No students yet"
          hint="Attendance is marked class by class. Add your students first and their classes will appear here."
          actionLabel={role === 'admin' ? 'Add a student' : undefined}
          onAction={role === 'admin' ? () => go('addStudent', 'students') : undefined}
        />
      ) : (
        <>
          <div className="flex gap-[9px] overflow-x-auto mb-4 scrollbar-hide">
            {classes.map(name => {
              const active = name === selClass
              return (
                <Chip key={name} active={active} onClick={() => set({ attClass: name, att: {} })}>{name}</Chip>
              )
            })}
          </div>

          <div className="flex gap-2.5 mb-4">
            <div className="flex-1 bg-td-tint-green rounded-[14px] p-3 text-center">
              <div className="text-[22px] font-extrabold text-td-green">{presentCount}</div>
              <div className="text-[12px] text-td-on-green font-semibold">Present</div>
            </div>
            <div className="flex-1 bg-td-tint-red rounded-[14px] p-3 text-center">
              <div className="text-[22px] font-extrabold text-td-red">{absentCount}</div>
              <div className="text-[12px] text-td-on-red font-semibold">Absent</div>
            </div>
          </div>

          <div className="text-xs text-td-subtle font-semibold mb-2.5">Tap a student to toggle present / absent</div>
          <div className="td-list gap-[9px] mb-5">
            {roster.map((s, i) => {
              const key = studentKey(s)
              const absent = att[key] === 'absent'
              return (
                <button key={key || i} onClick={() => toggleAtt(key)} className="text-left border rounded-2xl p-3 px-3.5 flex items-center gap-[13px] cursor-pointer" style={{ background: absent ? 'var(--color-td-tint-red)' : 'var(--color-td-card)', borderColor: absent ? 'var(--color-td-edge-red)' : 'var(--color-td-border)' }}>
                  <div className="w-[38px] h-[38px] rounded-[11px] shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i) }}>{initials(s.name)}</div>
                  <div className="flex-1 text-[13.5px] font-bold text-td-dark">{s.name}</div>
                  <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: absent ? 'var(--color-td-red)' : 'var(--color-td-green)' }}>
                    <span className="w-[9px] h-[9px] rounded-full" style={{ background: absent ? 'var(--color-td-red)' : 'var(--color-td-green)' }} />
                    {absent ? 'Absent' : 'Present'}
                  </span>
                </button>
              )
            })}
          </div>
          {correcting && (
            <div className="text-[12px] text-td-muted mb-2.5 lg:max-w-2xl">
              This replaces what the centre has for {day}. A child newly marked absent gets a message home naming that day.
            </div>
          )}
          <div className="lg:max-w-xs">
            <PrimaryButton onClick={() => {
              if (!loaded) { notify('That day’s register has not loaded yet', 'error'); return }
              saveAttendance(roster, day)
            }}>{correcting ? 'Save correction' : 'Save attendance'}</PrimaryButton>
          </div>
        </>
      )}
    </div>
  )
}
