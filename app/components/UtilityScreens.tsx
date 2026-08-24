'use client'

import { useState, useEffect, useRef } from 'react'
import { indexOfStudent, studentKey } from '../lib/student-key'
import { useBusy } from '../lib/use-busy'
import { useDashboard, REMINDER_TEMPLATES, initials, av, feeColor, parseDay, LIMITS, MIN_PASSWORD_LENGTH, clampText, type Screen, type Student } from '../store'
import { ScreenHeader, PrimaryButton, ChevronRight, EmptyState, ConfirmDialog } from './Shell'
import { Icon, ink, type IconName } from './Icon'
import { enablePush, pushSupported, testNotification } from '../lib/push'
import { fileToLogoDataUrl } from '../lib/image'

export function FeesScreen() {
  const { students, back, notify, addFee, toggleFeeStatus, saveReminder, go, role, feeRecords, loadStudentFees, deleteFee } = useDashboard()
  const [showForm, setShowForm] = useState(false)
  const [selStudent, setSelStudent] = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState('')
  const [dueDate, setDueDate] = useState('')
  // Which student's fee breakdown is open, and which single fee is one
  // confirmation away from being removed. One at a time: this is a list of
  // balances, not a ledger, and expanding everything would fetch the whole
  // centre's fee history to answer a question about one child.
  const [openFees, setOpenFees] = useState<string | null>(null)
  const [confirmFee, setConfirmFee] = useState<{ id: string; studentId: string; student: string; label: string } | null>(null)
  const isAdmin = role === 'admin'
  const paidCount = students.filter(s => s.feeStatus === 'Paid').length
  const pendingCount = students.filter(s => s.feeStatus !== 'Paid').length
  const totalCollected = students.reduce((n, s) => n + (s.feeCollected ?? 0), 0)
  const totalRemaining = students.reduce((n, s) => n + (s.feeDue ?? 0), 0)
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`
  const rows = [...students.filter(d => d.feeStatus !== 'Paid'), ...students.filter(d => d.feeStatus === 'Paid')]

  const handleAdd = async () => {
    if (!selStudent) { notify('Select a student', 'error'); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { notify('Enter a valid amount', 'error'); return }
    // fees.amount is numeric(10,2), so anything larger used to be rejected by
    // Postgres with an error the head never saw — the form just sat there.
    if (amt > LIMITS.feeAmount) { notify(`Amount cannot exceed ₹${LIMITS.feeAmount.toLocaleString('en-IN')}`, 'error'); return }
    if (!period.trim()) { notify('Enter the fee period', 'error'); return }
    if (!dueDate) { notify('Select a due date', 'error'); return }
    if (!(await addFee(selStudent, amt, clampText(period, LIMITS.period), dueDate))) return
    setSelStudent(''); setAmount(''); setPeriod(''); setDueDate(''); setShowForm(false)
  }

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ConfirmDialog
        open={!!confirmFee}
        title="Remove this fee record?"
        body={`${confirmFee?.label ?? ''} comes off ${confirmFee?.student ?? ''}'s balance for good. Use this for a record entered by mistake — marking it Paid instead would record money you never collected.`}
        confirmLabel="Remove fee"
        onConfirm={() => { const t = confirmFee; setConfirmFee(null); if (t) deleteFee(t.id, t.studentId) }}
        onCancel={() => setConfirmFee(null)}
      />
      <ScreenHeader title="Fees" onBack={back} right={
        <button onClick={() => setShowForm(f => !f)} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
          <span className="text-base leading-none">{showForm ? '×' : '+'}</span> {showForm ? 'Close' : 'Add fee'}
        </button>
      } />

      <div className="flex gap-2.5 mb-[18px] lg:max-w-md">
        <div className="flex-1 bg-[#e7f5ee] rounded-2xl p-3.5">
          <div className="text-[21px] font-extrabold text-td-green leading-tight">{inr(totalCollected)}</div>
          <div className="text-[12px] text-[#5a8a72] font-semibold mt-[3px]">Collected · {paidCount} paid</div>
        </div>
        <div className="flex-1 bg-[#fdecea] rounded-2xl p-3.5">
          <div className="text-[21px] font-extrabold text-td-red leading-tight">{inr(totalRemaining)}</div>
          <div className="text-[12px] text-[#a35545] font-semibold mt-[3px]">Remaining · {pendingCount} pending</div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5 lg:max-w-lg">
          <div className="text-sm font-extrabold text-td-dark">Add fee record</div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Student</label>
            <select value={selStudent} onChange={e => setSelStudent(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
              <option value="">Select student</option>
              {students.map(s => <option key={s.dbId ?? s.id} value={s.dbId ?? ''}>{s.name} — {s.klass}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-[11px]">
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Amount (&#8377;)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
            </div>
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Period</label>
              <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. July 2026" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
            </div>
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Due date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
          </div>
          <PrimaryButton onClick={handleAdd}>Add fee record</PrimaryButton>
        </div>
      )}

      <button onClick={() => { if (pendingCount === 0) { notify('No pending fees', 'error'); return } saveReminder('Fee', REMINDER_TEMPLATES.Fee, 'all', 'fees_due') }} className="w-full lg:max-w-md border border-td-red bg-white text-td-red text-sm font-extrabold p-[13px] rounded-[14px] cursor-pointer mb-[18px]">Send alert to all pending</button>

      {rows.length === 0 ? (
        <EmptyState
          title="No students yet"
          hint="Fees are tracked per student, so there is nothing to collect until you have added some."
          actionLabel={role === 'admin' ? 'Add a student' : undefined}
          onAction={role === 'admin' ? () => go('addStudent', 'students') : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {rows.map(d => {
            const realIdx = indexOfStudent(students, studentKey(d))
            const f = feeColor(d.feeStatus)
            const open = !!d.dbId && openFees === d.dbId
            const records = d.dbId ? feeRecords[d.dbId] : undefined
            return (
              <div key={d.id} className="bg-white border border-td-border rounded-2xl p-[13px] px-3.5">
                <div className="flex items-center gap-[13px]">
                  <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(realIdx) }}>{initials(d.name)}</div>
                  {/* The balance was a total with nothing behind it. Tapping the
                      name now opens what it is made of — which is also the only
                      place a fee can be taken back off it. */}
                  <button onClick={() => { if (!d.dbId) return; const next = open ? null : d.dbId; setOpenFees(next); if (next && !feeRecords[next]) loadStudentFees(next) }} className="flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer">
                    <div className="text-[13.5px] font-bold text-td-dark truncate">{d.name}</div>
                    <div className="text-xs text-td-muted mt-0.5">
                      {d.klass}
                      {(d.feeDue ?? 0) > 0 && <span className="text-td-red font-semibold"> · {inr(d.feeDue!)} due</span>}
                      {(d.feeDue ?? 0) === 0 && (d.feeCollected ?? 0) > 0 && <span className="text-td-green font-semibold"> · {inr(d.feeCollected!)} paid</span>}
                    </div>
                  </button>
                  <button onClick={() => toggleFeeStatus(studentKey(d))} className="text-[12px] font-bold py-[5px] px-2.5 rounded-[20px] border-none cursor-pointer shrink-0" style={{ color: f.c, background: f.b }}>{d.feeStatus}</button>
                </div>

                {open && (
                  <div className="mt-3 pt-3 border-t border-td-border flex flex-col gap-2">
                    {records === undefined ? (
                      <div className="text-xs text-td-muted">Loading fee records...</div>
                    ) : records.length === 0 ? (
                      <div className="text-xs text-td-muted">No fee records for {d.name} yet.</div>
                    ) : records.map(r => {
                      const due = parseDay(r.dueDate)
                      const label = `${inr(r.amount)} · ${r.period}`
                      return (
                        <div key={r.dbId} className="flex items-center gap-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="text-[12.5px] font-bold text-td-dark truncate">{label}</div>
                            <div className="text-[11.5px] text-td-muted mt-px">
                              {r.status === 'Paid' ? 'Paid' : 'Due'}
                              {due && ` · ${due.getDate()} ${due.toLocaleString('en', { month: 'short' })} ${due.getFullYear()}`}
                            </div>
                          </div>
                          {isAdmin && (
                            <button onClick={() => setConfirmFee({ id: r.dbId, studentId: d.dbId!, student: d.name, label })} className="shrink-0 border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[11.5px] font-bold py-1 px-2.5 rounded-[10px] cursor-pointer">Remove</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MeetingsScreen() {
  const { back, meetingsList, saveMeeting, deleteMeeting, role } = useDashboard()
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Parent-teacher meeting')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('11:00 AM')
  const [confirmCancel, setConfirmCancel] = useState<{ id: string; title: string } | null>(null)
  // Only the head can delete a meeting — meetings_head is the policy that
  // permits it, and a button a teacher can press but RLS will refuse is worse
  // than no button at all.
  const isAdmin = role === 'admin'

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancel this meeting?"
        body={`"${confirmCancel?.title ?? ''}" is removed from every parent's home screen. They are not told it was cancelled, so let them know yourself.`}
        confirmLabel="Cancel meeting"
        onConfirm={() => { const t = confirmCancel; setConfirmCancel(null); if (t) deleteMeeting(t.id) }}
        onCancel={() => setConfirmCancel(null)}
      />
      <ScreenHeader title="Meetings" onBack={back} />

      <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[22px] flex flex-col gap-3.5">
        <div className="text-sm font-extrabold text-td-dark">Schedule new</div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Parent-teacher meeting" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
            <option>Parent-teacher meeting</option><option>Staff meeting</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Time</label><input value={time} onChange={e => setTime(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        </div>
        <PrimaryButton onClick={async () => { if (await saveMeeting(title, type, date, time)) { setTitle(''); setDate('') } }}>Schedule &amp; invite</PrimaryButton>
      </div>

      <div className="text-[15px] font-extrabold text-td-dark mb-3">All meetings</div>
      {meetingsList.length === 0 ? (
        <EmptyState title="No meetings scheduled" hint="Use the form above to add one — it will appear here and on the home screen." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {meetingsList.map((m, i) => (
            <div key={m.dbId ?? `${m.title}-${m.day}-${i}`} className="bg-white border border-td-border rounded-2xl p-3.5 flex items-center gap-[13px]">
              <div className="w-[46px] text-center shrink-0 bg-[#eaf1fc] rounded-xl py-2">
                <div className="text-base font-extrabold text-td-primary leading-none">{m.day}</div>
                <div className="text-[12px] text-td-primary font-semibold mt-0.5">{m.mon}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-bold text-td-dark">{m.title}</div>
                <div className="text-xs text-td-muted mt-0.5">{m.time} · {m.kind}</div>
              </div>
              {isAdmin && m.dbId && (
                <button onClick={() => setConfirmCancel({ id: m.dbId!, title: m.title })} className="shrink-0 border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12px] font-bold py-1.5 px-3 rounded-[11px] cursor-pointer">Cancel</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RankingsScreen() {
  const { rankSubject, rankData, subjects, back, set, go } = useDashboard()
  const subjectNames = subjects.map(s => s.name)
  const rows = (rankData[rankSubject] || []).map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, score: r.score }))

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Rankings" onBack={back} />

      {subjectNames.length === 0 && (
        <button onClick={() => go('subjects', 'more')} className="w-full text-left bg-[#eaf1fc] border border-[#dbe6fa] rounded-[14px] p-3.5 cursor-pointer text-[12.5px] text-td-primary font-semibold">Add subjects first (More → Subjects) so rankings can be grouped by subject.</button>
      )}

      <div className="flex gap-[9px] overflow-x-auto mb-[18px] scrollbar-hide">
        {subjectNames.map(name => {
          const active = name === rankSubject
          return (
            <button key={name} onClick={() => set({ rankSubject: name })} className="shrink-0 text-[13px] font-bold py-[9px] px-4 rounded-[20px] cursor-pointer border" style={{ background: active ? '#2a6fdb' : '#fff', color: active ? '#fff' : '#3a4456', borderColor: active ? '#2a6fdb' : '#e6eaf2' }}>{name}</button>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">{rankSubject ? `No results entered for ${rankSubject} yet` : 'Enter results to generate rankings'}</div>
      ) : (
        <div className="flex flex-col gap-[9px] mb-5">
          {rows.map((r, i) => (
            <div key={r.id ?? `${r.name}-${i}`} className="flex items-center gap-[13px] bg-white border border-td-border rounded-2xl p-3 px-3.5">
              <div className="w-[26px] text-center text-sm font-extrabold" style={{ color: i < 3 ? '#e0962f' : '#9aa4b6' }}>{r.rank}</div>
              <div className="w-9 h-9 rounded-[11px] shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i) }}>{initials(r.name)}</div>
              <div className="flex-1 text-[13.5px] font-bold text-td-dark">{r.name}</div>
              <div className="text-sm font-extrabold text-td-dark">{r.score}%</div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2.5 bg-[#eaf1fc] border border-[#dbe6fa] rounded-[14px] p-3.5 mt-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>
        <span className="text-[12.5px] text-td-primary font-semibold">Rankings update automatically — students always see the latest.</span>
      </div>
    </div>
  )
}

// Shared roster: shows the students belonging to a batch or branch with full details.
function StudentRoster({ list }: { list: Student[] }) {
  if (list.length === 0) return <div className="text-[12.5px] text-td-muted py-2.5 px-1">No students here yet</div>
  return (
    <div className="flex flex-col gap-2 mt-1">
      {list.map((s, i) => (
        <div key={s.dbId ?? s.id} className="bg-td-bg border border-td-border rounded-[14px] p-[11px] px-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-[11px] shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i) }}>{initials(s.name)}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-bold text-td-dark truncate">{s.name}</div>
            <div className="text-[12px] text-td-muted truncate">{s.klass}{s.school ? ` · ${s.school}` : ''}</div>
            <div className="text-[12px] text-td-subtle truncate">{s.id}{s.parent ? ` · ${s.parent}` : ''}</div>
          </div>
          <span className="text-[12px] font-bold py-1 px-2.5 rounded-[20px] shrink-0" style={{ color: feeColor(s.feeStatus).c, background: feeColor(s.feeStatus).b }}>{s.feeStatus}</span>
        </div>
      ))}
    </div>
  )
}

export function BranchesScreen() {
  const { back, branchesList, students, addBranch, deleteBranch } = useDashboard()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [isMain, setIsMain] = useState(false)
  const [openBranch, setOpenBranch] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!name.trim()) { useDashboard.getState().notify('Enter branch name', 'error'); return }
    if (!(await addBranch(name.trim(), address.trim(), isMain))) return
    setName(''); setAddress(''); setIsMain(false); setShowForm(false)
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Branches" onBack={back} right={
        <button onClick={() => setShowForm(f => !f)} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
          <span className="text-base leading-none">{showForm ? '×' : '+'}</span> {showForm ? 'Close' : 'Add'}
        </button>
      } />

      {showForm && (
        <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5">
          <div className="text-sm font-extrabold text-td-dark">New branch</div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Branch name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Satellite Centre" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 123 Main Street" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isMain} onChange={e => setIsMain(e.target.checked)} className="w-5 h-5 accent-[#2a6fdb] rounded" />
            <span className="text-[13px] font-bold text-td-dark">Set as main branch</span>
          </label>
          <PrimaryButton onClick={handleAdd}>Add branch</PrimaryButton>
        </div>
      )}

      {branchesList.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No branches configured</div>
      ) : (
        <div className="flex flex-col gap-3">
          {branchesList.map(b => {
            const roster = students.filter(s => s.branch === b.name)
            const open = openBranch === b.name
            return (
            <div key={b.dbId ?? b.name} className="bg-white border border-td-border rounded-[18px] p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-[15px] font-extrabold text-td-dark">{b.name}</div>
                {b.main && <span className="text-[12px] font-bold text-td-primary bg-[#eaf1fc] py-1 px-[9px] rounded-[20px]">Main</span>}
              </div>
              <div className="text-[12.5px] text-td-muted mb-3">{b.address}</div>
              <div className="flex items-center justify-between">
                <button onClick={() => setOpenBranch(open ? null : b.name)} className="flex gap-[18px] bg-transparent border-none p-0 cursor-pointer text-left">
                  <div><div className="text-base font-extrabold text-td-dark">{roster.length}</div><div className="text-[12px] text-td-subtle font-semibold">Students {roster.length > 0 && <span className="text-td-primary">{open ? '▲' : '▼'}</span>}</div></div>
                  <div><div className="text-base font-extrabold text-td-dark">{b.staff}</div><div className="text-[12px] text-td-subtle font-semibold">Staff</div></div>
                </button>
                {b.dbId && <button onClick={() => deleteBranch(b.dbId!)} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12px] font-bold py-2 px-3.5 rounded-[12px] cursor-pointer">Remove</button>}
              </div>
              {open && <StudentRoster list={roster} />}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SubjectsScreen() {
  const { subjects, back, addSubject, deleteSubject } = useDashboard()
  const [name, setName] = useState('')
  const [confirmSubject, setConfirmSubject] = useState<{ id: string; name: string } | null>(null)

  const handleAdd = async () => {
    if (!name.trim()) { useDashboard.getState().notify('Enter subject name', 'error'); return }
    if (await addSubject(name.trim())) setName('')
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ConfirmDialog
        open={!!confirmSubject}
        title={`Remove ${confirmSubject?.name ?? ''}?`}
        body="Its tests, results and timetable periods are deleted with it. This cannot be undone."
        confirmLabel="Remove subject"
        onConfirm={() => { const t = confirmSubject; setConfirmSubject(null); if (t) deleteSubject(t.id) }}
        onCancel={() => setConfirmSubject(null)}
      />
      <ScreenHeader title="Subjects" onBack={back} />

      <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5">
        <div className="text-sm font-extrabold text-td-dark">Add subject</div>
        <div className="flex gap-[11px]">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mathematics" className="flex-1 border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} className="border-none bg-td-primary text-white text-sm font-bold py-[13px] px-5 rounded-[14px] cursor-pointer shrink-0">Add</button>
        </div>
      </div>

      <div className="text-[15px] font-extrabold text-td-dark mb-3">All subjects ({subjects.length})</div>
      {subjects.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No subjects added yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {subjects.map((s, i) => (
            <div key={s.dbId} className="bg-white border border-td-border rounded-2xl p-[13px] px-[15px] flex items-center gap-[13px]">
              <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[14px]" style={{ background: av(i) }}>{s.name[0]}</div>
              <div className="flex-1 text-[14px] font-bold text-td-dark">{s.name}</div>
              {s.dbId && <button onClick={() => setConfirmSubject({ id: s.dbId!, name: s.name })} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12px] font-bold py-1.5 px-3 rounded-[11px] cursor-pointer">Remove</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function BatchesScreen() {
  const { batches, students, back, addBatch, deleteBatch } = useDashboard()
  const [name, setName] = useState('')
  const [openBatch, setOpenBatch] = useState<string | null>(null)
  const [confirmBatch, setConfirmBatch] = useState<{ id: string; name: string } | null>(null)

  const handleAdd = async () => {
    if (!name.trim()) { useDashboard.getState().notify('Enter batch name', 'error'); return }
    if (await addBatch(name.trim())) setName('')
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ConfirmDialog
        open={!!confirmBatch}
        title={`Remove batch ${confirmBatch?.name ?? ''}?`}
        body="Students keep every record — attendance, marks and fees. Only the batch label goes."
        confirmLabel="Remove batch"
        onConfirm={() => { const t = confirmBatch; setConfirmBatch(null); if (t) deleteBatch(t.id) }}
        onCancel={() => setConfirmBatch(null)}
      />
      <ScreenHeader title="Batches" onBack={back} />

      <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5">
        <div className="text-sm font-extrabold text-td-dark">Add batch</div>
        <div className="flex gap-[11px]">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning 10-A" className="flex-1 border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} className="border-none bg-td-primary text-white text-sm font-bold py-[13px] px-5 rounded-[14px] cursor-pointer shrink-0">Add</button>
        </div>
      </div>

      <div className="text-[15px] font-extrabold text-td-dark mb-3">All batches ({batches.length})</div>
      {batches.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No batches added yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {batches.map((b, i) => {
            const roster = students.filter(s => s.batch === b.name)
            const open = openBatch === b.name
            return (
            <div key={b.dbId} className="bg-white border border-td-border rounded-2xl p-[13px] px-[15px]">
              <div className="flex items-center gap-[13px]">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[14px]" style={{ background: av(i) }}>{b.name[0]}</div>
                <button onClick={() => setOpenBatch(open ? null : b.name)} className="flex-1 min-w-0 bg-transparent border-none p-0 cursor-pointer text-left">
                  <div className="text-[14px] font-bold text-td-dark truncate">{b.name}</div>
                  <div className="text-[12px] text-td-muted font-semibold">{roster.length} student{roster.length === 1 ? '' : 's'} {roster.length > 0 && <span className="text-td-primary">{open ? '▲' : '▼'}</span>}</div>
                </button>
                {b.dbId && <button onClick={() => setConfirmBatch({ id: b.dbId!, name: b.name })} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12px] font-bold py-1.5 px-3 rounded-[11px] cursor-pointer shrink-0">Remove</button>}
              </div>
              {open && <StudentRoster list={roster} />}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

type MoreItem = { icon: IconName; label: string; tint: string; screen: Screen; badge?: number }

export function MoreScreen() {
  const { goFrom, signOut, role, myName, googleEmail, staffList, loadStaff, pendingStudents } = useDashboard()
  const isAdmin = role === 'admin'
  const profileName = myName || googleEmail?.split('@')[0] || (isAdmin ? 'Head teacher' : 'Teacher')

  // Head: keep the approvals badge fresh (Admin Dashboard now lives here).
  useEffect(() => { if (isAdmin) loadStaff() }, [isAdmin, loadStaff])
  const pendingCount = staffList.filter(s => s.status === 'pending').length
  const studentRequestCount = pendingStudents.length

  const daily: MoreItem[] = [
    { icon: 'requests', label: 'Student requests', tint: '#e7f5ee', screen: 'studentRequests', badge: studentRequestCount },
    { icon: 'attendance', label: 'Mark attendance', tint: '#e7f5ee', screen: 'attendance' },
    { icon: 'results', label: 'Enter results', tint: '#eaf1fc', screen: 'results' },
    { icon: 'homework', label: 'Assignments', tint: '#fcf3e3', screen: 'assign' },
    { icon: 'notes', label: 'Study material', tint: '#eef0fc', screen: 'notes' },
    { icon: 'reminder', label: 'Send reminders', tint: '#fdecea', screen: 'reminder' },
  ]
  const management: MoreItem[] = [
    { icon: 'approvals', label: 'Staff access & approvals', tint: '#eef0fc', screen: 'staffApprovals', badge: pendingCount },
    { icon: 'reports', label: 'Weekly report', tint: '#e7f5ee', screen: 'reports' },
    { icon: 'fees', label: 'Fees & alerts', tint: '#e7f5ee', screen: 'fees' },
    { icon: 'rankings', label: 'Rankings', tint: '#fcf3e3', screen: 'rankings' },
    { icon: 'meetings', label: 'Meetings', tint: '#eaf1fc', screen: 'meetings' },
    { icon: 'branches', label: 'Branches', tint: '#eef0fc', screen: 'branches' },
    { icon: 'subjects', label: 'Subjects', tint: '#eaf1fc', screen: 'subjects' },
    { icon: 'batches', label: 'Batches', tint: '#e7f5ee', screen: 'batches' },
  ]

  const card = (list: MoreItem[]) => (
    <div className="bg-white border border-td-border rounded-[20px] overflow-hidden">
      {list.map(m => (
        <button key={m.label} onClick={() => goFrom(m.screen, 'more', 'more')} className="w-full text-left border-none bg-transparent border-b border-[#f0f2f7] p-[15px] px-[17px] flex items-center gap-3.5 cursor-pointer last:border-b-0">
          <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: m.tint, color: ink(m.tint) }}><Icon name={m.icon} size={20} /></div>
          <div className="flex-1 text-sm font-bold text-td-dark">{m.label}</div>
          {!!m.badge && m.badge > 0 && <span className="text-[12px] font-extrabold text-white bg-td-red rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">{m.badge}</span>}
          <ChevronRight />
        </button>
      ))}
    </div>
  )

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="text-2xl font-extrabold text-td-dark mt-1.5 mb-[18px]">More tools</div>

      <button onClick={() => goFrom('staffProfile', 'more', 'more')} className="w-full text-left bg-white border border-td-border rounded-[20px] p-3.5 flex items-center gap-3.5 cursor-pointer mb-4">
        <div className="w-[46px] h-[46px] rounded-[14px] shrink-0 flex items-center justify-center text-white font-bold text-[15px]" style={{ background: av(0) }}>{initials(profileName)}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-td-dark truncate">{profileName}</div>
          <div className="text-xs text-td-muted mt-0.5 truncate">{googleEmail} · {isAdmin ? 'Head teacher' : 'Teacher'}</div>
        </div>
        <ChevronRight />
      </button>

      {card(daily)}

      {isAdmin && (
        <>
          <div className="text-[13px] font-extrabold text-td-muted mt-5 mb-[11px] px-1">Management</div>
          {card(management)}
        </>
      )}


      <button onClick={signOut} className="w-full border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-sm font-extrabold p-[15px] rounded-2xl cursor-pointer mt-4 flex items-center justify-center gap-[9px]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e8553c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
        Sign out
      </button>
    </div>
  )
}

// Head/teacher notifications: the actionable items that need attention —
// student self-registration requests, and (head only) staff access requests —
// plus a device push toggle. Mirrors the student notifications bell.
export function NotificationsScreen() {
  const { go, role, pendingStudents, staffList, loadStaff, refreshData, supabaseUserId, notify } = useDashboard()
  const isAdmin = role === 'admin'

  // Pull fresh counts on open so the list reflects reality, not stale state.
  useEffect(() => { refreshData(); if (isAdmin) loadStaff() }, [refreshData, loadStaff, isAdmin])

  const studentCount = pendingStudents.length
  const staffCount = isAdmin ? staffList.filter(s => s.status === 'pending').length : 0
  const empty = studentCount === 0 && staffCount === 0

  const [pushBusy, runPush] = useBusy()
  const [pushOn, setPushOn] = useState(false)
  const enableNotifs = () => runPush(async () => {
    if (!supabaseUserId) return
    const res = await enablePush('profile', supabaseUserId)
    if (res.ok) { setPushOn(true); const t = await testNotification(useDashboard.getState().centreName); notify(t.ok ? 'Notifications on — check for a test alert' : (t.error || 'Notifications on for this device')) }
    else notify(res.error || 'Could not enable')
  })

  const row = (icon: IconName, tint: string, label: string, count: number, screen: Screen) => (
    <button onClick={() => go(screen, 'home')} className="w-full text-left border-none bg-white border border-td-border rounded-[18px] p-4 flex items-center gap-3.5 cursor-pointer mb-2.5">
      <div className="w-11 h-11 rounded-[13px] shrink-0 flex items-center justify-center" style={{ background: tint, color: ink(tint) }}><Icon name={icon} size={22} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-extrabold text-td-dark">{label}</div>
        <div className="text-[12px] text-td-muted mt-0.5">{count} waiting for your review</div>
      </div>
      <span className="text-[12px] font-extrabold text-white bg-td-red rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">{count}</span>
      <ChevronRight />
    </button>
  )

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Notifications" onBack={() => go('home', 'home')} />

      {empty ? (
        <div className="flex flex-col items-center text-center py-14">
          <div className="w-16 h-16 rounded-[20px] bg-[#e7f5ee] flex items-center justify-center mb-4">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2fa36b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
          </div>
          <div className="text-[16px] font-extrabold text-td-dark">You&apos;re all caught up</div>
          <div className="text-[13px] text-td-muted mt-1 max-w-[240px]">New student and staff requests will show up here.</div>
        </div>
      ) : (
        <>
          {studentCount > 0 && row('requests', '#e7f5ee', 'Student join requests', studentCount, 'studentRequests')}
          {staffCount > 0 && row('approvals', '#eef0fc', 'Staff access requests', staffCount, 'staffApprovals')}
        </>
      )}

      {pushSupported() && (
        <button onClick={enableNotifs} disabled={pushOn || pushBusy} className="w-full border border-td-border bg-white text-td-dark text-sm font-extrabold p-[15px] rounded-2xl cursor-pointer mt-3 flex items-center justify-center gap-2 disabled:opacity-60">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
          {pushOn ? 'Notifications enabled' : pushBusy ? 'Enabling…' : 'Enable notifications on this device'}
        </button>
      )}
    </div>
  )
}

export function StaffProfileScreen() {
  const { go, role, myName, myPhone, mySubject, myQualification, googleEmail, saveStaffProfile, signOut, centreName, centreLogo, loadMyCentre, renameCentre, saveCentreLogo, supabaseUserId, notify, setMyPassword } = useDashboard()
  const isAdmin = role === 'admin'
  const logoInput = useRef<HTMLInputElement>(null)
  const [logoBusy, runLogo] = useBusy()
  const pickLogo = (file?: File) => runLogo(async () => {
    if (!file) return
    try { await saveCentreLogo(await fileToLogoDataUrl(file)) }
    catch (e) { notify(e instanceof Error ? e.message : 'Could not use that image') }
    finally { if (logoInput.current) logoInput.current.value = '' }
  })
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, runPush] = useBusy()
  const enableNotifs = () => runPush(async () => {
    if (!supabaseUserId) return
    const res = await enablePush('profile', supabaseUserId)
    if (res.ok) { setPushOn(true); const t = await testNotification(useDashboard.getState().centreName); notify(t.ok ? 'Notifications on — check for a test alert' : (t.error || 'Notifications on for this device')) }
    else notify(res.error || 'Could not enable')
  })
  const [name, setName] = useState(myName)
  const [phone, setPhone] = useState(myPhone)
  const [subject, setSubject] = useState(mySubject)
  const [qualification, setQualification] = useState(myQualification)
  const [centre, setCentre] = useState(centreName)
  const [busy, run] = useBusy()
  const displayName = name || googleEmail?.split('@')[0] || (isAdmin ? 'Head teacher' : 'Teacher')

  useEffect(() => { if (isAdmin && !centreName) loadMyCentre() }, [isAdmin, centreName, loadMyCentre])

  // Sync the input when the centre name arrives (adjust-during-render pattern).
  const [prevCentreName, setPrevCentreName] = useState(centreName)
  if (centreName !== prevCentreName) { setPrevCentreName(centreName); setCentre(centreName) }

  const save = () => run(async () => {
    // Only touch the centre name if the profile itself saved — otherwise a
    // rejected phone number would still rename the centre, which looks like a
    // partial success and is hard to reason about.
    if (await saveStaffProfile({ name, phone, subject, qualification })
      && isAdmin && centre.trim() && centre.trim() !== centreName) await renameCentre(centre)
  })

  // Set an email+password login so this device (esp. the installed home-screen
  // app) can sign in without Google's redirect, which drops the session.
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwOpen, setPwOpen] = useState(false)
  const [pwBusy, runPw] = useBusy()
  const savePassword = () => runPw(async () => {
    if (pw !== pw2) { notify('Passwords do not match'); return }
    if (await setMyPassword(pw)) { setPw(''); setPw2(''); setPwOpen(false) }
  })

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="My Profile" onBack={() => go('more', 'more')} />

      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-[76px] h-[76px] rounded-[24px] flex items-center justify-center text-white font-extrabold text-[26px] mb-3" style={{ background: av(0) }}>{initials(displayName)}</div>
        <div className="text-[18px] font-extrabold text-td-dark">{displayName}</div>
        <div className="text-[12.5px] text-td-muted mt-0.5">{googleEmail}</div>
        <div className="inline-flex items-center gap-[6px] bg-[#e7f5ee] rounded-[20px] py-[5px] px-[11px] mt-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-td-green" />
          <span className="text-[12px] font-bold text-td-green">{isAdmin ? 'Head teacher' : 'Teacher'}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 mb-[18px]">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Full name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Subject you teach</label><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Mathematics, Physics" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Qualification</label><input value={qualification} onChange={e => setQualification(e.target.value)} placeholder="e.g. M.Sc. Mathematics" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        {isAdmin && (
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Centre name</label><input value={centre} onChange={e => setCentre(e.target.value)} placeholder="e.g. Bright Future Tuition" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        )}
        {isAdmin && (
          <div>
            <label className="text-xs font-bold text-td-muted mb-[7px] block">Centre logo</label>
            <div className="flex items-center gap-3.5 border border-td-border rounded-[14px] p-3">
              <div className="w-14 h-14 rounded-[14px] overflow-hidden shrink-0 flex items-center justify-center bg-[#f4f6fb] border border-td-border">
                {centreLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={centreLogo} alt="Centre logo" className="w-full h-full object-cover" />
                  : <span className="font-extrabold text-td-primary text-xl">{initials(centre || centreName || 'S')}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex gap-2">
                  <button onClick={() => logoInput.current?.click()} disabled={logoBusy} className="border border-td-border bg-white text-td-dark text-[12.5px] font-extrabold py-2 px-3.5 rounded-[11px] cursor-pointer disabled:opacity-60">{logoBusy ? 'Uploading…' : centreLogo ? 'Change' : 'Upload'}</button>
                  {centreLogo && !logoBusy && (
                    <button onClick={() => saveCentreLogo('')} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12.5px] font-extrabold py-2 px-3.5 rounded-[11px] cursor-pointer">Remove</button>
                  )}
                </div>
                <p className="text-[12px] text-td-muted mt-1.5 leading-snug">Students who log in with your centre code see this logo.</p>
              </div>
              <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={e => pickLogo(e.target.files?.[0])} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2.5 bg-[#f4f6fb] border border-[#e6eaf2] rounded-[14px] p-3">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa4b6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          <span className="text-[12px] text-td-muted">Your email is managed by Google and can&apos;t be changed here.</span>
        </div>
      </div>

      <PrimaryButton onClick={save}>{busy ? 'Saving…' : 'Save changes'}</PrimaryButton>

      {pushSupported() && (
        <button onClick={enableNotifs} disabled={pushOn || pushBusy} className="w-full border border-td-border bg-white text-td-dark text-sm font-extrabold p-[15px] rounded-2xl cursor-pointer mt-3 flex items-center justify-center gap-2 disabled:opacity-60">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
          {pushOn ? 'Notifications enabled' : 'Enable notifications'}
        </button>
      )}

      {!pwOpen ? (
        <button onClick={() => setPwOpen(true)} className="w-full border border-td-border bg-white text-td-dark text-sm font-extrabold p-[15px] rounded-2xl cursor-pointer mt-3 flex items-center justify-center gap-2">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Set password for phone login
        </button>
      ) : (
        <div className="border border-td-border rounded-2xl p-4 mt-3">
          <div className="text-sm font-extrabold text-td-dark">Set a password</div>
          <p className="text-[12px] text-td-muted mt-1 leading-snug">Then sign in on the home-screen app with your email + this password — it keeps you logged in.</p>
          <input value={pw} type="password" autoComplete="new-password" onChange={e => setPw(e.target.value)} placeholder={`New password (min ${MIN_PASSWORD_LENGTH} chars)`} className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-3" />
          <input value={pw2} type="password" autoComplete="new-password" onChange={e => setPw2(e.target.value)} onKeyDown={e => e.key === 'Enter' && !pwBusy && savePassword()} placeholder="Confirm password" className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-2.5" />
          <div className="flex gap-2 mt-3">
            <button onClick={savePassword} disabled={pwBusy} className="flex-1 border-none bg-td-primary text-white text-[13.5px] font-extrabold py-[12px] rounded-[12px] cursor-pointer disabled:opacity-60">{pwBusy ? 'Saving…' : 'Save password'}</button>
            <button onClick={() => { setPwOpen(false); setPw(''); setPw2('') }} className="border border-td-border bg-white text-td-muted text-[13.5px] font-bold py-[12px] px-4 rounded-[12px] cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      <button onClick={signOut} className="w-full border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-sm font-extrabold p-[15px] rounded-2xl cursor-pointer mt-3 flex items-center justify-center gap-[9px]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e8553c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
        Sign out
      </button>
    </div>
  )
}

