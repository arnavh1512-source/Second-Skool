'use client'

import { useEffect } from 'react'
import { useBusy } from '../lib/use-busy'
import { useDashboard, initials, av, fmtDate, rupee } from '../store'
import { ScreenHeader, EmptyState, ConfirmDialog, WhatsAppIcon } from './Shell'
import { supabase } from '../lib/supabase'
import { whatsappShareUrl, weeklyReportMessage, studentReportMessage, copyText } from '../lib/share'
import { useState } from 'react'


export function StaffApprovalsScreen() {
  const { back, staffList, loadStaff, loadMyCentre, joinCode, centreName, approveTeacher, rejectTeacher, grantHead, removeStaff, supabaseUserId, notify } = useDashboard()

  // Reload on open, and live-refresh whenever any profile changes (e.g. a new
  // teacher registers) so pending requests appear without leaving the screen.
  useEffect(() => {
    loadStaff(); loadMyCentre()
    const channel = supabase
      .channel('staff-approvals-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadStaff())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadStaff, loadMyCentre])

  const pending = staffList.filter(s => s.status === 'pending')
  const active = staffList.filter(s => s.status === 'approved')

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Staff access" onBack={back} />

      <div className="text-[13px] text-td-muted leading-relaxed mb-4 lg:max-w-2xl">Approve teachers so they can mark attendance and enter marks. Grant head access only to people you fully trust.</div>

      {joinCode && (
        <button onClick={() => copyText(joinCode, notify, 'Join code copied!')} className="w-full lg:max-w-md text-left border-2 border-dashed border-td-primary bg-td-tint-blue rounded-[16px] p-3.5 mb-5 cursor-pointer flex items-center justify-between">
          <div>
            <div className="text-[12px] font-bold text-td-muted">{centreName || 'Your centre'} · JOIN CODE</div>
            <div className="text-[20px] font-extrabold text-td-primary tracking-[0.15em]">{joinCode}</div>
            <div className="text-[12px] text-td-muted mt-0.5">Share with teachers so they can join your centre.</div>
          </div>
          <div className="text-[12px] font-bold text-td-primary flex items-center gap-1 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </div>
        </button>
      )}

      <div className="text-sm font-extrabold text-td-dark mb-3">Pending approval {pending.length > 0 && <span className="text-td-red">· {pending.length}</span>}</div>
      {pending.length === 0 ? (
        <div className="text-center text-td-muted text-[13px] py-4 bg-td-card border border-td-border rounded-[16px] mb-6">No one waiting</div>
      ) : (
        <div className="flex flex-col gap-2.5 mb-6 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {pending.map((s, i) => (
            <div key={s.id} className="bg-td-card border border-td-border rounded-[16px] p-3.5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i) }}>{initials(s.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-td-dark truncate">{s.name}</div>
                  <div className="text-[12px] text-td-muted truncate">{s.email}</div>
                </div>
              </div>
              {/* What this person said about themselves. The phone is a link
                  because verifying an applicant by calling them is the whole
                  reason it's collected. */}
              {(s.phone || s.subject || s.qualification) && (
                <div className="bg-td-soft border border-td-border rounded-[12px] p-2.5 mb-3 flex flex-col gap-1.5">
                  {s.phone && (
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="text-td-subtle w-[68px] shrink-0">Phone</span>
                      <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="font-bold text-td-primary truncate">{s.phone}</a>
                    </div>
                  )}
                  {s.subject && (
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="text-td-subtle w-[68px] shrink-0">Teaches</span>
                      <span className="font-bold text-td-dark truncate">{s.subject}</span>
                    </div>
                  )}
                  {s.qualification && (
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="text-td-subtle w-[68px] shrink-0">Qualified</span>
                      <span className="font-bold text-td-dark truncate">{s.qualification}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2.5">
                <button onClick={() => approveTeacher(s.id)} className="flex-1 border-none bg-td-green text-white text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer">Approve</button>
                <button onClick={() => rejectTeacher(s.id)} className="flex-1 border border-td-border bg-td-card text-td-muted text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-sm font-extrabold text-td-dark mb-3">Active staff</div>
      {active.length === 0 ? (
        <div className="text-center text-td-muted text-[13px] py-4 bg-td-card border border-td-border rounded-[16px]">No active staff yet</div>
      ) : (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {active.map((s, i) => {
            const isHead = s.role === 'admin'
            const isSelf = s.id === supabaseUserId
            return (
              <div key={s.id} className="bg-td-card border border-td-border rounded-[16px] p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i + 3) }}>{initials(s.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-td-dark truncate">{s.name}{isSelf && <span className="text-td-muted font-semibold"> · you</span>}</div>
                    <div className="text-[12px] text-td-muted truncate">{s.email}</div>
                  </div>
                  <span className="text-[12px] font-bold py-[5px] px-2.5 rounded-[20px]" style={{ color: isHead ? 'var(--color-td-primary)' : 'var(--color-td-green)', background: isHead ? 'var(--color-td-tint-blue)' : 'var(--color-td-tint-green)' }}>{isHead ? 'Head' : 'Teacher'}</span>
                </div>
                {!isHead && (
                  <div className="flex gap-2.5 mt-3">
                    <button onClick={() => grantHead(s.id)} className="flex-1 border border-td-primary bg-td-card text-td-primary text-[12.5px] font-bold py-2.5 rounded-[12px] cursor-pointer">
                      Make head teacher
                    </button>
                    <button onClick={() => removeStaff(s.id)} className="border border-td-edge-red bg-td-wash-red text-td-red text-[12.5px] font-bold py-2.5 px-4 rounded-[12px] cursor-pointer">Remove</button>
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

// Head/teacher review of self-registered students. Approve (optionally setting
// batch/branch + a first fee) turns their code live; reject declines it.
export function StudentRequestsScreen() {
  const { back, pendingStudents, branchesList, batches, refreshData, approveStudent, rejectStudent, role, studentJoinCode, centreName, loadMyCentre, regenerateStudentCode, notify } = useDashboard()

  const [confirmRotate, setConfirmRotate] = useState(false)

  useEffect(() => { refreshData(); loadMyCentre() }, [refreshData, loadMyCentre])

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ConfirmDialog
        open={confirmRotate}
        title="Generate a new student code?"
        body="The current code stops working immediately. Anyone you have already given it to — students yet to register — will need the new one."
        confirmLabel="Generate new code"
        onConfirm={() => { setConfirmRotate(false); regenerateStudentCode() }}
        onCancel={() => setConfirmRotate(false)}
      />
      <ScreenHeader title="Student requests" onBack={back} />
      <div className="text-[13px] text-td-muted leading-relaxed mb-4 lg:max-w-2xl">Students who registered themselves. Review their details, set their batch and fee, then approve — their code only works once you do.</div>

      {studentJoinCode && (
        <div className="w-full lg:max-w-md border-2 border-dashed border-td-primary bg-td-tint-blue rounded-[16px] p-3.5 mb-5">
          <div className="flex items-start justify-between gap-3">
            <button onClick={() => copyText(studentJoinCode, notify, 'Student code copied!')} className="text-left flex-1 min-w-0 cursor-pointer">
              <div className="text-[12px] font-bold text-td-muted">{centreName || 'Your centre'} · STUDENT CODE</div>
              <div className="text-[20px] font-extrabold text-td-primary tracking-[0.15em]">{studentJoinCode}</div>
              <div className="text-[12px] text-td-muted mt-0.5">Share with students so they can register themselves.</div>
            </button>
            <button onClick={() => copyText(studentJoinCode, notify, 'Student code copied!')} className="text-[12px] font-bold text-td-primary flex items-center gap-1 shrink-0 cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
          </div>
          {role === 'admin' && (
            <button
              onClick={() => setConfirmRotate(true)}
              className="text-[12px] font-bold text-td-muted underline mt-2 cursor-pointer"
            >
              Generate a new code
            </button>
          )}
        </div>
      )}

      <div className="text-sm font-extrabold text-td-dark mb-3">Pending {pendingStudents.length > 0 && <span className="text-td-red">· {pendingStudents.length}</span>}</div>
      {pendingStudents.length === 0 ? (
        <div className="text-center text-td-muted text-[13px] py-6 bg-td-card border border-td-border rounded-[16px]">No requests waiting</div>
      ) : (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {pendingStudents.map((s, i) => (
            <StudentRequestCard key={s.dbId} s={s} idx={i} branches={branchesList} batchList={batches} onApprove={approveStudent} onReject={rejectStudent} />
          ))}
        </div>
      )}
    </div>
  )
}

function StudentRequestCard({ s, idx, branches, batchList, onApprove, onReject }: {
  s: import('../store').PendingStudent
  idx: number
  branches: import('../store').BranchItem[]
  batchList: import('../store').BatchItem[]
  onApprove: (dbId: string, klass: string, branchId: string | null, fee: string, feeDue: string, batch?: string) => Promise<void>
  onReject: (dbId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [busy, run] = useBusy()
  const [klass, setKlass] = useState(s.klass)
  const [branch, setBranch] = useState('')
  const [batch, setBatch] = useState('')
  const [fee, setFee] = useState('')
  const [feeDue, setFeeDue] = useState('')

  const confirm = () => run(async () => {
    const branchId = branch ? branches.find(b => b.name === branch)?.dbId ?? null : null
    await onApprove(s.dbId, klass, branchId, fee, feeDue, batch || undefined)
  })

  return (
    <div className="bg-td-card border border-td-border rounded-[16px] p-3.5 self-start">
      <div className="flex items-center gap-3 mb-2.5">
        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(idx) }}>{initials(s.name)}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-td-dark truncate">{s.name}</div>
          <div className="text-[12px] text-td-muted truncate">{s.klass} · {s.school}</div>
        </div>
        {s.when && <span className="text-[12px] text-td-subtle shrink-0">{s.when}</span>}
      </div>
      <div className="text-[12px] text-td-muted leading-relaxed mb-3 bg-td-soft rounded-[10px] p-2.5">
        <div>Parent: <span className="font-semibold text-td-text">{s.parent || '—'}</span></div>
        {s.address && <div>Address: <span className="font-semibold text-td-text">{s.address}</span></div>}
        <div>Code: <span className="font-bold text-td-text tracking-wide">{s.code}</span></div>
      </div>

      {!open ? (
        <div className="flex gap-2.5">
          <button onClick={() => setOpen(true)} className="flex-1 border-none bg-td-green text-white text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer">Approve</button>
          <button onClick={() => onReject(s.dbId)} className="flex-1 border border-td-border bg-td-card text-td-muted text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer">Decline</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2.5">
            <div className="flex-1">
              <label className="text-[12px] font-bold text-td-muted">Batch / class</label>
              <input value={klass} onChange={e => setKlass(e.target.value)} className="w-full border border-td-border rounded-[10px] p-2.5 text-[13px] text-td-dark outline-none focus:border-td-primary mt-1" />
            </div>
            {branches.length > 0 && (
              <div className="flex-1">
                <label className="text-[12px] font-bold text-td-muted">Branch</label>
                <select value={branch} onChange={e => setBranch(e.target.value)} className="w-full border border-td-border rounded-[10px] p-2.5 text-[13px] text-td-dark outline-none focus:border-td-primary mt-1 bg-td-card">
                  <option value="">—</option>
                  {branches.map(b => <option key={b.dbId ?? b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {batchList.length > 0 && (
            <div>
              <label className="text-[12px] font-bold text-td-muted">Batch</label>
              <select value={batch} onChange={e => setBatch(e.target.value)} className="w-full border border-td-border rounded-[10px] p-2.5 text-[13px] text-td-dark outline-none focus:border-td-primary mt-1 bg-td-card">
                <option value="">No batch</option>
                {batchList.map(b => <option key={b.dbId ?? b.name} value={b.name}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2.5">
            <div className="flex-1">
              <label className="text-[12px] font-bold text-td-muted">Fee ₹ <span className="text-td-subtle font-semibold">(optional)</span></label>
              <input value={fee} onChange={e => setFee(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="e.g. 800" className="w-full border border-td-border rounded-[10px] p-2.5 text-[13px] text-td-dark outline-none focus:border-td-primary mt-1" />
            </div>
            <div className="flex-1">
              <label className="text-[12px] font-bold text-td-muted">Due date</label>
              <input type="date" value={feeDue} onChange={e => setFeeDue(e.target.value)} className="w-full border border-td-border rounded-[10px] p-2.5 text-[13px] text-td-dark outline-none focus:border-td-primary mt-1" />
            </div>
          </div>
          <div className="flex gap-2.5 mt-0.5">
            <button onClick={confirm} disabled={busy} className="flex-1 border-none bg-td-green text-white text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer disabled:opacity-60">{busy ? 'Approving…' : 'Confirm approval'}</button>
            <button onClick={() => setOpen(false)} className="border border-td-border bg-td-card text-td-muted text-[13px] font-bold py-2.5 px-4 rounded-[12px] cursor-pointer">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ReportsScreen() {
  const { back, weeklyReport: r, loadWeeklyReport, studentReports, loadStudentReports, teacherActivity, loadTeacherActivity, myPhone, centreName, loadMyCentre, go } = useDashboard()
  const [tab, setTab] = useState<'branches' | 'students' | 'teachers'>('branches')
  const [period, setPeriod] = useState<7 | 30>(7)
  useEffect(() => { loadWeeklyReport(period); loadStudentReports(period); loadTeacherActivity(period); loadMyCentre() }, [period, loadWeeklyReport, loadStudentReports, loadTeacherActivity, loadMyCentre])

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title={period === 7 ? 'Weekly Report' : 'Monthly Report'} onBack={back} right={
        <div className="flex bg-td-soft rounded-[12px] p-[3px]">
          {([7, 30] as const).map(d => (
            <button key={d} onClick={() => setPeriod(d)} className="text-[12px] font-bold py-[7px] px-3 rounded-[10px] cursor-pointer border-none" style={{ background: period === d ? '#fff' : 'transparent', color: period === d ? 'var(--color-td-primary)' : 'var(--color-td-muted)', boxShadow: period === d ? '0 1px 3px rgba(20,30,60,.12)' : 'none' }}>{d === 7 ? 'Week' : 'Month'}</button>
          ))}
        </div>
      } />

      <div className="flex gap-2 mb-4 lg:max-w-md">
        {(['branches', 'students', 'teachers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 text-[12.5px] font-bold py-2.5 rounded-[12px] cursor-pointer border capitalize" style={{ background: tab === t ? 'var(--color-td-primary)' : '#fff', color: tab === t ? '#fff' : 'var(--color-td-text)', borderColor: tab === t ? 'var(--color-td-primary)' : 'var(--color-td-border)' }}>{t}</button>
        ))}
      </div>

      {tab === 'teachers' ? (
        !teacherActivity ? (
          <div className="text-center text-td-muted text-sm py-12">Loading activity…</div>
        ) : teacherActivity.length === 0 ? (
          <div className="text-center text-td-muted text-sm py-10 bg-td-card border border-td-border rounded-[16px]">No approved staff yet.</div>
        ) : (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3">
            <div className="text-[12px] text-td-muted mb-1 lg:col-span-full">What each staff member logged in the last {period} days.</div>
            {teacherActivity.map((t, i) => (
              <div key={`${t.email}-${i}`} className="bg-td-card border border-td-border rounded-[18px] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[14.5px] font-extrabold text-td-dark">{t.name || t.email}</div>
                    <div className="text-[12px] text-td-muted">{t.email}</div>
                  </div>
                  <span className="text-[12px] font-bold py-[5px] px-2.5 rounded-[20px]" style={{ color: t.is_head ? 'var(--color-td-primary)' : 'var(--color-td-green)', background: t.is_head ? 'var(--color-td-tint-blue)' : 'var(--color-td-tint-green)' }}>{t.is_head ? 'Head' : 'Teacher'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { v: t.attendance_marks, l: 'Attendance' },
                    { v: t.tests_entered, l: 'Results' },
                    { v: t.assignments_created, l: 'Assignments' },
                  ].map(x => (
                    <div key={x.l} className="bg-td-soft rounded-[12px] py-2.5">
                      <div className="text-[18px] font-extrabold text-td-dark leading-none">{x.v}</div>
                      <div className="text-[12px] text-td-muted mt-1 font-semibold">{x.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="text-[12px] text-td-subtle text-center leading-relaxed mt-1 lg:col-span-full">Activity is counted from when staff started using the app — older records aren&apos;t attributed.</div>
          </div>
        )
      ) : tab === 'students' ? (
        !studentReports ? (
          <div className="text-center text-td-muted text-sm py-12">Generating reports…</div>
        ) : studentReports.length === 0 ? (
          <EmptyState
            title="No students yet"
            hint="Weekly progress reports are built per student, so there is nothing to send until you have added some."
            actionLabel="Add a student"
            onAction={() => go('addStudent', 'students')}
          />
        ) : (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3">
            <div className="text-[12px] text-td-muted mb-1 lg:col-span-full">Send each parent their child&apos;s weekly progress.</div>
            {studentReports.map((s, i) => {
              const attPct = s.att_total > 0 ? Math.round((s.att_present / s.att_total) * 100) : null
              return (
                <div key={`${s.name}-${s.klass}-${i}`} className="bg-td-card border border-td-border rounded-[18px] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-[14.5px] font-extrabold text-td-dark">{s.name}</div>
                      <div className="text-[12px] text-td-muted">{s.klass}</div>
                    </div>
                    <span className="text-[12px] font-bold py-[5px] px-[9px] rounded-[20px]" style={{ color: s.fee_status === 'Paid' ? 'var(--color-td-green)' : 'var(--color-td-amber)', background: s.fee_status === 'Paid' ? 'var(--color-td-tint-green)' : 'var(--color-td-tint-amber)' }}>{s.fee_status}</span>
                  </div>
                  <div className="text-[12px] text-td-muted mb-3">Attendance: <span className="font-bold text-td-text">{attPct === null ? '—' : `${attPct}%`}</span> · Tests: <span className="font-bold text-td-text">{s.tests}{s.tests > 0 ? ` (avg ${s.avg_pct}%)` : ''}</span></div>
                  <button onClick={() => window.open(whatsappShareUrl(s.parent, studentReportMessage(s, centreName || undefined, period)), '_blank', 'noopener,noreferrer')} disabled={!s.parent} className="w-full border-none bg-[#25D366] text-white text-[13px] font-extrabold py-2.5 rounded-[12px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    <WhatsAppIcon />
                    {s.parent ? 'Send to parent' : 'No parent number'}
                  </button>
                </div>
              )
            })}
          </div>
        )
      ) : !r ? (
        <div className="text-center text-td-muted text-sm py-12">Generating report…</div>
      ) : (
        <>
          <div className="text-[12.5px] text-td-muted mb-4">Last {period} days · as of {fmtDate(r.generated_at)}</div>

          {r.branches.length === 0 ? (
            <div className="text-center text-td-muted text-sm py-8 bg-td-card border border-td-border rounded-[16px] mb-4">No branches configured yet — add branches and assign students to see per-branch numbers.</div>
          ) : (
            <div className="flex flex-col gap-3 mb-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
              {r.branches.map((b, i) => (
                <div key={`${b.name}-${i}`} className="bg-td-card border border-td-border rounded-[18px] p-4">
                  <div className="text-[15px] font-extrabold text-td-dark mb-3">{b.name}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Students', value: `${b.students}${b.new_students ? ` (+${b.new_students})` : ''}` },
                      { label: 'Staff', value: String(b.staff) },
                      { label: 'Attendance', value: `${b.att_pct}%` },
                      { label: 'Fees collected', value: rupee(b.fees_collected) },
                      { label: 'Fees pending', value: rupee(b.fees_pending) },
                    ].map(s => (
                      <div key={s.label}>
                        <div className="text-[17px] font-extrabold text-td-dark leading-none">{s.value}</div>
                        <div className="text-[12px] text-td-muted mt-1 font-semibold">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-td-soft border border-td-border rounded-[14px] p-3.5 text-[12.5px] text-td-muted mb-4 lg:max-w-xl">
            {/* Students created before any branch existed belong to no branch, so
                the per-branch totals above legitimately exclude them. Buried as a
                grey footnote this read as "complete"; it now looks like the
                caveat it is. */}
            {r.unassigned_students > 0 && (
              <div className="bg-td-tint-amber border border-td-edge-amber rounded-[12px] p-2.5 text-td-amber font-bold">
                {r.unassigned_students} student{r.unassigned_students === 1 ? '' : 's'} not assigned to any branch — they are not counted in the per-branch totals above.
              </div>
            )}
            <div>Tests conducted this {period === 7 ? 'week' : 'month'}: <span className="font-bold text-td-text">{r.tests_this_week}</span></div>
          </div>

          <button onClick={() => window.open(whatsappShareUrl(myPhone, weeklyReportMessage(r, centreName || undefined, period)), '_blank', 'noopener,noreferrer')} className="w-full lg:max-w-md border-none bg-[#25D366] text-white text-[14px] font-extrabold py-[14px] rounded-[14px] cursor-pointer flex items-center justify-center gap-2">
            <WhatsAppIcon />
            Send to WhatsApp
          </button>
          <div className="text-[12px] text-td-subtle text-center mt-3 leading-relaxed">Opens WhatsApp with the report ready to send to yourself or a co-owner.</div>
        </>
      )}
    </div>
  )
}
