'use client'

import { useEffect, useRef, useState } from 'react'
import { isoDay, parseDay } from '../store/format'
import { useDashboard } from '../store'
import { PrimaryButton, EmptyState, Chip, ConfirmDialog, classesOf } from './Shell'
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
  // What the register looked like when she last seeded or saved it, so leaving
  // a class can tell her taps apart from what the centre already has.
  const baseline = useRef<Record<string, string>>({})
  const [leaving, setLeaving] = useState<(() => void) | null>(null)
  useEffect(() => {
    if (!ready) return
    const seedKey = `${day}|${selClass}`
    if (seededFor.current === seedKey) return
    seededFor.current = seedKey
    baseline.current = seedMarks(roster, recorded, queuedMarksForDay(attQueue, day))
    set({ attClass: selClass, att: baseline.current })
  }, [ready, day, selClass, roster, recorded, attQueue, set])
  const switchClass = (name: string) => set({ attClass: name, att: {} })
  // Every way off this register (another class, another day, Back) reseeds it,
  // so each one asks first when marks are unsaved.
  const guard = (leave: () => void) => {
    const unsaved = roster.some(s => att[studentKey(s)] !== baseline.current[studentKey(s)])
    if (unsaved) setLeaving(() => leave)
    else leave()
  }
  const pickClass = (name: string) => { if (name !== selClass) guard(() => switchClass(name)) }
  const pickDay = (d: string) => guard(() => { setDay(d); setLoadFailed(false) })
  const absentCount = roster.reduce((a, s) => a + (att[studentKey(s)] === 'absent' ? 1 : 0), 0)
  const presentCount = roster.length - absentCount

  return (
    <div className="td-screen td-wide">
      <div className="flex items-center gap-3.5 mb-[18px]">
        <button onClick={() => guard(back)} aria-label="Back" className="td-icon-btn shrink-0">
          <Icon name="back" size={18} color="var(--color-td-dark)" />
        </button>
        <div>
          <div className="text-td-title font-semibold tracking-[-.01em] text-td-dark">{correcting ? 'Correct attendance' : 'Mark attendance'}</div>
          <div className="td-num text-td-small text-td-muted mt-0.5">{(parseDay(day) ?? new Date()).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>

      {/* A day that has already happened can be opened and put right. Offline it
          cannot: correcting a register the phone is unable to read back would
          mean saving a screen full of Presents over marks nobody can see. */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <label htmlFor="att-day" className="td-eyebrow">Day</label>
        <input
          id="att-day"
          type="date"
          value={day}
          max={today}
          min={isoDay(earliestMarkableDay(new Date()))}
          disabled={!online}
          onChange={e => pickDay(e.target.value || today)}
          className="td-num border border-td-border bg-td-card rounded-td px-3 py-2 min-h-11 text-td-small text-td-dark disabled:opacity-60"
        />
        {correcting && (
          <button onClick={() => pickDay(today)} className="td-plain text-td-small font-semibold text-td-dark underline min-h-11 cursor-pointer">
            Back to today
          </button>
        )}
      </div>

      {!online && (
        <div className="text-td-caption text-td-muted mb-4">An earlier day can only be corrected while you are online.</div>
      )}

      {correcting && loadFailed && (
        <div className="mb-4 border border-td-edge-red bg-td-tint-red p-3.5 text-td-small text-td-on-red">
          That day&apos;s register could not be loaded, so it cannot be corrected right now. Try again in a moment.
        </div>
      )}

      {/* Marks she made offline that the register had already answered for by
          the time the phone reconnected. Shown rather than resolved, because
          only she knows which of the two is right — and it sits above the
          roster so the correction is one tap away from being re-entered. */}
      {attConflicts.length > 0 && (
        <div className="mb-4 border border-td-edge-red bg-td-tint-red p-3.5">
          <div className="text-td-small font-semibold text-td-on-red">
            {attConflicts.length} {attConflicts.length === 1 ? 'mark was' : 'marks were'} already answered by someone else
          </div>
          <div className="text-td-caption text-td-on-red mt-1 mb-2.5 opacity-90">
            These were marked on this phone while it was offline. The centre already had a different answer, so yours was not applied. Mark them again if yours is right.
          </div>
          <ul className="flex flex-col gap-1.5">
            {attConflicts.map((c, i) => (
              <li key={`${c.name}-${c.date}-${i}`} className="text-td-caption text-td-on-red flex flex-wrap gap-x-1.5">
                <span className="font-semibold">{c.name}</span>
                <span className="opacity-80">{c.date}</span>
                <span>· you marked {c.mine.toLowerCase()}, centre has {c.theirs.toLowerCase()}</span>
              </li>
            ))}
          </ul>
          <button onClick={dismissAttConflicts} className="td-plain mt-3 text-td-small font-semibold underline text-td-on-red min-h-11 cursor-pointer">
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
          <ConfirmDialog
            open={!!leaving}
            title={`Leave ${selClass} without saving?`}
            body="The marks you changed in this class are not saved yet and will be lost."
            confirmLabel="Leave without saving"
            onConfirm={() => { leaving?.(); setLeaving(null) }}
            onCancel={() => setLeaving(null)}
          />
          <div className="flex flex-wrap gap-[7px] mb-5">
            {classes.map(name => {
              const active = name === selClass
              return (
                <Chip key={name} active={active} onClick={() => pickClass(name)}>{name}</Chip>
              )
            })}
          </div>

          <div className="td-h2 mb-0 flex justify-between">
            <span>{roster.length} {roster.length === 1 ? 'student' : 'students'}</span>
            <span className={`td-num tracking-[.06em] ${absentCount ? 'text-td-on-red' : 'text-td-muted'}`}>{absentCount} absent</span>
          </div>
          <div className="lg:max-w-2xl">
            {roster.map((s, i) => {
              const key = studentKey(s)
              const absent = att[key] === 'absent'
              return (
                <button key={key || i} onClick={() => toggleAtt(key)} aria-pressed={absent} className={`td-plain w-full text-left flex items-center gap-3 py-[11px] border-b border-td-line min-h-14 cursor-pointer ${absent ? 'bg-td-wash-red' : ''}`}>
                  <span className={`td-num text-td-caption text-td-muted border border-td-border px-1.5 py-[3px] ${absent ? 'ml-1.5' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 text-td-body font-medium text-td-dark">{s.name}</span>
                  <span className={`td-tag border px-2.5 py-1.5 ${absent ? 'mr-1.5 border-td-red bg-td-red text-td-on-solid' : 'border-td-green bg-td-tint-green text-td-on-green'}`}>{absent ? 'Absent' : 'Present'}</span>
                </button>
              )
            })}
            <div className="text-td-body leading-[22px] text-td-text py-3">Everyone starts present — tap a row to mark absent.</div>
          </div>
          {correcting && (
            <div className="text-td-caption text-td-muted mb-2.5 lg:max-w-2xl">
              This replaces what the centre has for {day}. A child newly marked absent gets a message home naming that day.
            </div>
          )}
          {/* The save bar rides the bottom of the register, so the count she is
              about to send is always in view while she marks. */}
          <div className="sticky bottom-0 -mx-5 px-5 pt-3.5 pb-5 border-t border-td-border bg-td-bg lg:static lg:mx-0 lg:px-0 lg:border-0 lg:max-w-xs">
            <PrimaryButton onClick={() => {
              if (!loaded) { notify('That day’s register has not loaded yet', 'error'); return }
              saveAttendance(roster, day)
              baseline.current = { ...att }
            }}>{correcting ? 'Save correction' : 'Save'} · {presentCount} present, {absentCount} absent</PrimaryButton>
          </div>
        </>
      )}
    </div>
  )
}
