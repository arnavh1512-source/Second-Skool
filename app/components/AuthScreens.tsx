'use client'

import { useState, useEffect } from 'react'
import { copyText, whatsappShareUrl } from '../lib/share'
import { useDashboard } from '../store'
import { supabase } from '../lib/supabase'
import { PrimaryButton } from './Shell'
import { enablePush, pushSupported, testNotification } from '../lib/push'
import { readLocal, writeLocal, removeLocal } from '../lib/storage'
import { useBusy } from '../lib/use-busy'

const LOGO = (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/icon-512.png" alt="Second Skool" width={72} height={72} className="rounded-[18px] object-cover shadow-[0_2px_10px_rgba(20,30,60,.12)]" />
)

const CLASS_OPTIONS = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12']

// Anyone stuck on these screens cannot reach the in-app report — they are not
// inside the app yet. This is the one place a direct line is worth its cost.
function HelpLine() {
  return (
    <a
      href={whatsappShareUrl('918140081461', 'Hi, I need help with Second Skool.')}
      target="_blank" rel="noreferrer"
      className="text-[12.5px] font-bold text-td-primary py-3 no-underline"
    >
      Stuck? Message us on WhatsApp
    </a>
  )
}

export function LoginScreen() {
  const { authLoading, notify, loadStudentByCode, stuSignup, setStuSignup, studentSignup } = useDashboard()
  const [mode, setMode] = useState<'choose' | 'student' | 'register' | 'email'>('choose')
  const [code, setCode] = useState('')
  const [busy, run] = useBusy()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signInWithGoogle = () => run(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) notify('Google sign-in failed')
  })

  // Email+password sign-in: the reliable path for the installed (home-screen)
  // app. Google's redirect escapes to the phone browser and the session never
  // lands back in the PWA, so the head is logged out on every launch. A password
  // login stays fully in-app, so the session persists. Staff set their password
  // once from My Profile (Set password) after a Google sign-in.
  const signInWithPassword = () => run(async () => {
    const e = email.trim().toLowerCase()
    if (!e.includes('@') || e.length < 5) { notify('Enter your email', 'error'); return }
    if (!password) { notify('Enter your password', 'error'); return }
    // On success, SupabaseProvider's onAuthStateChange picks up the session and
    // routes the head/teacher into the app.
    const { error } = await supabase.auth.signInWithPassword({ email: e, password })
    if (error) notify('Wrong email or password')
  })

  const submitCode = () => run(() => loadStudentByCode(code))

  const submitSignup = () => run(() => studentSignup())

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

          <button onClick={signInWithGoogle} className="w-full border border-td-line bg-td-card rounded-[14px] p-3.5 mt-8 flex items-center justify-center gap-[11px] cursor-pointer shadow-[0_1px_2px_rgba(20,30,60,.06)]">
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C3 17.3 2.2 20.6 2.2 24s.8 6.7 2.3 9.9l7.3-5.7z"/><path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"/></svg>
            <span className="text-[14.5px] font-bold text-td-text">Teacher — continue with Google</span>
          </button>

          <button onClick={() => setMode('email')} className="w-full border border-td-line bg-td-card rounded-[14px] p-3.5 mt-3 flex items-center justify-center gap-[11px] cursor-pointer shadow-[0_1px_2px_rgba(20,30,60,.06)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span className="text-[14.5px] font-bold text-td-text">Teacher — sign in with password</span>
          </button>
          <div className="text-[12px] text-td-subtle mt-2 leading-relaxed">Installed the app to your home screen? Use your password — it keeps you signed in. Set one in My Profile after signing in with Google.</div>

          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 h-px bg-td-border" />
            <span className="text-[12px] text-td-subtle font-semibold">or</span>
            <div className="flex-1 h-px bg-td-border" />
          </div>

          <button onClick={() => setMode('student')} className="w-full text-left border border-td-border rounded-[18px] p-[18px] mt-5 flex items-center gap-[15px] cursor-pointer bg-td-card">
            <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center bg-td-tint-green">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></svg>
            </div>
            <div className="flex-1">
              <div className="text-base font-extrabold text-td-dark">I&apos;m a student</div>
              <div className="text-[12.5px] text-td-muted mt-[3px]">Enter your code to see your updates</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-faint)" strokeWidth="2.4" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>

          <div className="mt-auto text-[12px] text-td-subtle text-center leading-relaxed pt-6">Your tuition centre sets up teacher access. Students only ever need their code.</div>
        </>
      )}

      {mode === 'student' && (
        <>
          <div className="text-sm text-td-muted mt-2 leading-relaxed">Enter the code your teacher gave you. We&apos;ll remember it on this device.</div>
          <input
            autoFocus value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submitCode()}
            placeholder="e.g. TUT-7X2K9Q" aria-label="Your student code" required aria-required="true"
            className="w-full border border-td-border rounded-[14px] p-[15px] text-base text-td-dark outline-none focus:border-td-primary text-center tracking-[0.2em] font-bold mt-7"
          />
          <button onClick={submitCode} disabled={busy} className="w-full border-none bg-td-primary text-white text-[15px] font-extrabold py-[15px] rounded-2xl cursor-pointer mt-3 disabled:opacity-60">
            {busy ? 'Checking…' : 'View my updates'}
          </button>
          <button onClick={() => setMode('register')} className="w-full border border-td-border rounded-[14px] py-[13px] cursor-pointer bg-td-card text-[13.5px] font-bold text-td-primary mt-3">New here? Register yourself</button>
          <button onClick={() => { setMode('choose'); setCode('') }} className="w-full border-none bg-transparent text-td-muted text-[13px] font-bold py-3 cursor-pointer mt-1">Back</button>
          <div className="mt-auto text-[12px] text-td-subtle text-center leading-relaxed pt-6">Don&apos;t have a code? Register with your centre code and your teacher will approve you.</div>
        </>
      )}

      {mode === 'email' && (
        <>
          <div className="text-sm text-td-muted mt-2 leading-relaxed">Sign in with your teacher email and password. Use the same email as your Google account.</div>
          <input
            autoFocus value={email} type="email" inputMode="email" autoComplete="email" aria-label="Email address" required aria-required="true"
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-td-border rounded-[14px] p-[15px] text-base text-td-dark outline-none focus:border-td-primary mt-7"
          />
          <input
            value={password} type="password" autoComplete="current-password" aria-label="Password" required aria-required="true"
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !busy && signInWithPassword()}
            placeholder="Password"
            className="w-full border border-td-border rounded-[14px] p-[15px] text-base text-td-dark outline-none focus:border-td-primary mt-3"
          />
          <button onClick={signInWithPassword} disabled={busy} className="w-full border-none bg-td-primary text-white text-[15px] font-extrabold py-[15px] rounded-2xl cursor-pointer mt-3 disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button>
          <button onClick={() => { setMode('choose'); setEmail(''); setPassword('') }} className="w-full border-none bg-transparent text-td-muted text-[13px] font-bold py-3 cursor-pointer mt-1">Back</button>
          <div className="mt-auto text-[12px] text-td-subtle text-center leading-relaxed pt-6">No password yet? Sign in with Google once, then set one in My Profile → Set password.</div>
        </>
      )}

      {mode === 'register' && (
        <>
          <div className="text-sm text-td-muted mt-2 leading-relaxed">Fill in your details. Your teacher reviews and approves them, then your code goes live.</div>
          <div className="flex flex-col gap-3 mt-6">
            <div>
              <label htmlFor="reg-code" className="text-xs font-bold text-td-muted">Student code <span className="text-td-red">*</span></label>
              <input id="reg-code" required aria-required="true" aria-describedby="reg-code-hint" value={stuSignup.joinCode} onChange={e => setStuSignup({ joinCode: e.target.value.toUpperCase() })} placeholder="e.g. 7X2K9Q" className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-1.5 tracking-[0.15em] font-bold text-center" />
              <div id="reg-code-hint" className="text-[12px] text-td-subtle mt-1">The code your teacher shared with you to register.</div>
            </div>
            <div>
              <label htmlFor="reg-name" className="text-xs font-bold text-td-muted">Full name <span className="text-td-red">*</span></label>
              <input id="reg-name" required aria-required="true" autoComplete="name" value={stuSignup.name} onChange={e => setStuSignup({ name: e.target.value })} placeholder="Your full name" className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-1.5" />
            </div>
            <div>
              <label htmlFor="reg-parent" className="text-xs font-bold text-td-muted">Parent&apos;s phone <span className="text-td-red">*</span></label>
              <input id="reg-parent" required aria-required="true" type="tel" autoComplete="tel" value={stuSignup.parent} onChange={e => setStuSignup({ parent: e.target.value })} inputMode="tel" placeholder="e.g. +91 98765 43210" className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-1.5" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="reg-class" className="text-xs font-bold text-td-muted">Class <span className="text-td-red">*</span></label>
                <select id="reg-class" required aria-required="true" value={stuSignup.klass} onChange={e => setStuSignup({ klass: e.target.value })} className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-1.5 bg-td-card">
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="reg-school" className="text-xs font-bold text-td-muted">School <span className="text-td-red">*</span></label>
                <input id="reg-school" required aria-required="true" value={stuSignup.school} onChange={e => setStuSignup({ school: e.target.value })} placeholder="Your school" className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-1.5" />
              </div>
            </div>
            <div>
              <label htmlFor="reg-address" className="text-xs font-bold text-td-muted">Address <span className="text-td-subtle font-semibold">(optional)</span></label>
              <input id="reg-address" autoComplete="street-address" value={stuSignup.address} onChange={e => setStuSignup({ address: e.target.value })} placeholder="Home address" className="w-full border border-td-border rounded-[12px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary mt-1.5" />
            </div>
          </div>
          <button onClick={submitSignup} disabled={busy} className="w-full border-none bg-td-primary text-white text-[15px] font-extrabold py-[15px] rounded-2xl cursor-pointer mt-4 disabled:opacity-60">{busy ? 'Submitting…' : 'Submit for approval'}</button>
          <button onClick={() => setMode('student')} className="w-full border-none bg-transparent text-td-muted text-[13px] font-bold py-3 cursor-pointer mt-1">I already have a code</button>
        </>
      )}
    </div>
  )
}

// Shown after a student self-registers (or when a returning pending student
// opens the app). Polls their snapshot; the moment the head approves, the
// snapshot flips to 'approved' and routes them straight into the dashboard.
// Reminders are a condition of using the app, not an upsell. The product's
// entire premise is that a student hears about tomorrow's test tonight; a
// roster of students who never enabled alerts is a centre paying for a
// reminder app that reminds nobody.
//
// The browser won't enforce this — a student can tap Block, and Chrome then
// refuses to prompt again forever — so the app enforces it instead: no student
// screen renders until permission is actually granted. When it's blocked there
// is no button that can help (calling requestPermission() again is a silent
// no-op), so the only honest thing to show is where the switch really lives.
// Permission changes arrive from three places: the in-page prompt, the browser
// settings sheet (which only shows up as a focus/visibility change on return),
// and our own grant below. Watch all three, or the gate outlives the fix.
const PERM_EVENT = 'ss-notification-permission'
function watchPermission(read: () => void): () => void {
  read()
  document.addEventListener('visibilitychange', read)
  window.addEventListener('focus', read)
  window.addEventListener(PERM_EVENT, read)
  return () => {
    document.removeEventListener('visibilitychange', read)
    window.removeEventListener('focus', read)
    window.removeEventListener(PERM_EVENT, read)
  }
}

// A student whose browser has blocked notifications cannot grant them from
// inside the page — requestPermission() is a silent no-op once denied — so the
// gate had no exit: their only options were "Turn on reminders" (does nothing)
// and "Sign out". Marks, fees and homework were unreachable because of a
// browser setting they may not be able to change on a borrowed phone. This flag
// lets a *blocked* student continue anyway. It is deliberately not offered
// while permission is still 'default': there the prompt genuinely works, and
// the centre's whole reason for the gate is that reminders get switched on.
const BYPASS_KEY = 'notif_gate_bypass'
const gateBypassed = () => readLocal(BYPASS_KEY) === '1'

// True once we know a student has not granted notification permission.
// Deliberately starts false: gating on the very first paint, before the effect
// has read the real value, would flash the gate at students who already
// allowed. Browsers without push at all are never gated — there is no
// permission to grant, so holding them would lock them out permanently.
export function useNotificationGate(): boolean {
  const [gated, setGated] = useState(false)
  useEffect(() => watchPermission(() => {
    // Read the guard BEFORE touching Notification. watchPermission calls this
    // synchronously, so on a browser with no Notification API (a plain iOS
    // Safari tab, most Android in-app WebViews) the ReferenceError escaped the
    // effect, hit ErrorBoundary and replaced the entire app — login screen
    // included — for every visitor, gated or not.
    if (!pushSupported()) { setGated(false); return }
    const granted = Notification.permission === 'granted'
    // Permission granted later clears the bypass, so a student who fixes it in
    // browser settings goes back to the normal (gated-if-revoked) behaviour.
    if (granted && gateBypassed()) removeLocal(BYPASS_KEY)
    setGated(!granted && !gateBypassed())
  }), [])
  return gated
}

export function NotificationGateScreen() {
  const { stuPending, students, currentStudentDbId, signOut, notify, centreName } = useDashboard()
  const code = stuPending?.code
    || students.find(s => s.dbId === currentStudentDbId)?.id
    || (readLocal('student_code') ?? '')

  const [perm, setPerm] = useState<NotificationPermission>('default')
  const [busy, run] = useBusy()

  useEffect(() => watchPermission(() => setPerm(Notification.permission)), [])

  const turnOn = () => run(async () => {
    if (!code) return
    const r = await enablePush('student', code)
    setPerm(Notification.permission)
    // Tell the router's copy of this state too, so a grant clears the gate
    // straight away instead of waiting for the next focus change.
    window.dispatchEvent(new Event(PERM_EVENT))
    if (!r.ok) { notify(r.error || 'Could not turn on reminders'); return }
    const t = await testNotification(centreName)
    notify(t.ok ? 'Reminders on — check for the test alert' : 'Reminders on')
  })

  const blocked = perm === 'denied'
  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col items-center justify-center text-center">
      <div className="w-[72px] h-[72px] rounded-[22px] bg-td-tint-blue flex items-center justify-center mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
      </div>
      <div className="text-[20px] font-extrabold text-td-dark">{blocked ? 'Reminders are blocked' : 'Turn on reminders'}</div>
      <div className="text-sm text-td-muted mt-2 leading-relaxed max-w-[300px]">
        {blocked
          ? `Your browser is blocking reminders from ${centreName || 'your coaching centre'}, so we can’t tell you about tests, homework or fees. Allow them to continue.`
          : `${centreName || 'Your coaching centre'} needs to send you reminders about tests, homework and fees. Turn them on to continue.`}
      </div>

      {blocked ? (
        <div className="mt-6 w-full max-w-[320px] bg-td-card border border-td-border rounded-[16px] p-4 text-left">
          <div className="text-[12px] font-extrabold text-td-dark mb-2">How to allow them</div>
          <ol className="text-[12.5px] text-td-muted leading-relaxed list-decimal pl-4 flex flex-col gap-1">
            <li>Tap the lock or ⓘ icon next to the web address</li>
            <li>Open <span className="font-bold text-td-text">Permissions</span> → <span className="font-bold text-td-text">Notifications</span></li>
            <li>Switch it to <span className="font-bold text-td-text">Allow</span></li>
            <li>Come back here — this screen clears on its own</li>
          </ol>
          <button
            onClick={() => { writeLocal(BYPASS_KEY, '1'); window.dispatchEvent(new Event(PERM_EVENT)) }}
            className="mt-3 w-full text-[12.5px] font-bold text-td-primary py-2.5 cursor-pointer border-none bg-transparent"
          >
            Continue without reminders
          </button>
          <div className="text-[12px] text-td-subtle leading-relaxed mt-1">You will not be told about tests, homework or fees until you allow them.</div>
        </div>
      ) : (
        <div className="mt-7 w-full max-w-[320px]">
          <PrimaryButton onClick={turnOn}>{busy ? 'Turning on…' : 'Turn on reminders'}</PrimaryButton>
        </div>
      )}

      {code && (
        <div className="mt-6 border border-td-border rounded-[14px] px-5 py-3 bg-td-card">
          <div className="text-[12px] font-bold text-td-subtle uppercase tracking-wide">Your code — save it</div>
          <div className="text-lg font-extrabold text-td-dark tracking-[0.15em] mt-1">{code}</div>
        </div>
      )}
      <button onClick={signOut} className="mt-auto text-[12.5px] text-td-muted font-bold py-3 cursor-pointer border-none bg-transparent">Sign out</button>
    </div>
  )
}

export function StuPendingScreen() {
  const { stuPending, signOut, loadStudentByCode, notify } = useDashboard()
  const [busy, run] = useBusy()
  const code = stuPending?.code || (readLocal('student_code') ?? '')

  useEffect(() => {
    if (!code) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') loadStudentByCode(code, false)
    }, 15000)
    return () => clearInterval(id)
  }, [code, loadStudentByCode])

  const checkNow = () => run(async () => {
    if (!code) return
    const ok = await loadStudentByCode(code, true)
    // Only reassure if they're genuinely still pending. If the head declined,
    // loadStudentByCode has already routed to the declined screen — don't
    // flash a "hang tight" toast that contradicts it.
    if (!ok && useDashboard.getState().screen === 'stuPending') notify('Still awaiting approval — hang tight')
  })

  const copyCode = () => {
    if (!code) return
    copyText(code, notify, 'Code copied')
  }

  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col items-center justify-center text-center">
      <div className="w-[72px] h-[72px] rounded-[22px] bg-td-tint-amber flex items-center justify-center mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-amber)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
      </div>
      <div className="text-[20px] font-extrabold text-td-dark">You&apos;re on the list{stuPending?.name ? `, ${stuPending.name.split(' ')[0]}` : ''}!</div>
      <div className="text-sm text-td-muted mt-2 leading-relaxed max-w-[300px]">Your teacher{stuPending?.centre ? ` at ${stuPending.centre}` : ''} is reviewing your details. You&apos;ll get in the moment they approve you.</div>

      {code && (
        <button onClick={copyCode} className="mt-6 border border-td-border rounded-[14px] px-5 py-3 bg-td-card cursor-pointer">
          <div className="text-[12px] font-bold text-td-subtle uppercase tracking-wide">Your code — save it</div>
          <div className="text-lg font-extrabold text-td-dark tracking-[0.15em] mt-1">{code}</div>
        </button>
      )}

      <button onClick={checkNow} disabled={busy} className="border-none bg-td-primary text-white text-[14px] font-extrabold py-[13px] px-8 rounded-2xl cursor-pointer mt-6 disabled:opacity-60">{busy ? 'Checking…' : 'Check approval'}</button>
      <button onClick={signOut} className="text-[12.5px] text-td-muted font-bold py-3 cursor-pointer border-none bg-transparent mt-2">Use a different code</button>
    </div>
  )
}

// Shown when the head declines a student's registration. Replaces the hopeful
// "you're on the list" screen so a rejected student gets a clear, honest state
// instead of waiting forever for an approval that will never come.
export function StuDeniedScreen() {
  const { stuDenied, signOut } = useDashboard()
  const first = stuDenied?.name ? `, ${stuDenied.name.split(' ')[0]}` : ''
  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col items-center justify-center text-center">
      <div className="w-[72px] h-[72px] rounded-[22px] bg-td-tint-red flex items-center justify-center mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-red)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>
      </div>
      <div className="text-[20px] font-extrabold text-td-dark">Registration not approved</div>
      <div className="text-sm text-td-muted mt-2 leading-relaxed max-w-[300px]">Your teacher{stuDenied?.centre ? ` at ${stuDenied.centre}` : ''} didn&apos;t approve this request{first}. If you think this is a mistake, reach out to them directly — or register again with the correct details.</div>
      <button onClick={signOut} className="border-none bg-td-primary text-white text-[14px] font-extrabold py-[13px] px-8 rounded-2xl cursor-pointer mt-7">Back to start</button>
    </div>
  )
}

// One-time details gate for staff. Shown straight after sign-in and before
// registering, because the head teacher approves a join request on the
// strength of these details — a Google display name alone tells them nothing.
export function ProfileSetupScreen() {
  const { googleEmail, saveStaffProfile, signOut } = useDashboard()
  // Intentionally blank rather than seeded from the Google account: the whole
  // point is that the teacher enters their own details.
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState('')
  const [qualification, setQualification] = useState('')
  const [busy, run] = useBusy()

  // No disabled state: saveStaffProfile validates and says exactly what's
  // wrong. A dead button that never explains itself is the worse failure.
  const submit = () => run(() => saveStaffProfile({ name, phone, subject, qualification }))

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder: string, hint?: string) => (
    <div>
      <label className="text-xs font-bold text-td-muted mb-[7px] block">{label}</label>
      <input
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onKeyDown={e => e.key === 'Enter' && submit()}
        className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary"
      />
      {hint && <div className="text-[12px] text-td-subtle mt-1.5">{hint}</div>}
    </div>
  )

  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col">
      {LOGO}
      <div className="text-[24px] font-extrabold text-td-dark tracking-tight mt-[22px]">Tell us about you</div>
      <div className="text-sm text-td-muted mt-2 leading-relaxed">
        Signed in as <span className="font-bold text-td-text">{googleEmail}</span>. These details are what your centre and its students will see.
      </div>

      <div className="flex flex-col gap-3.5 mt-7">
        {field('Full name', name, setName, 'e.g. Priya Sharma')}
        {field('Phone', phone, setPhone, '+91 98765 43210', 'Your head teacher uses this to reach you.')}
        {field('Subject you teach', subject, setSubject, 'e.g. Mathematics, Physics')}
        {field('Qualification', qualification, setQualification, 'e.g. M.Sc. Mathematics')}
        <div className="text-[12px] text-td-subtle">All four are required — your students see them on your teacher profile.</div>
        <PrimaryButton onClick={submit}>{busy ? 'Saving…' : 'Continue'}</PrimaryButton>
      </div>

      <button onClick={signOut} className="mt-auto text-[12.5px] text-td-muted font-bold py-3 cursor-pointer border-none bg-transparent">Sign out</button>
    </div>
  )
}

export function RegisterScreen() {
  const { googleEmail, createCentre, joinCentre, signOut, notify } = useDashboard()
  const [busy, run] = useBusy()
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [centreName, setCentreName] = useState('')
  const [code, setCode] = useState('')


  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col">
      {LOGO}
      <div className="text-[24px] font-extrabold text-td-dark tracking-tight mt-[22px]">Set up your access</div>
      <div className="text-sm text-td-muted mt-2 leading-relaxed">Signed in as <span className="font-bold text-td-text">{googleEmail}</span>.</div>

      {mode === 'choose' && (
        <div className="flex flex-col gap-[13px] mt-7">
          <button onClick={() => setMode('create')} className="text-left border rounded-[20px] p-[18px] flex items-center gap-[15px] cursor-pointer bg-td-card" style={{ borderColor: 'var(--color-td-edge-blue)' }}>
            <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center bg-td-ink">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <div className="flex-1">
              <div className="text-base font-extrabold text-td-dark">Create a centre</div>
              <div className="text-[12.5px] text-td-muted mt-[3px]">Start your own — you&apos;ll be the head teacher.</div>
            </div>
          </button>
          <button onClick={() => setMode('join')} className="text-left border rounded-[20px] p-[18px] flex items-center gap-[15px] cursor-pointer bg-td-card" style={{ borderColor: 'var(--color-td-border)' }}>
            <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center bg-td-tint-blue">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
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
          <PrimaryButton onClick={() => run(() => centreName.trim().length >= 2 ? createCentre(centreName) : notify('Enter your centre name', 'error'))}>{busy ? 'Creating…' : 'Create centre'}</PrimaryButton>
          <button onClick={() => setMode('choose')} className="text-[13px] text-td-muted font-bold py-2 cursor-pointer border-none bg-transparent">Back</button>
        </div>
      )}

      {mode === 'join' && (
        <div className="mt-7 flex flex-col gap-3">
          <label className="text-xs font-bold text-td-muted">Centre join code</label>
          <input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. 7X2K9Q" aria-label="Centre join code" required aria-required="true" className="w-full border border-td-border rounded-[14px] p-[14px] text-sm text-td-dark outline-none focus:border-td-primary text-center tracking-[0.2em] font-bold" />
          <PrimaryButton onClick={() => run(() => code.trim().length >= 4 ? joinCentre(code) : notify('Enter the full join code', 'error'))}>{busy ? 'Joining…' : 'Join centre'}</PrimaryButton>
          <div className="text-[12px] text-td-subtle leading-relaxed">Ask your head teacher for the centre&apos;s join code. You&apos;ll get access once they approve you.</div>
          <button onClick={() => setMode('choose')} className="text-[13px] text-td-muted font-bold py-2 cursor-pointer border-none bg-transparent">Back</button>
        </div>
      )}

      <div className="mt-auto pt-6 flex flex-col items-center">
        <HelpLine />
        <button onClick={signOut} className="text-[12.5px] text-td-muted font-bold py-3 cursor-pointer border-none bg-transparent">Sign out</button>
      </div>
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
      <div className="w-[72px] h-[72px] rounded-[22px] bg-td-tint-amber flex items-center justify-center mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-amber)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
      </div>
      <div className="text-[20px] font-extrabold text-td-dark">Waiting for approval</div>
      <div className="text-sm text-td-muted mt-2 leading-relaxed max-w-[300px]">Your head teacher needs to approve <span className="font-bold text-td-text">{googleEmail}</span> before you can start. You&apos;ll get in as soon as they do.</div>
      <button onClick={() => window.location.reload()} className="border-none bg-td-primary text-white text-[14px] font-extrabold py-[13px] px-8 rounded-2xl cursor-pointer mt-7">Check again</button>
      <HelpLine />
      <button onClick={signOut} className="text-[12.5px] text-td-muted font-bold py-3 cursor-pointer border-none bg-transparent mt-2">Sign out</button>
    </div>
  )
}

export function DeniedScreen() {
  const { signOut, joinCentre, notify } = useDashboard()
  const [mode, setMode] = useState<'view' | 'join'>('view')
  const [code, setCode] = useState('')
  const [busy, run] = useBusy()
  const submit = () => run(() => {
    // A dead button that never explains itself is the worse failure.
    if (code.trim().length < 4) { notify('Enter the full centre code', 'error'); return }
    return joinCentre(code)
  })
  return (
    <div className="animate-[pop_.35s_ease] px-6 pt-10 pb-6 min-h-[700px] flex flex-col items-center justify-center text-center">
      <div className="w-[72px] h-[72px] rounded-[22px] bg-td-tint-red flex items-center justify-center mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-red)" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>
      </div>
      <div className="text-[20px] font-extrabold text-td-dark">Access not granted</div>

      {mode === 'view' && (
        <>
          <div className="text-sm text-td-muted mt-2 leading-relaxed max-w-[300px]">This account isn&apos;t part of a centre yet. Enter a join code to request access, or sign out and use a student code instead.</div>
          <button onClick={() => setMode('join')} className="border-none bg-td-primary text-white text-[14px] font-extrabold py-[13px] px-8 rounded-2xl cursor-pointer mt-7">Enter a join code</button>
          <HelpLine />
          <button onClick={signOut} className="text-[12.5px] text-td-muted font-bold py-3 cursor-pointer border-none bg-transparent mt-2">Sign out</button>
        </>
      )}

      {mode === 'join' && (
        <div className="w-full max-w-[300px] mt-6 flex flex-col gap-3">
          <input
            autoFocus value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="e.g. 7X2K9Q" aria-label="Centre join code" required aria-required="true"
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
