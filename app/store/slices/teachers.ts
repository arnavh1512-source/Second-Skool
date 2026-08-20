import { supabase } from '../../lib/supabase'
import type { Slice } from '../slice'
import type { Teacher } from '../types'

export const createTeachersSlice: Slice<'setNewTeacher' | 'saveTeacher'> = (set, get) => ({
  setNewTeacher: (patch) => set((s) => ({ newTeacher: { ...s.newTeacher, ...patch } })),

  saveTeacher: () => {
    const { newTeacher: nt, teachers, branchesList } = get()
    if (!nt.name.trim()) { get().notify('Enter a name first'); return }
    if (!nt.qualification.trim()) { get().notify('Enter qualification'); return }
    if (nt.experience && isNaN(Number(nt.experience))) { get().notify('Experience must be a number'); return }
    const t: Teacher = { name: nt.name, subject: nt.subject, qualification: nt.qualification || '—', experience: Number(nt.experience) || 0 }
    const branchId = nt.branch ? branchesList.find(b => b.name === nt.branch)?.dbId : null
    supabase.from('teachers').insert({ name: t.name, subject: t.subject, qualification: t.qualification, experience: t.experience, branch_id: branchId ?? null })
      .select().single().then(({ data }) => {
        if (data) set((s) => ({ teachers: s.teachers.map(x => x.name === t.name && !x.dbId ? { ...x, dbId: data.id } : x) }))
      })
    set({ teachers: [t, ...teachers], newTeacher: { name: '', subject: '', qualification: '', experience: '', branch: '' } })
    get().notify('Teacher added to staff'); get().back()
  },
})
