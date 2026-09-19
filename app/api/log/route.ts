import { NextRequest, NextResponse } from 'next/server'
import { adminClient, adminConfigured } from '@/app/lib/supabase-admin'
import { rateLimit, clientIp } from '@/app/lib/push-guard'
import { logError, validateCrashReport } from '@/app/lib/log'

export const runtime = 'nodejs'

const MAX_BODY = 8 * 1024
// Per address: one broken phone gets its whole per-page cap through twice over.
// Globally: a bad release crashing on every device still fits, a script does not.
const PER_IP = { limit: 20, windowMs: 10 * 60_000 }
const GLOBAL = { limit: 120, windowMs: 60_000 }

// Where a client error ends up once the tab that had it is gone. There is no
// session on this path on purpose: the crashes worth knowing about include the
// ones on the login screen and on students' phones, which have no account.
// What stops abuse instead is the shape check, the two limits, and a table
// that only ever keeps its newest rows (migration 0047).
export async function POST(req: NextRequest) {
  if (!adminConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 500 })

  const text = await req.text()
  if (text.length > MAX_BODY) return NextResponse.json({ error: 'too large' }, { status: 413 })

  let raw: unknown = {}
  try { raw = JSON.parse(text) } catch {}
  const parsed = validateCrashReport(raw)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  if (await rateLimit(`log:${clientIp(req)}`, PER_IP.limit, PER_IP.windowMs)
    || await rateLimit('log:all', GLOBAL.limit, GLOBAL.windowMs)) {
    return NextResponse.json({ error: 'too many requests — slow down' }, { status: 429 })
  }

  const { error } = await adminClient().from('client_errors').insert({
    event: parsed.value.event,
    detail: parsed.value.detail,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
  })
  // On the server logError only writes the log line, so this cannot loop.
  if (error) logError('log.store_failed', { code: error.code ?? null })
  return new NextResponse(null, { status: 204 })
}
