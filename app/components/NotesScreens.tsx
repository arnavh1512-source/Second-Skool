'use client'

import { useState, useEffect } from 'react'
import { useDashboard } from '../store'
import { ScreenHeader, PrimaryButton } from './Shell'
import { Icon, ink } from './Icon'
import { uploadNoteFile } from '../lib/upload'
import { writeLocal } from '../lib/storage'
import { useBusy } from '../lib/use-busy'

const FileIcon = ({ url }: { url: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={url ? '#2a6fdb' : '#c2cad8'} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
)

// --- Staff: create & manage class notes ------------------------------------
export function NotesScreen() {
  const { back, subjects, notesList, loadNotes, addNote, deleteNote, notify, students } = useDashboard()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [klass, setKlass] = useState('')
  const classes = [...new Set(students.map(s => s.klass))].filter(Boolean)
  const selKlass = klass || classes[0] || ''
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, run] = useBusy()

  useEffect(() => { loadNotes() }, [loadNotes])

  const reset = () => { setTitle(''); setSubject(''); setBody(''); setLink(''); setFile(null); setShowForm(false) }

  const save = () => run(async () => {
    if (!title.trim()) { notify('Enter a title', 'error'); return }
    if (!selKlass) { notify('Add students first', 'error'); return }
    let fileUrl = ''
    if (file) {
      const res = await uploadNoteFile(file)
      if (res.error) { notify(res.error); return }
      fileUrl = res.url ?? ''
    }
    await addNote({ title, subject, klass: selKlass, body, fileUrl, linkUrl: link })
    reset()
  })

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Study Material" onBack={back} right={
        <button onClick={() => setShowForm(f => !f)} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
          <span className="text-base leading-none">{showForm ? '×' : '+'}</span> {showForm ? 'Close' : 'Share'}
        </button>
      } />

      {showForm && (
        <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 5 — Trigonometry notes" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <div className="grid grid-cols-2 gap-[11px]">
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Subject</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
                <option value="">General</option>
                {subjects.map(s => <option key={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Class</label>
              <select value={selKlass} onChange={e => setKlass(e.target.value)} disabled={classes.length === 0} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none disabled:opacity-60">
                {classes.length ? classes.map(c => <option key={c}>{c}</option>) : <option value="">Add students first</option>}
              </select>
            </div>
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Note <span className="text-td-subtle font-semibold">· type here (free)</span></label><textarea rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder="Write the note, or leave blank if attaching a file/link…" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none resize-none focus:border-td-primary" /></div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Attach PDF/image <span className="text-td-subtle font-semibold">· optional, max 10 MB</span></label>
            <input type="file" accept="application/pdf,image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} className="w-full text-[12.5px] text-td-muted file:mr-3 file:py-2 file:px-3 file:rounded-[10px] file:border-none file:bg-[#eaf1fc] file:text-td-primary file:font-bold file:text-[12px]" />
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Video link <span className="text-td-subtle font-semibold">· optional (YouTube / Drive)</span></label><input value={link} onChange={e => setLink(e.target.value)} placeholder="https://youtu.be/…" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <PrimaryButton onClick={save}>{busy ? 'Sharing…' : 'Share with class'}</PrimaryButton>
        </div>
      )}

      {notesList.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-10 leading-relaxed">No study material yet.<br />Tap Share to send notes to a class.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {notesList.map(n => (
            <div key={n.dbId} className="bg-white border border-td-border rounded-[18px] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-extrabold text-td-dark">{n.title}</div>
                  <div className="text-[12px] text-td-muted mt-0.5">{n.klass}{n.subject ? ` · ${n.subject}` : ''}</div>
                </div>
                <button onClick={() => n.dbId && deleteNote(n.dbId)} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12px] font-bold py-1.5 px-3 rounded-[11px] cursor-pointer shrink-0">Remove</button>
              </div>
              {n.body && <div className="text-[13px] text-td-text leading-relaxed mt-2">{n.body}</div>}
              <div className="flex gap-2 mt-2.5">
                {n.fileUrl && <a href={n.fileUrl} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-td-primary flex items-center gap-1.5"><FileIcon url={n.fileUrl} /> File</a>}
                {n.linkUrl && <a href={n.linkUrl} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-td-primary flex items-center gap-1.5"><Icon name="next" size={13} />Video</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Student: view class study material -------------------------------------
export function StuNotesScreen() {
  const { go, stuNotes, loadStudentNotes } = useDashboard()
  // Opening the screen clears the "new material" badge on Home.
  useEffect(() => {
    loadStudentNotes()
    writeLocal('notes_seen_at', String(Date.now()))
  }, [loadStudentNotes])

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Study Material" onBack={() => go('stuHome', 'stuHome')} />

      {stuNotes.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-12 leading-relaxed">No study material yet.<br />Notes your teacher shares will appear here.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuNotes.map((n, i) => (
            <div key={`${n.date}-${n.title}-${i}`} className="bg-white border border-td-border rounded-[18px] p-4">
              <div className="flex items-center gap-[11px]">
                <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center bg-[#eaf1fc]" style={{ color: ink('#eaf1fc') }}><Icon name="notes" size={19} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-extrabold text-td-dark">{n.title}</div>
                  {n.subject && <div className="text-[12px] text-td-muted mt-0.5">{n.subject}</div>}
                </div>
              </div>
              {n.body && <div className="text-[13px] text-td-text leading-relaxed mt-2.5">{n.body}</div>}
              <div className="flex gap-2.5 mt-2.5">
                {n.fileUrl && <a href={n.fileUrl} target="_blank" rel="noreferrer" className="flex-1 text-center border border-td-primary text-td-primary text-[12.5px] font-bold py-2 rounded-[12px]">Open file</a>}
                {n.linkUrl && <a href={n.linkUrl} target="_blank" rel="noreferrer" className="flex-1 text-center border-none bg-[#e8553c] text-white text-[12.5px] font-bold py-2 rounded-[12px] flex items-center justify-center gap-1.5"><Icon name="next" size={14} />Watch video</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
