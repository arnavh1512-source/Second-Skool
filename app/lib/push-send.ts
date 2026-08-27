// Web-push fan-out, shared by every route that sends a notification.
//
// Extracted from /api/push when a second sender appeared (/api/push/student-request):
// the delivery half — batching, pruning dead subscriptions, counting deliveries
// rather than attempts — is identical for both, and the pruning rules in
// particular are the kind of detail that silently rots when it is copy-pasted.
import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logError } from './log'

export type Sub = { endpoint: string; p256dh: string; auth: string }
export type Group = { subs: Sub[]; payload: string }

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
// `||` not `??` on purpose: an env var set to an empty string in the Vercel UI
// is '' rather than undefined, and setVapidDetails throws on a blank subject —
// which would take the whole route down at module load with an opaque 500.
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@secondskool.app'

if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

export const pushConfigured = (): boolean => !!VAPID_PRIVATE

// Fan out in bounded batches (100) so a large centre can't stall the request
// or flood the push service at once. 404/410 = expired subscription → prune;
// any other failure is logged (id + status only, no PII) so it's visible in
// Vercel logs instead of vanishing silently.
export async function deliver(
  admin: SupabaseClient,
  groups: Group[],
  centre: string,
): Promise<{ sent: number; undelivered: number }> {
  const live = groups.filter(g => g.subs.length > 0)
  const total = live.reduce((n, g) => n + g.subs.length, 0)
  const stale: string[] = []
  let failed = 0
  const BATCH = 100

  for (const { subs, payload } of live) {
    for (let i = 0; i < subs.length; i += BATCH) {
      await Promise.all(subs.slice(i, i + BATCH).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        } catch (e: unknown) {
          const code = (e as { statusCode?: number })?.statusCode
          // 404/410 = subscription retired by the push service.
          // 403 = the VAPID key that signed this send isn't the one the
          // subscription was created with (i.e. the server keypair was rotated).
          // Either way it can never be delivered to again, so prune it — leaving
          // it behind means every future send reports a device that cannot
          // receive anything.
          if (code === 404 || code === 410 || code === 403) stale.push(s.endpoint)
          else failed++
          if (code !== 404 && code !== 410) logError('push.send_failed', { centre, statusCode: code ?? null })
        }
      }))
    }
  }
  if (stale.length) await admin.from('push_subscriptions').delete().in('endpoint', stale)

  // Count deliveries, not attempts. Reporting subs.length here meant a send
  // that was rejected by every push service still told the teacher "pushed to
  // 1 device" — the most misleading possible answer, because it points the
  // investigation at the phone instead of at the server.
  return { sent: total - stale.length - failed, undelivered: stale.length + failed }
}

// Every approved head of a centre, and the push subscriptions of their devices.
// One query shape, used by both senders, so "who counts as the head" can never
// drift between the authenticated and the unauthenticated path.
export async function headSubs(admin: SupabaseClient, centre: string): Promise<Sub[]> {
  const { data: heads } = await admin.from('profiles').select('id')
    .eq('centre_id', centre).eq('role', 'admin').eq('staff_status', 'approved')
  const ids = (heads ?? []).map(h => h.id)
  if (!ids.length) return []
  const { data } = await admin.from('push_subscriptions').select('endpoint,p256dh,auth').eq('kind', 'profile').in('ref', ids)
  return data ?? []
}
