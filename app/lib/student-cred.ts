// What a student device sends to prove who it is.
//
// It used to be the login code itself, held in localStorage and posted to every
// student RPC as p_code. That made the code a bearer password, and it is a
// password with the worst possible properties: short, permanent, and designed
// to be read out loud and forwarded. Every WhatsApp group it landed in is a
// group that can read the child's marks, fees, address and parent's number.
//
// Now the code buys a token once (claim_student_device) and the token is what
// this phone sends afterwards. The token is 32 random bytes, the server stores
// only its SHA-256, and the head can revoke it from the device list.
//
// Both are read through readStudentCred() because the server accepts either:
// a raw code still resolves, but only for a student with no live device, so
// the first claim closes that door by itself. Nobody is signed out by this
// change, and no household has to do anything.

import { readLocal, writeLocal, removeLocal } from './storage'
import { supabase } from './supabase'

const CODE = 'student_code'
const TOKEN = 'student_token'

/** The credential this device should send. The token wins once it exists. */
export const readStudentCred = (): string | null => readLocal(TOKEN) ?? readLocal(CODE)

/** Whether this device is still leaning on the raw code. */
export const hasStudentToken = (): boolean => !!readLocal(TOKEN)

/** Signing out, or a credential the server no longer recognises. Both keys go:
 *  leaving the code behind would let a revoked device fall back to it. */
export function clearStudentCred(): void {
  removeLocal(TOKEN)
  removeLocal(CODE)
}

/**
 * Spend the code once, on this device, and keep what it mints.
 *
 * The first device on a code is approved on the spot — that is the household's
 * own phone, and putting an approval in front of it would be a new step for
 * every parent to solve a problem the second device already solves. A second
 * device is stored unapproved and reads nothing until the centre allows it,
 * which is the case that actually matters: a code that travelled.
 *
 * Best-effort by design. If it fails the device keeps using the raw code and
 * tries again next launch, exactly as it behaves today.
 */
export async function claimStudentDevice(code: string): Promise<void> {
  if (readLocal(TOKEN)) return
  try {
    const { data, error } = await supabase.rpc('claim_student_device', {
      p_code: code,
      p_label: typeof navigator === 'undefined' ? null : navigator.userAgent.slice(0, 60),
    })
    const token = (data as { token?: string } | null)?.token
    if (error || !token) return
    writeLocal(TOKEN, token)
  } catch { /* offline, or an older database without the function. Keep the code. */ }
}
