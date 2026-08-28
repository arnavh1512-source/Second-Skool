import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The one place the service-role key is read.
//
// That key bypasses RLS completely, so "where does it live" is a question worth
// being able to answer in one line rather than three. `server-only` above turns
// an accidental import from a client component into a build error instead of a
// key in the browser bundle.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

/** Both halves of the connection are present. Routes refuse to run without it. */
export const adminConfigured = (): boolean => Boolean(url && serviceKey)

/** A client that answers to nobody. Authorize the caller before you use it. */
export const adminClient = (): SupabaseClient =>
  createClient(url, serviceKey, { auth: { persistSession: false } })

/**
 * The shape of the two env vars, for a log line when Supabase rejects a token.
 * Lengths and prefixes only - never the values. A quoted or newline-padded
 * paste in the Vercel UI is the usual cause and is invisible in every other
 * symptom; the host says which project the server thinks it is talking to.
 */
export const adminEnvShape = () => ({
  supabaseHost: (() => { try { return new URL(url).host } catch { return null } })(),
  urlLen: url.length,
  urlClean: url === url.trim() && url.startsWith('https://'),
  keyLen: serviceKey.length,
  keyClean: serviceKey === serviceKey.trim() && serviceKey.startsWith('eyJ'),
})
