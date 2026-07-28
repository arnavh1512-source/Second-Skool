'use client'

import { useState, useEffect } from 'react'
import { useDashboard } from '../store'
import { supabase } from '../lib/supabase'
import { PrimaryButton } from './Shell'

const LOGO = (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/icon-512.png" alt="Second Skool" width={72} height={72} className="rounded-[18px] object-cover shadow-[0_2px_10px_rgba(20,30,60,.12)]" />
)

export function LoginScreen() {
  const { authLoading, notify, loadStudentByCode } = useDashboard()
  const [mode, setMode] = useState<'choose' | 'student'>('choose')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) notify('Google sign-in failed')
  }

  const submitCode = async () => {
    if (busy) return
    setBusy(true)
    await loadStudentByCode(code)
    setBusy(false)
  }

  if (authLoading) {
    return (
      <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col items-center justify-center">
        <div className="animate-pulse mb-4">{LOGO}</div>
        <div className="text-sm text-td-muted font-semibold">Loading...</div>
      </div>
    )
  }

  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col">
      {LOGO}
      <div className="text-[26px] font-extrabold text-td-dark tracking-tight mt-[22px]">Second Skool</div>

      {mode === 'choose' && (
        <>
          <div className="text-sm text-td-muted mt-2 leading-relaxed">Teachers sign in with Google. Students tap below and enter the code their teacher gave them — no account needed.</div>

          <button onClick={signInWithGoogle} className="w-full border border-[#dfe3ea] bg-white rounded-[14px] p-3.5 mt-8 flex items-center justify-center gap-[11px] cursor-pointer shadow-[0_1px_2px_rgba(20,30,60,.06)]">
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C3 17.3 2.2 20.6 2.2 24s.8 6.7 2.3 9.9l7.3-5.7z"/><path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"/></svg>
            <span className="text-[14.5px] font-bold text-td-text">Teacher — continue with Google</span>
          </button>

          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 h-px bg-[#e6eaf2]" />
            <span className="text-[11.5px] text-td-subtle font-semibold">or</span>
            <div className="flex-1 h-px bg-[#e6eaf2]" />
          </div>

          <button onClick={() => setMode('student')} className="w-full text-left border border-td-border rounded-[18px] p-[18px] mt-5 flex items-center gap-[15px] cursor-pointer bg-white">
            <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center bg-[#e7f5ee]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2fa36b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></svg>
            </div>
            <div className="flex-1">
              <div className="text-base font-extrabold text-td-dark">I&apos;m a student</div>
              <div className="text-[12.5px] text-td-muted mt-[3px]">Enter your code to see your updates</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c2cad8" strokeWidth="2.4" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>

          <div className="mt-auto text-[11.5px] text-td-subtle text-center leading-relaxed pt-6">Your tuition centre sets up teacher access. Students only ever need their code.</div>
        </>
      )}

      {mode === 'student' && (
        <>
          <div className="text-sm text-td-muted mt-2 leading-relaxed">Enter the code your teacher gave you. We&apos;ll remember it on this device.</div>
          <input
            autoFocus value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submitCode()}
            placeholder="e.g. TUT-7X2K9Q"
            className="w-full border border-td-border rounded-[14px] p-[15px] text-base text-td-dark outline-none focus:border-td-primary text-center tracking-[0.2em] font-bold mt-7"
          />
          <button onClick={submitCode} disabled={busy} className="w-full border-none bg-td-primary text-white text-[15px] font-extrabold py-[15px] rounded-2xl cursor-pointer mt-3 disabled:opacity-60">
            {busy ? 'Checking…' : 'View my updates'}
          </button>
          <button onClick={() => { setMode('choose'); setCode('') }} className="w-full border-none bg-transparent text-td-muted text-[13px] font-bold py-3 cursor-pointer mt-1">Back</button>
          <div className="mt-auto text-[11.5px] text-td-subtle text-center leading-relaxed pt-6">Don&apos;t have a code? Ask your teacher to add you and share it.</div>
        </>
      )}
    </div>
  )
}

export function RegisterScreen() {
  const { googleEmail, createCentre, joinCentre, signOut } = useDashboard()
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [centreName, setCentreName] = useState('')
  const [code, setCode] = useState('')

  const run = async (fn: () => Promise<void>) => { setBusy(true); await fn(); setBusy(false) }

  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col">
      {LOGO}
      <div className="text-[24px] font-extrabold text-td-dark tracking-tight mt-[22px]">Set up your access</div>
      <div className="text-sm text-td-muted mt-2 leading-relaxed">Signed in as <span className="font-bold text-td-text">{googleEmail}</span>.</div>

      {mode === 'choose' && (
        <div className="flex flex-col gap-[13px] mt-7">
          <button onClick={() => setMode('create')} className="text-left border rounded-[20px] p-[18px] flex items-center gap-[15px] cursor-pointer bg-white" style={{ borderColor: '#dbe6fa' }}>
            <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center bg-td-dark">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <div className="flex-1">
              <div className="text-base font-extrabold text-td-dark">Create a centre</div>
              <div className="text-[12.5px] text-td-muted mt-[3px]">Start your own — you&apos;ll be the head teacher.</div>
            </div>
          </button>
          <button onClick={() => setMode('join')} className="text-left border rounded-[20px] p-[18px] flex items-center gap-[15px] cursor-pointer bg-white" style={{ borderColor: '#e6eaf2' }}>
            <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center bg-[#eaf1fc]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            </div>
            <div className="flex-1">
              <div className="text-base font-extrabold text-td-dark">Join a centre</div>
              <div className="text-[12.5px] text-td-muted mt-[3px]">As a teacher, with your centre&apos;s join code.</div>
            </div>
          </button>
        </div>
      )}

      {mode === 'create' && (
        <div className="mt-7 flex flex-col gap-3">
          <label className="text-xs font-bold text-td-muted">Centre name</label>
          <input autoFocus value={centreName} onChange={e => setCentreName(e.target.value)} placeholder="e.g. Bright Future Tuition" className="w-full border border-td-border rounded-[14px] p-[14px] text-sm text-td-dark outline-none focus:border-td-primary" />
          <PrimaryButton onClick={() => centreName.trim().length >= 2 ? run(() => createCentre(centreName)) : undefined}>{busy ? 'Creating…' : 'Create centre'}</PrimaryButton>
          <button onClick={() => setMode('choose')} className="text-[13px] text-td-muted font-bold py-2 cursor-pointer border-none bg-transparent">Back</button>
        </div>
      )}

      {mode === 'join' && (
        <div className="mt-7 flex flex-col gap-3">
          <label className="text-xs font-bold text-td-muted">Centre join code</label>
          <input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. 7X2K9Q" className="w-full border border-td-border rounded-[14px] p-[14px] text-sm text-td-dark outline-none focus:border-td-primary text-center tracking-[0.2em] font-bold" />
          <PrimaryButton onClick={() => code.trim().length >= 4 ? run(() => joinCentre(code)) : undefined}>{busy ? 'Joining…' : 'Join centre'}</PrimaryButton>
          <div className="text-[12px] text-td-subtle leading-relaxed">Ask your head teacher for the centre&apos;s join code. You&apos;ll get access once they approve you.</div>
          <button onClick={() => setMode('choose')} className="text-[13px] text-td-muted font-bold py-2 cursor-pointer border-none bg-transparent">Back</button>
        </div>
      )}

      <button onClick={signOut} className="mt-auto text-[12.5px] text-td-muted font-bold py-3 cursor-pointer border-none bg-transparent">Sign out</button>
    </div>
  )
}

export function PendingScreen() {
  const { googleEmail, signOut } = useDashboard()

  // Auto-advance the moment the head teacher approves — no manual refresh.
  // Falls back gracefully to the "Check again" button if Realtime is off.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      channel = supabase
        .channel('approval-watch')
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          () => window.location.reload())
        .subscribe()
    })
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col items-center justify-center text-center">
      <div className="w-[72px] h-[72px] rounded-[22px] bg-[#fcf3e3] flex items-center justify-center mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e0962f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
      </div>
      <div className="text-[20px] font-extrabold text-td-dark">Waiting for approval</div>
      <div className="text-sm text-td-muted mt-2 leading-relaxed max-w-[300px]">Your head teacher needs to approve <span className="font-bold text-td-text">{googleEmail}</span> before you can start. You&apos;ll get in as soon as they do.</div>
      <button onClick={() => window.location.reload()} className="border-none bg-td-primary text-white text-[14px] font-extrabold py-[13px] px-8 rounded-2xl cursor-pointer mt-7">Check again</button>
      <button onClick={signOut} className="text-[12.5px] text-td-muted font-bold py-3 cursor-pointer border-none bg-transparent mt-2">Sign out</button>
    </div>
  )
}

export function DeniedScreen() {
  const { signOut, joinCentre } = useDashboard()
  const [mode, setMode] = useState<'view' | 'join'>('view')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (busy || code.trim().length < 4) return
    setBusy(true)
    await joinCentre(code)
    setBusy(false)
  }
  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col items-center justify-center text-center">
      <div className="w-[72px] h-[72px] rounded-[22px] bg-[#fdecea] flex items-center justify-center mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e8553c" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>
      </div>
      <div className="text-[20px] font-extrabold text-td-dark">Access not granted</div>

      {mode === 'view' && (
        <>
          <div className="text-sm text-td-muted mt-2 leading-relaxed max-w-[300px]">This account isn&apos;t part of a centre yet. Enter a join code to request access, or sign out and use a student code instead.</div>
          <button onClick={() => setMode('join')} className="border-none bg-td-primary text-white text-[14px] font-extrabold py-[13px] px-8 rounded-2xl cursor-pointer mt-7">Enter a join code</button>
          <button onClick={signOut} className="text-[12.5px] text-td-muted font-bold py-3 cursor-pointer border-none bg-transparent mt-2">Sign out</button>
        </>
      )}

      {mode === 'join' && (
        <div className="w-full max-w-[300px] mt-6 flex flex-col gap-3">
          <input
            autoFocus value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="e.g. 7X2K9Q"
            className="w-full border border-td-border rounded-[14px] p-[14px] text-sm text-td-dark outline-none focus:border-td-primary text-center tracking-[0.2em] font-bold"
          />
          <button onClick={submit} disabled={busy} className="w-full border-none bg-td-primary text-white text-[15px] font-extrabold py-[14px] rounded-2xl cursor-pointer disabled:opacity-60">{busy ? 'Requesting…' : 'Request access'}</button>
          <div className="text-[12px] text-td-subtle leading-relaxed">Ask your head teacher for the centre&apos;s join code. You&apos;ll get in once they approve you.</div>
          <button onClick={() => { setMode('view'); setCode('') }} className="text-[13px] text-td-muted font-bold py-2 cursor-pointer border-none bg-transparent">Back</button>
        </div>
      )}
    </div>
  )
}
