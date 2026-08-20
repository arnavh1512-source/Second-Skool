import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/push'
import type { Slice } from '../slice'

type Keys =
  | 'createCentre' | 'joinCentre' | 'loadMyCentre'
  | 'regenerateStudentCode' | 'renameCentre' | 'saveCentreLogo'

export const createCentreSlice: Slice<Keys> = (set, get) => ({
  createCentre: async (name) => {
    const { error } = await supabase.rpc('create_centre', { p_name: name })
    if (error) { get().notify(error.message || 'Could not create centre'); return }
    get().notify('Centre created — welcome!')
    if (typeof window !== 'undefined') window.location.reload()
  },

  joinCentre: async (code) => {
    const { error } = await supabase.rpc('join_centre', { p_code: code })
    if (error) { get().notify(error.message || 'Invalid centre code'); return }
    sendPush({ notifyHead: true, title: 'New access request', body: `${get().myName || 'A teacher'} is requesting access to your centre.` })
    set({ role: 'teacher', staffStatus: 'pending', screen: 'pending', tab: 'home' })
  },

  loadMyCentre: async () => {
    const { data } = await supabase.rpc('my_centre')
    if (data) {
      const d = data as { name?: string; join_code?: string; student_join_code?: string; logo_url?: string }
      set({ centreName: d.name ?? '', joinCode: d.join_code ?? '', studentJoinCode: d.student_join_code ?? '', centreLogo: d.logo_url ?? '' })
    }
  },

  regenerateStudentCode: async () => {
    const { data, error } = await supabase.rpc('regenerate_student_code')
    if (error || !data) { get().notify(error?.message || 'Could not change the code'); return }
    set({ studentJoinCode: data as string })
    get().notify('New student code generated')
  },

  renameCentre: async (name) => {
    const trimmed = name.trim()
    if (trimmed.length < 2) { get().notify('Enter a centre name'); return }
    const id = get().supabaseUserId
    if (!id) return
    // RLS centres_write allows only the owner to update their centre row.
    const { error } = await supabase.from('centres').update({ name: trimmed }).eq('owner_id', id)
    if (error) { get().notify('Could not rename — only the centre owner can'); return }
    set({ centreName: trimmed })
    get().notify('Centre renamed')
  },

  // White-label: the head sets a centre logo that students see after they log
  // in with a centre code. Stored as a small data-URL in centres.logo_url;
  // RLS centres_write lets only the owner update their centre row. Pass '' to
  // clear it and fall back to the default branding.
  saveCentreLogo: async (dataUrl) => {
    const id = get().supabaseUserId
    if (!id) return
    const { error } = await supabase.from('centres').update({ logo_url: dataUrl || null }).eq('owner_id', id)
    if (error) { get().notify('Could not save logo — only the centre owner can'); return }
    set({ centreLogo: dataUrl })
    get().notify(dataUrl ? 'Centre logo updated' : 'Centre logo removed')
  },
})
