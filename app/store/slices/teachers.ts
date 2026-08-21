import { supabase } from '../../lib/supabase'
import type { Slice } from '../slice'
import type { Teacher } from '../types'

export const createTeachersSlice: Slice<'setNewTeacher' | 'saveTeacher'> = (set, get) => ({
  setNewTeacher: (patch) => set((s) => ({ newTeacher: { ...s.newTeacher, ...patch } })),

  // Insert first, then update the list — the previous version pushed the
  // teacher into state, said "added to staff" and navigated away before the
  // insert resolved, so a failed write left a teacher who existed only on
  // screen until the next refresh silently removed them.
  saveTeacher: async () => {
    const { newTeacher: nt, branchesList } = get()
    if (!nt.name.trim()) { get().notify('Enter a name first'); return }
    if (!nt.qualification.trim()) { get().notify('Enter qualification'); return }
    if (nt.experience && isNaN(Number(nt.experience))) { get().notify('Experience must be a number'); return }
    const t: Teacher = { name: nt.name, subject: nt.subject, qualification: nt.qualification || '—', experience: Number(nt.experience) || 0 }
    const branchId = nt.branch ? branchesList.find(b => b.name === nt.branch)?.dbId : null

    const { data, error } = await supabase
      .from('teachers')
      .insert({ name: t.name, subject: t.subject, qualification: t.qualification, experience: t.experience, branch_id: branchId ?? null })
      .select().single()
    if (error || !data) { get().notify('Could not add teacher — check your connection'); return }

    set((s) => ({
      teachers: [{ ...t, dbId: data.id }, ...s.teachers],
      newTeacher: { name: '', subject: '', qualification: '', experience: '', branch: '' },
    }))
    get().notify('Teacher added to staff'); get().back()
  },
})
