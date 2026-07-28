import { createClient } from '@supabase/supabase-js'

// Env values pasted into dashboards sometimes carry invisible or "smart"
// characters (zero-width spaces, curly quotes, NBSPs) that break fetch headers
// with "String contains non ISO-8859-1 code point". Supabase URLs and keys are
// pure printable ASCII, so strip anything outside that range defensively.
const clean = (v: string) => v.replace(/[^\x20-\x7E]/g, '').trim()

const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
const supabaseAnonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')

if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey))
  console.warn('Supabase env vars missing — live mode will not work')

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      // Keep the head/teacher signed in across app launches. These are the
      // supabase-js defaults, but we set them explicitly so a future default
      // change can't silently start logging users out on mobile.
      persistSession: true,
      autoRefreshToken: true,
      // Parse the token that Google returns in the redirect URL and store it.
      detectSessionInUrl: true,
      // Implicit flow returns the session directly in the redirect hash. PKCE
      // needs the code-verifier to still be in storage at exchange time, which
      // breaks when an installed PWA hands OAuth to an external browser — so
      // implicit is the more reliable choice for this add-to-home-screen app.
      flowType: 'implicit',
      // Stable, app-specific key so the session isn't lost if the default
      // storage key ever changes between SDK versions.
      storageKey: 'second-skool-auth',
    },
  },
)
