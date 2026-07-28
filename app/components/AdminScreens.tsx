'use client'

import { useEffect } from 'react'
import { useDashboard, initials, av } from '../store'
import { ScreenHeader } from './Shell'
import { supabase } from '../lib/supabase'
import { whatsappShareUrl, weeklyReportMessage, studentReportMessage } from '../lib/share'
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
        <button onClick={() => { navigator.clipboard.writeText(joinCode); notify('Join code copied!') }} className="w-full lg:max-w-md text-left border-2 border-dashed border-td-primary bg-[#eaf1fc] rounded-[16px] p-3.5 mb-5 cursor-pointer flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-td-muted">{centreName || 'Your centre'} · JOIN CODE</div>
            <div className="text-[20px] font-extrabold text-td-primary tracking-[0.15em]">{joinCode}</div>
            <div className="text-[11px] text-td-muted mt-0.5">Share with teachers so they can join your centre.</div>
          </div>
          <div className="text-[11px] font-bold text-td-primary flex items-center gap-1 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </div>
        </button>
      )}

      <div className="text-sm font-extrabold text-td-dark mb-3">Pending approval {pending.length > 0 && <span className="text-td-red">· {pending.length}</span>}</div>
      {pending.length === 0 ? (
        <div className="text-center text-td-muted text-[13px] py-4 bg-white border border-td-border rounded-[16px] mb-6">No one waiting</div>
      ) : (
        <div className="flex flex-col gap-2.5 mb-6 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {pending.map((s, i) => (
            <div key={s.id} className="bg-white border border-td-border rounded-[16px] p-3.5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i) }}>{initials(s.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-td-dark truncate">{s.name}</div>
                  <div className="text-[11.5px] text-td-muted truncate">{s.email}</div>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => approveTeacher(s.id)} className="flex-1 border-none bg-td-green text-white text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer">Approve</button>
                <button onClick={() => rejectTeacher(s.id)} className="flex-1 border border-td-border bg-white text-td-muted text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-sm font-extrabold text-td-dark mb-3">Active staff</div>
      {active.length === 0 ? (
        <div className="text-center text-td-muted text-[13px] py-4 bg-white border border-td-border rounded-[16px]">No active staff yet</div>
      ) : (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {active.map((s, i) => {
            const isHead = s.role === 'admin'
            const isSelf = s.id === supabaseUserId
            return (
              <div key={s.id} className="bg-white border border-td-border rounded-[16px] p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i + 3) }}>{initials(s.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-td-dark truncate">{s.name}{isSelf && <span className="text-td-muted font-semibold"> · you</span>}</div>
                    <div className="text-[11.5px] text-td-muted truncate">{s.email}</div>
                  </div>
                  <span className="text-[10.5px] font-bold py-[5px] px-2.5 rounded-[20px]" style={{ color: isHead ? '#2a6fdb' : '#2fa36b', background: isHead ? '#eaf1fc' : '#e7f5ee' }}>{isHead ? 'Head' : 'Teacher'}</span>
                </div>
                {!isHead && (
                  <div className="flex gap-2.5 mt-3">
                    <button onClick={() => grantHead(s.id)} className="flex-1 border border-td-primary bg-white text-td-primary text-[12.5px] font-bold py-2.5 rounded-[12px] cursor-pointer">
                      {s.headRequested ? 'Grant head (requested)' : 'Make head teacher'}
                    </button>
                    <button onClick={() => removeStaff(s.id)} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12.5px] font-bold py-2.5 px-4 rounded-[12px] cursor-pointer">Remove</button>
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
  const { back, pendingStudents, branchesList, refreshData, approveStudent, rejectStudent, role, studentJoinCode, centreName, loadMyCentre, regenerateStudentCode, notify } = useDashboard()

  useEffect(() => { refreshData(); loadMyCentre() }, [refreshData, loadMyCentre])

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Student requests" onBack={back} />
      <div className="text-[13px] text-td-muted leading-relaxed mb-4 lg:max-w-2xl">Students who registered themselves. Review their details, set their batch and fee, then approve — their code only works once you do.</div>

      {studentJoinCode && (
        <div className="w-full lg:max-w-md border-2 border-dashed border-td-primary bg-[#eaf1fc] rounded-[16px] p-3.5 mb-5">
          <div className="flex items-start justify-between gap-3">
            <button onClick={() => { navigator.clipboard.writeText(studentJoinCode); notify('Student code copied!') }} className="text-left flex-1 min-w-0 cursor-pointer">
              <div className="text-[11px] font-bold text-td-muted">{centreName || 'Your centre'} · STUDENT CODE</div>
              <div className="text-[20px] font-extrabold text-td-primary tracking-[0.15em]">{studentJoinCode}</div>
              <div className="text-[11px] text-td-muted mt-0.5">Share with students so they can register themselves.</div>
            </button>
            <button onClick={() => { navigator.clipboard.writeText(studentJoinCode); notify('Student code copied!') }} className="text-[11px] font-bold text-td-primary flex items-center gap-1 shrink-0 cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
          </div>
          {role === 'admin' && (
            <button
              onClick={() => { if (confirm('Generate a new student code? The old one will stop working immediately.')) regenerateStudentCode() }}
              className="text-[11px] font-bold text-td-muted underline mt-2 cursor-pointer"
            >
              Generate a new code
            </button>
          )}
        </div>
      )}

      <div className="text-sm font-extrabold text-td-dark mb-3">Pending {pendingStudents.length > 0 && <span className="text-td-red">· {pendingStudents.length}</span>}</div>
      {pendingStudents.length === 0 ? (
        <div className="text-center text-td-muted text-[13px] py-6 bg-white border border-td-border rounded-[16px]">No requests waiting</div>
      ) : (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {pendingStudents.map((s, i) => (
            <StudentRequestCard key={s.dbId} s={s} idx={i} branches={branchesList} onApprove={approveStudent} onReject={rejectStudent} />
          ))}
        </div>
      )}
    </div>
  )
}

function StudentRequestCard({ s, idx, branches, onApprove, onReject }: {
  s: import('../store').PendingStudent
  idx: number
  branches: import('../store').BranchItem[]
  onApprove: (dbId: string, klass: string, branchId: string | null, fee: string, feeDue: string) => Promise<void>
  onReject: (dbId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [klass, setKlass] = useState(s.klass)
  const [branch, setBranch] = useState('')
  const [fee, setFee] = useState('')
  const [feeDue, setFeeDue] = useState('')

  const confirm = async () => {
    if (busy) return
    setBusy(true)
    const branchId = branch ? branches.find(b => b.name === branch)?.dbId ?? null : null
    await onApprove(s.dbId, klass, branchId, fee, feeDue)
    setBusy(false)
  }

  return (
    <div className="bg-white border border-td-border rounded-[16px] p-3.5 self-start">
      <div className="flex items-center gap-3 mb-2.5">
        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(idx) }}>{initials(s.name)}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-td-dark truncate">{s.name}</div>
          <div className="text-[11.5px] text-td-muted truncate">{s.klass} · {s.school}</div>
        </div>
        {s.when && <span className="text-[10.5px] text-td-subtle shrink-0">{s.when}</span>}
      </div>
      <div className="text-[12px] text-td-muted leading-relaxed mb-3 bg-[#f7f9fc] rounded-[10px] p-2.5">
        <div>Parent: <span className="font-semibold text-td-text">{s.parent || '—'}</span></div>
        {s.address && <div>Address: <span className="font-semibold text-td-text">{s.address}</span></div>}
        <div>Code: <span className="font-bold text-td-text tracking-wide">{s.code}</span></div>
      </div>

      {!open ? (
        <div className="flex gap-2.5">
          <button onClick={() => setOpen(true)} className="flex-1 border-none bg-td-green text-white text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer">Approve</button>
          <button onClick={() => onReject(s.dbId)} className="flex-1 border border-td-border bg-white text-td-muted text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer">Decline</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2.5">
            <div className="flex-1">
              <label className="text-[11px] font-bold text-td-muted">Batch / class</label>
              <input value={klass} onChange={e => setKlass(e.target.value)} className="w-full border border-td-border rounded-[10px] p-2.5 text-[13px] text-td-dark outline-none focus:border-td-primary mt-1" />
            </div>
            {branches.length > 0 && (
              <div className="flex-1">
                <label className="text-[11px] font-bold text-td-muted">Branch</label>
                <select value={branch} onChange={e => setBranch(e.target.value)} className="w-full border border-td-border rounded-[10px] p-2.5 text-[13px] text-td-dark outline-none focus:border-td-primary mt-1 bg-white">
                  <option value="">—</option>
                  {branches.map(b => <option key={b.dbId ?? b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2.5">
            <div className="flex-1">
              <label className="text-[11px] font-bold text-td-muted">Fee ₹ <span className="text-td-subtle font-semibold">(optional)</span></label>
              <input value={fee} onChange={e => setFee(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="e.g. 800" className="w-full border border-td-border rounded-[10px] p-2.5 text-[13px] text-td-dark outline-none focus:border-td-primary mt-1" />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-bold text-td-muted">Due date</label>
              <input type="date" value={feeDue} onChange={e => setFeeDue(e.target.value)} className="w-full border border-td-border rounded-[10px] p-2.5 text-[13px] text-td-dark outline-none focus:border-td-primary mt-1" />
            </div>
          </div>
          <div className="flex gap-2.5 mt-0.5">
            <button onClick={confirm} disabled={busy} className="flex-1 border-none bg-td-green text-white text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer disabled:opacity-60">{busy ? 'Approving…' : 'Confirm approval'}</button>
            <button onClick={() => setOpen(false)} className="border border-td-border bg-white text-td-muted text-[13px] font-bold py-2.5 px-4 rounded-[12px] cursor-pointer">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ReportsScreen() {
  const { back, weeklyReport: r, loadWeeklyReport, studentReports, loadStudentReports, teacherActivity, loadTeacherActivity, myPhone, centreName, loadMyCentre } = useDashboard()
  const [tab, setTab] = useState<'branches' | 'students' | 'teachers'>('branches')
  const [period, setPeriod] = useState<7 | 30>(7)
  useEffect(() => { loadWeeklyReport(period); loadStudentReports(period); loadTeacherActivity(period); loadMyCentre() }, [period, loadWeeklyReport, loadStudentReports, loadTeacherActivity, loadMyCentre])
  const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title={period === 7 ? 'Weekly Report' : 'Monthly Report'} onBack={back} right={
        <div className="flex bg-[#eef1f7] rounded-[12px] p-[3px]">
          {([7, 30] as const).map(d => (
            <button key={d} onClick={() => setPeriod(d)} className="text-[12px] font-bold py-[7px] px-3 rounded-[10px] cursor-pointer border-none" style={{ background: period === d ? '#fff' : 'transparent', color: period === d ? '#2a6fdb' : '#6b7689', boxShadow: period === d ? '0 1px 3px rgba(20,30,60,.12)' : 'none' }}>{d === 7 ? 'Week' : 'Month'}</button>
          ))}
        </div>
      } />

      <div className="flex gap-2 mb-4 lg:max-w-md">
        {(['branches', 'students', 'teachers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 text-[12.5px] font-bold py-2.5 rounded-[12px] cursor-pointer border capitalize" style={{ background: tab === t ? '#2a6fdb' : '#fff', color: tab === t ? '#fff' : '#3a4456', borderColor: tab === t ? '#2a6fdb' : '#e6eaf2' }}>{t}</button>
        ))}
      </div>

      {tab === 'teachers' ? (
        !teacherActivity ? (
          <div className="text-center text-td-muted text-sm py-12">Loading activity…</div>
        ) : teacherActivity.length === 0 ? (
          <div className="text-center text-td-muted text-sm py-10 bg-white border border-td-border rounded-[16px]">No approved staff yet.</div>
        ) : (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3">
            <div className="text-[12px] text-td-muted mb-1 lg:col-span-full">What each staff member logged in the last 7 days.</div>
            {teacherActivity.map(t => (
              <div key={t.email + t.name} className="bg-white border border-td-border rounded-[18px] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[14.5px] font-extrabold text-td-dark">{t.name || t.email}</div>
                    <div className="text-[11.5px] text-td-muted">{t.email}</div>
                  </div>
                  <span className="text-[10.5px] font-bold py-[5px] px-2.5 rounded-[20px]" style={{ color: t.is_head ? '#2a6fdb' : '#2fa36b', background: t.is_head ? '#eaf1fc' : '#e7f5ee' }}>{t.is_head ? 'Head' : 'Teacher'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { v: t.attendance_marks, l: 'Attendance' },
                    { v: t.tests_entered, l: 'Results' },
                    { v: t.assignments_created, l: 'Assignments' },
                  ].map(x => (
                    <div key={x.l} className="bg-[#f7f9fc] rounded-[12px] py-2.5">
                      <div className="text-[18px] font-extrabold text-td-dark leading-none">{x.v}</div>
                      <div className="text-[10.5px] text-td-muted mt-1 font-semibold">{x.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="text-[11px] text-td-subtle text-center leading-relaxed mt-1 lg:col-span-full">Activity is counted from when staff started using the app — older records aren&apos;t attributed.</div>
          </div>
        )
      ) : tab === 'students' ? (
        !studentReports ? (
          <div className="text-center text-td-muted text-sm py-12">Generating reports…</div>
        ) : studentReports.length === 0 ? (
          <div className="text-center text-td-muted text-sm py-10 bg-white border border-td-border rounded-[16px]">No students yet.</div>
        ) : (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3">
            <div className="text-[12px] text-td-muted mb-1 lg:col-span-full">Send each parent their child&apos;s weekly progress.</div>
            {studentReports.map(s => {
              const attPct = s.att_total > 0 ? Math.round((s.att_present / s.att_total) * 100) : null
              return (
                <div key={s.name + s.klass} className="bg-white border border-td-border rounded-[18px] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-[14.5px] font-extrabold text-td-dark">{s.name}</div>
                      <div className="text-[11.5px] text-td-muted">{s.klass}</div>
                    </div>
                    <span className="text-[10.5px] font-bold py-[5px] px-[9px] rounded-[20px]" style={{ color: s.fee_status === 'Paid' ? '#2fa36b' : '#e0962f', background: s.fee_status === 'Paid' ? '#e7f5ee' : '#fcf3e3' }}>{s.fee_status}</span>
                  </div>
                  <div className="text-[12px] text-td-muted mb-3">Attendance: <span className="font-bold text-td-text">{attPct === null ? '—' : `${attPct}%`}</span> · Tests: <span className="font-bold text-td-text">{s.tests}{s.tests > 0 ? ` (avg ${s.avg_pct}%)` : ''}</span></div>
                  <button onClick={() => window.open(whatsappShareUrl(s.parent, studentReportMessage(s, centreName || undefined, period)), '_blank')} disabled={!s.parent} className="w-full border-none bg-[#25D366] text-white text-[13px] font-extrabold py-2.5 rounded-[12px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
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
          <div className="text-[12.5px] text-td-muted mb-4">Last {period} days · as of {new Date(r.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>

          {r.branches.length === 0 ? (
            <div className="text-center text-td-muted text-sm py-8 bg-white border border-td-border rounded-[16px] mb-4">No branches configured yet — add branches and assign students to see per-branch numbers.</div>
          ) : (
            <div className="flex flex-col gap-3 mb-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
              {r.branches.map(b => (
                <div key={b.name} className="bg-white border border-td-border rounded-[18px] p-4">
                  <div className="text-[15px] font-extrabold text-td-dark mb-3">{b.name}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Students', value: `${b.students}${b.new_students ? ` (+${b.new_students})` : ''}` },
                      { label: 'Staff', value: String(b.staff) },
                      { label: 'Attendance', value: `${b.att_pct}%` },
                      { label: 'Fees collected', value: inr(b.fees_collected) },
                      { label: 'Fees pending', value: inr(b.fees_pending) },
                    ].map(s => (
                      <div key={s.label}>
                        <div className="text-[17px] font-extrabold text-td-dark leading-none">{s.value}</div>
                        <div className="text-[11px] text-td-muted mt-1 font-semibold">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-[#f4f6fb] border border-[#e6eaf2] rounded-[14px] p-3.5 text-[12.5px] text-td-muted mb-4 lg:max-w-xl">
            {r.unassigned_students > 0 && <div>Unassigned students: <span className="font-bold text-td-text">{r.unassigned_students}</span></div>}
            <div>Tests conducted this {period === 7 ? 'week' : 'month'}: <span className="font-bold text-td-text">{r.tests_this_week}</span></div>
          </div>

          <button onClick={() => window.open(whatsappShareUrl(myPhone, weeklyReportMessage(r, centreName || undefined, period)), '_blank')} className="w-full lg:max-w-md border-none bg-[#25D366] text-white text-[14px] font-extrabold py-[14px] rounded-[14px] cursor-pointer flex items-center justify-center gap-2">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
            Send to WhatsApp
          </button>
          <div className="text-[11.5px] text-td-subtle text-center mt-3 leading-relaxed">Opens WhatsApp with the report ready to send to yourself or a co-owner.</div>
        </>
      )}
    </div>
  )
}
