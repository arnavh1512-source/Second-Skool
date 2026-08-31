import 'server-only'

// Who may open the developer console. Baked in rather than configured: there is
// exactly one person who runs this system, and an env var that can be forgotten
// in a new Vercel project is one more way to lock yourself out.
//
// `server-only` above is the guarantee that matters: if any client component
// ever imports this module, the build fails instead of shipping the address —
// and the seat-taking powers it names — into the browser bundle.
const ALLOWED = ['arnavh1512@gmail.com']

// The subset of the Supabase user we are willing to trust an identity decision
// to. Kept structural so the check can be tested without a live auth server.
type OperatorClaims = {
  email?: string | null
  email_confirmed_at?: string | null
  identities?: { provider: string }[] | null
}

type OperatorVerdict = { operator: boolean; reason: 'ok' | 'not_listed' | 'unconfirmed' | 'not_google' }

// Matching the address is necessary but nowhere near sufficient.
//
// A bearer token only proves that Supabase issued it — not that the address on
// it was ever proven. Two project settings decide whether that address can be
// claimed by someone else: if signup confirmation is off, an unconfirmed signup
// still gets a session; if secure email change is off, any signed-in user can
// move their account onto a new address. Today the unique constraint on
// auth.users.email happens to block both, because the operator's account
// already holds the address — but that is an accident of the current config,
// not a control, and it stops holding the moment same-email-across-providers is
// enabled or the account is ever recreated.
//
// So the address must additionally be one Google vouches for. Google owns the
// mailbox; an attacker who can set `email` on their own row cannot also mint a
// Google identity for it.
export function verifyOperator(user: OperatorClaims | null | undefined): OperatorVerdict {
  const email = user?.email?.toLowerCase().trim() ?? ''
  if (!email || !ALLOWED.includes(email)) return { operator: false, reason: 'not_listed' }
  if (!user?.email_confirmed_at) return { operator: false, reason: 'unconfirmed' }

  // A missing `identities` array means the auth API changed shape, not that the
  // account has no providers — failing closed there would lock the operator out
  // of their own system on someone else's deploy. A present array that lacks
  // Google is a real answer, and it is a no.
  const identities = user.identities
  if (!Array.isArray(identities)) return { operator: true, reason: 'ok' }
  return identities.some(i => i?.provider === 'google')
    ? { operator: true, reason: 'ok' }
    : { operator: false, reason: 'not_google' }
}
