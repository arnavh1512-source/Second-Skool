'use client'

// The three lists a centre is set up out of - branches, subjects and batches.
// All three are the same screen underneath: a named row you can add, delete,
// and open to see who is in it.

import { useState } from 'react'
import { useDashboard, initials, av, feeColor, type Student } from '../store'
import { ScreenHeader, PrimaryButton, ConfirmDialog } from './Shell'

// Shared roster: shows the students belonging to a batch or branch with full details.
function StudentRoster({ list }: { list: Student[] }) {
  if (list.length === 0) return <div className="text-[12.5px] text-td-muted py-2.5 px-1">No students here yet</div>
  return (
    <div className="flex flex-col gap-2 mt-1">
      {list.map((s, i) => (
        <div key={s.dbId ?? s.id} className="bg-td-bg border border-td-border rounded-[14px] p-[11px] px-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-[11px] td-avatar" style={{ background: av(i) }}>{initials(s.name)}</div>
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
    <div className="td-screen">
      <ScreenHeader title="Branches" onBack={back} right={
        <button onClick={() => setShowForm(f => !f)} className="td-btn-sm">
          <span className="text-base leading-none">{showForm ? '×' : '+'}</span> {showForm ? 'Close' : 'Add'}
        </button>
      } />

      {showForm && (
        <div className="td-form-card mb-[18px]">
          <div className="text-sm td-strong">New branch</div>
          <div><label className="td-label">Branch name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Satellite Centre" className="td-field text-sm" />
          </div>
          <div><label className="td-label">Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 123 Main Street" className="td-field text-sm" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isMain} onChange={e => setIsMain(e.target.checked)} className="w-5 h-5 accent-td-primary rounded" />
            <span className="text-[13px] font-bold text-td-dark">Set as main branch</span>
          </label>
          <PrimaryButton onClick={handleAdd}>Add branch</PrimaryButton>
        </div>
      )}

      {branchesList.length === 0 ? (
        <div className="td-none">No branches configured</div>
      ) : (
        <div className="flex flex-col gap-3">
          {branchesList.map(b => {
            const roster = students.filter(s => s.branch === b.name)
            const open = openBranch === b.name
            return (
            <div key={b.dbId ?? b.name} className="td-card rounded-[18px] p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-[15px] td-strong">{b.name}</div>
                {b.main && <span className="text-[12px] font-bold text-td-primary bg-td-tint-blue py-1 px-[9px] rounded-[20px]">Main</span>}
              </div>
              <div className="text-[12.5px] text-td-muted mb-3">{b.address}</div>
              <div className="flex items-center justify-between">
                <button onClick={() => setOpenBranch(open ? null : b.name)} className="td-plain flex gap-[18px] p-0 cursor-pointer text-left">
                  <div><div className="text-base td-strong">{roster.length}</div><div className="text-[12px] text-td-subtle font-semibold">Students {roster.length > 0 && <span className="text-td-primary">{open ? '▲' : '▼'}</span>}</div></div>
                  <div><div className="text-base td-strong">{b.staff}</div><div className="text-[12px] text-td-subtle font-semibold">Staff</div></div>
                </button>
                {b.dbId && <button onClick={() => deleteBranch(b.dbId!)} className="td-danger text-[12px] font-bold py-2 px-3.5 rounded-[12px]">Remove</button>}
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

/* Subjects and batches are the same screen: a name, an add box, a list of what
   was added, a Remove on each. The only real difference is that a batch can be
   opened to show the students in it, and a subject has nobody to show. */
type NamedRow = { dbId?: string; name: string }

function NameListScreen({ noun, plural, placeholder, rows, add, remove, confirmBody, roster }: {
  noun: string
  plural: string
  placeholder: string
  rows: readonly NamedRow[]
  add: (name: string) => Promise<boolean>
  remove: (dbId: string) => void
  confirmBody: string
  roster?: (name: string) => Student[]
}) {
  const back = useDashboard(s => s.back)
  const [name, setName] = useState('')
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null)

  const handleAdd = async () => {
    if (!name.trim()) { useDashboard.getState().notify(`Enter ${noun} name`, 'error'); return }
    if (await add(name.trim())) setName('')
  }

  return (
    <div className="td-screen">
      <ConfirmDialog
        open={!!confirm}
        title={`Remove ${noun} ${confirm?.name ?? ''}?`}
        body={confirmBody}
        confirmLabel={`Remove ${noun}`}
        onConfirm={() => { const t = confirm; setConfirm(null); if (t) remove(t.id) }}
        onCancel={() => setConfirm(null)}
      />
      <ScreenHeader title={plural[0].toUpperCase() + plural.slice(1)} onBack={back} />

      <div className="td-form-card mb-[18px]">
        <div className="text-sm td-strong">Add {noun}</div>
        <div className="flex gap-[11px]">
          <input value={name} onChange={e => setName(e.target.value)} placeholder={placeholder} className="td-field flex-1 text-sm" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} className="td-pill text-sm font-bold py-[13px] px-5 rounded-[14px] cursor-pointer shrink-0">Add</button>
        </div>
      </div>

      <div className="td-h2">All {plural} ({rows.length})</div>
      {rows.length === 0 ? (
        <div className="td-none">No {plural} added yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r, i) => {
            const list = roster?.(r.name)
            const open = openRow === r.name
            return (
              <div key={r.dbId ?? r.name} className="td-card rounded-2xl p-[13px] px-[15px]">
                <div className="flex items-center gap-[13px]">
                  <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[14px]" style={{ background: av(i) }}>{r.name[0]}</div>
                  {list ? (
                    <button onClick={() => setOpenRow(open ? null : r.name)} className="td-plain flex-1 min-w-0 p-0 cursor-pointer text-left">
                      <div className="text-[14px] font-bold text-td-dark truncate">{r.name}</div>
                      <div className="text-[12px] text-td-muted font-semibold">{list.length} student{list.length === 1 ? '' : 's'} {list.length > 0 && <span className="text-td-primary">{open ? '▲' : '▼'}</span>}</div>
                    </button>
                  ) : (
                    <div className="flex-1 text-[14px] font-bold text-td-dark truncate">{r.name}</div>
                  )}
                  {r.dbId && <button onClick={() => setConfirm({ id: r.dbId!, name: r.name })} className="td-danger text-[12px] font-bold py-1.5 px-3 rounded-[11px] shrink-0">Remove</button>}
                </div>
                {list && open && <StudentRoster list={list} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SubjectsScreen() {
  const { subjects, addSubject, deleteSubject } = useDashboard()
  return <NameListScreen noun="subject" plural="subjects" placeholder="e.g. Mathematics" rows={subjects} add={addSubject} remove={deleteSubject}
    confirmBody="Its tests, results and timetable periods are deleted with it. This cannot be undone." />
}

export function BatchesScreen() {
  const { batches, students, addBatch, deleteBatch } = useDashboard()
  return <NameListScreen noun="batch" plural="batches" placeholder="e.g. Morning 10-A" rows={batches} add={addBatch} remove={deleteBatch}
    confirmBody="Students keep every record — attendance, marks and fees. Only the batch label goes."
    roster={name => students.filter(s => s.batch === name)} />
}
