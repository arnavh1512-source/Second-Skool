'use client'
import { useEffect, useState } from 'react'
import { useDashboard, fmtDate } from '../store'
import { AREAS, FREQUENCIES } from '../lib/support'
import type { Frequency } from '../lib/support'
import type { SupportTicket } from '../store/types'

// One pair of screens for every audience. The store already branches on role —
// students go through anon RPCs, staff through RLS — so nothing here needs to
// know which kind of user is looking at it.

const INPUT = 'w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary'
const LABEL = 'text-xs font-bold text-td-muted mb-[7px] block'

const STATUS: Record<SupportTicket['status'], { bg: string; fg: string; label: string }> = {
  open: { bg: '#eaf1fc', fg: '#2a6fdb', label: 'Open' },
  resolved: { bg: '#f2f2f2', fg: '#6b7280', label: 'Closed' },
}

function StatusPill({ status }: { status: SupportTicket['status'] }) {
  const s = STATUS[status]
  return (
    <span className="text-[11px] font-extrabold rounded-full py-1 px-2.5 shrink-0" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  )
}

export function SupportScreen() {
  const { reportDraft, setReportDraft, reportShot, setReportShot, fileReport, myTickets, loadMyTickets, openReport } = useDashboard()
  const [busy, setBusy] = useState(false)

  useEffect(() => { loadMyTickets() }, [loadMyTickets])

  const send = async () => {
    setBusy(true)
    try { await fileReport() } finally { setBusy(false) }
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="text-2xl font-extrabold text-td-dark mt-1.5 mb-1.5">Report a problem</div>
      <div className="text-[13px] text-td-muted leading-[1.5] mb-4">
        Four quick questions. We can already see which version of the app you are on and what device
        you are using — you do not need to explain that part.
      </div>

      <div className="bg-white border border-td-border rounded-[20px] p-4 grid gap-3.5">
        <div>
          <label className={LABEL}>What were you trying to do?</label>
          <input
            value={reportDraft.intent}
            onChange={e => setReportDraft({ intent: e.target.value })}
            placeholder="Mark attendance for Class 10"
            className={INPUT}
          />
        </div>

        <div>
          <label className={LABEL}>What happened instead?</label>
          <textarea
            value={reportDraft.outcome}
            onChange={e => setReportDraft({ outcome: e.target.value })}
            placeholder="The save button does nothing"
            rows={3}
            className={`${INPUT} resize-none`}
          />
        </div>

        <div>
          <label className={LABEL}>Which part of the app?</label>
          <select
            value={reportDraft.area}
            onChange={e => setReportDraft({ area: e.target.value })}
            className={INPUT}
          >
            <option value="">Choose one</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div>
          <label className={LABEL}>Does it happen every time?</label>
          <div className="flex gap-2">
            {FREQUENCIES.map(f => {
              const on = reportDraft.frequency === f.value
              return (
                <button
                  key={f.value}
                  onClick={() => setReportDraft({ frequency: f.value as Frequency })}
                  className={`flex-1 text-[13px] font-extrabold rounded-[14px] py-2.5 cursor-pointer border ${on ? 'bg-td-primary text-white border-td-primary' : 'bg-white text-td-dark border-td-border'}`}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className={LABEL}>Screenshot (optional)</label>
          {/* Said out loud, because the picker is the last moment where the
              reporter can decide not to send their students' names to us. */}
          <div className="text-[12px] text-td-muted leading-[1.5] mb-2">
            We will see whatever is on your screen, including student names. It is deleted when your
            report is closed.
          </div>
          {reportShot ? (
            <div className="grid gap-2 justify-items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={reportShot} alt="Attached screenshot" className="max-h-40 rounded-[12px] border border-td-border" />
              <button
                onClick={() => setReportShot(null)}
                className="text-[12.5px] font-extrabold text-td-red bg-transparent border-none p-0 cursor-pointer"
              >
                Remove
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*"
              onChange={e => setReportShot(e.target.files?.[0] ?? null)}
              className="text-[13px] text-td-muted w-full"
            />
          )}
        </div>

        <button
          onClick={send}
          disabled={busy}
          className="w-full bg-td-primary text-white text-sm font-extrabold p-[15px] rounded-2xl border-none cursor-pointer disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Send report'}
        </button>
      </div>

      {myTickets.length > 0 && (
        <>
          <div className="text-[13px] font-extrabold text-td-muted mt-5 mb-[11px] px-1">Your reports</div>
          <div className="bg-white border border-td-border rounded-[20px] overflow-hidden">
            {myTickets.map(t => {
              const last = t.messages[t.messages.length - 1]
              const unread = last?.author === 'operator'
              return (
                <button
                  key={t.id}
                  onClick={() => openReport(t.id)}
                  className="w-full text-left border-none bg-transparent border-b border-[#f0f2f7] p-[15px] px-[17px] flex items-center gap-3 cursor-pointer last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-td-dark truncate">{t.intent}</div>
                    <div className="text-xs text-td-muted mt-0.5">{fmtDate(t.createdAt)}</div>
                  </div>
                  {unread && <span className="text-[11px] font-extrabold text-white bg-td-red rounded-full py-1 px-2.5 shrink-0">Reply</span>}
                  <StatusPill status={t.status} />
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function SupportThreadScreen() {
  const { myTickets, openTicketId, replyToReport, go } = useDashboard()
  const ticket = myTickets.find(t => t.id === openTicketId)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  // Reachable if the list was reloaded out from under the thread.
  useEffect(() => { if (!ticket) go('support') }, [ticket, go])
  if (!ticket) return null

  const send = async () => {
    setBusy(true)
    try { await replyToReport(draft); setDraft('') } finally { setBusy(false) }
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="flex items-start gap-3 mt-1.5 mb-1.5">
        <div className="flex-1 text-2xl font-extrabold text-td-dark">{ticket.intent}</div>
        <StatusPill status={ticket.status} />
      </div>
      <div className="text-[13px] text-td-muted leading-[1.5] mb-4">{ticket.outcome}</div>

      <div className="grid gap-2.5 mb-4">
        {ticket.messages.map((m, i) => {
          const ours = m.author === 'operator'
          return (
            <div key={i} className={`max-w-[85%] rounded-[16px] p-3 px-3.5 ${ours ? 'bg-white border border-td-border self-start' : 'bg-td-primary text-white self-end'}`}>
              {ours && <div className="text-[11px] font-extrabold text-td-muted mb-1">Second Skool</div>}
              <div className="text-sm leading-[1.5] whitespace-pre-wrap">{m.body}</div>
              <div className={`text-[11px] mt-1 ${ours ? 'text-td-muted' : 'text-white/70'}`}>{fmtDate(m.createdAt)}</div>
            </div>
          )
        })}
        {ticket.messages.length === 0 && (
          <div className="text-[13px] text-td-muted">No replies yet. We will answer here.</div>
        )}
      </div>

      <div className="grid gap-2.5">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add anything else that might help"
          rows={3}
          className={`${INPUT} resize-none`}
        />
        <button
          onClick={send}
          disabled={busy || !draft.trim()}
          className="w-full bg-td-primary text-white text-sm font-extrabold p-[15px] rounded-2xl border-none cursor-pointer disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </div>
  )
}
