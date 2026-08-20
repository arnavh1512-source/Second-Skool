import { supabase } from '../../lib/supabase'
import { dbErr } from '../db'
import type { Slice } from '../slice'

type Keys = 'loadNotes' | 'addNote' | 'deleteNote' | 'loadStudentNotes'

export const createNotesSlice: Slice<Keys> = (set, get) => ({
  loadNotes: async () => {
    const { data, error } = await supabase.from('notes')
      .select('id, title, subject, class, body, file_url, link_url')
      .order('created_at', { ascending: false })
    if (error) { get().notify('Could not load notes'); return }
    set({ notesList: (data ?? []).map((n: { id: string; title: string; subject: string | null; class: string; body: string | null; file_url: string | null; link_url: string | null }) => ({
      dbId: n.id, title: n.title, subject: n.subject ?? '', klass: n.class,
      body: n.body ?? '', fileUrl: n.file_url ?? '', linkUrl: n.link_url ?? '',
    })) })
  },

  addNote: async (n) => {
    if (!n.title.trim()) { get().notify('Enter a title'); return }
    if (!n.body.trim() && !n.fileUrl && !n.linkUrl) { get().notify('Add a note, file, or link'); return }
    const { data, error } = await supabase.from('notes').insert({
      title: n.title.trim(), subject: n.subject || null, class: n.klass,
      body: n.body.trim() || null, file_url: n.fileUrl || null, link_url: n.linkUrl.trim() || null,
    }).select('id').single()
    if (error) { get().notify('Could not save note'); return }
    set((s) => ({ notesList: [{ dbId: data.id, ...n }, ...s.notesList] }))
    get().notifyClass(n.klass, 'New study material', n.subject ? `${n.title.trim()} · ${n.subject}` : n.title.trim(), 'notes')
    get().notify('Note shared with the class')
  },

  deleteNote: async (dbId) => {
    set((s) => ({ notesList: s.notesList.filter(x => x.dbId !== dbId) }))
    await supabase.from('notes').delete().eq('id', dbId).then(dbErr('delete note', get().notify))
    get().notify('Note removed')
  },

  loadStudentNotes: async () => {
    const code = typeof window !== 'undefined' ? localStorage.getItem('student_code') : null
    if (!code) return
    const { data, error } = await supabase.rpc('get_student_notes', { p_code: code })
    if (error) { get().notify('Could not load study material'); return }
    set({ stuNotes: (data ?? []).map((n: { title: string | null; subject: string | null; body: string | null; fileUrl: string | null; linkUrl: string | null; date: string | null }) => ({
      title: n.title ?? '', subject: n.subject ?? '', body: n.body ?? '',
      fileUrl: n.fileUrl ?? '', linkUrl: n.linkUrl ?? '', date: n.date ?? '',
    })) })
  },
})
