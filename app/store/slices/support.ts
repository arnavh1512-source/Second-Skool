import { supabase } from '../../lib/supabase'
import { readLocal } from '../../lib/storage'
import { fileToScreenshotDataUrl } from '../../lib/image'
import { buildDiagnostics, validateReport } from '../../lib/support'
import { friendlyError } from '../errors'
import type { Slice } from '../slice'
import type { SupportTicket, SupportMessage } from '../types'

// Which deploy produced the report. Vercel exposes the commit sha; a local
// build has none and says so, which is itself worth knowing in a ticket.
const VERSION = process.env.NEXT_PUBLIC_COMMIT_SHA?.slice(0, 7) ?? 'dev'

// The last uncaught error the browser saw. This is the single most useful field
// in a ticket — it turns "it just stops" into a stack frame — and it is only
// worth having because something actually writes it, so the listeners live here
// rather than behind an exported setter with no callers.
let lastError: string | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('error', e => {
    lastError = `${e.message} @ ${e.filename}:${e.lineno}`.slice(0, 300)
  })
  window.addEventListener('unhandledrejection', e => {
    lastError = `unhandled: ${String(e.reason)}`.slice(0, 300)
  })
}

const diagnostics = () => buildDiagnostics({
  version: VERSION,
  userAgent: navigator.userAgent,
  width: window.innerWidth,
  height: window.innerHeight,
  lastError,
})

const EMPTY_DRAFT = { intent: '', outcome: '', area: '', frequency: 'always' } as const

// PostgREST hands back snake_case rows; the store speaks camelCase.
type Row = Record<string, unknown>

const toMessages = (rows: unknown): SupportMessage[] =>
  (Array.isArray(rows) ? rows : [])
    .map((m: Row) => ({
      author: m.author as SupportMessage['author'],
      body: m.body as string,
      createdAt: (m.created_at ?? m.createdAt) as string,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

const toTicket = (t: Row): SupportTicket => ({
  id: t.id as string,
  intent: t.intent as string,
  outcome: t.outcome as string,
  status: t.status as SupportTicket['status'],
  createdAt: (t.created_at ?? t.createdAt) as string,
  messages: toMessages(t.messages ?? t.support_messages),
})

type Keys =
  | 'myTickets' | 'openTicketId' | 'reportDraft' | 'reportShot'
  | 'setReportDraft' | 'setReportShot' | 'loadMyTickets' | 'fileReport' | 'openReport' | 'replyToReport'

export const createSupportSlice: Slice<Keys> = (set, get) => ({
  myTickets: [],
  openTicketId: null,
  reportDraft: { ...EMPTY_DRAFT },
  reportShot: null,

  setReportDraft: patch => set(s => ({ reportDraft: { ...s.reportDraft, ...patch } })),

  setReportShot: async file => {
    if (!file) { set({ reportShot: null }); return }
    try {
      set({ reportShot: await fileToScreenshotDataUrl(file) })
    } catch (e) {
      get().notify(e instanceof Error ? e.message : 'Could not attach that image', 'error')
    }
  },

  loadMyTickets: async () => {
    if (get().role === 'student') {
      const code = readLocal('student_code')
      if (!code) return
      const { data, error } = await supabase.rpc('my_tickets', { p_code: code })
      if (error) { get().notify(friendlyError(error, 'load your reports'), 'error'); return }
      set({ myTickets: (Array.isArray(data) ? data : []).map(toTicket) })
      return
    }
    // One round trip for staff too: PostgREST embeds the thread through the
    // foreign key, so opening a report never touches the network.
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id,intent,outcome,status,created_at,support_messages(author,body,created_at)')
      .order('created_at', { ascending: false })
    if (error) { get().notify(friendlyError(error, 'load your reports'), 'error'); return }
    set({ myTickets: (data ?? []).map(r => toTicket(r as Row)) })
  },

  fileReport: async () => {
    const { reportDraft: d, reportShot, role } = get()
    const problem = validateReport(d)
    if (problem) { get().notify(problem, 'error'); return }
    const diag = diagnostics()

    if (role === 'student') {
      const code = readLocal('student_code')
      if (!code) { get().notify('Sign in again to report a problem', 'error'); return }
      const { error } = await supabase.rpc('file_ticket', {
        p_code: code,
        p_intent: d.intent,
        p_outcome: d.outcome,
        p_area: d.area,
        p_frequency: d.frequency,
        p_shot: reportShot,
        p_diag: diag,
      })
      if (error) { get().notify(friendlyError(error, 'send your report'), 'error'); return }
    } else {
      // Staff file through an RPC for the same reason students do: who you are
      // is read off your profile row on the server. A browser that gets to
      // supply its own reporter_name is a browser that can file a report as
      // somebody else, and the operator's inbox has no join to catch it.
      const { error } = await supabase.rpc('file_staff_ticket', {
        p_intent: d.intent,
        p_outcome: d.outcome,
        p_area: d.area,
        p_frequency: d.frequency,
        p_shot: reportShot,
        p_diag: diag,
      })
      if (error) { get().notify(friendlyError(error, 'send your report'), 'error'); return }
    }

    set({ reportDraft: { ...EMPTY_DRAFT }, reportShot: null })
    get().notify('Report sent — we will reply inside the app')
    await get().loadMyTickets()
  },

  // Local, because loadMyTickets already fetched the thread.
  openReport: id => set({ openTicketId: id, screen: 'supportThread' }),

  replyToReport: async body => {
    const id = get().openTicketId
    const text = body.trim()
    if (!id || !text) return
    if (get().role === 'student') {
      const code = readLocal('student_code')
      if (!code) return
      const { error } = await supabase.rpc('reply_ticket', { p_code: code, p_ticket: id, p_body: text })
      if (error) { get().notify(friendlyError(error, 'send that message'), 'error'); return }
    } else {
      const { error } = await supabase
        .from('support_messages')
        .insert({ ticket_id: id, author: 'reporter', body: text })
      if (error) { get().notify(friendlyError(error, 'send that message'), 'error'); return }
    }
    await get().loadMyTickets()
  },
})
