// Why a family is dark, not just how many are.
//
// reach.ts answers the head's first question — how many families opened the app
// this week — and it answers it in two buckets, active and missed, because two
// is all the number needs to be worth looking at. But "missed" is not one
// problem. Three different things put a family in it, and each one is a
// different phone call:
//
//   dark   the code never turned into an open. Nobody ever got in. That is a
//          delivery problem: the slip went home in a bag and stayed there.
//   once   they got in, looked at the one screen, and never came back. The app
//          did not earn a second visit. That is a first-session problem.
//   quiet  they used to look and have stopped. Something they were coming for
//          is no longer there. That is a retention problem.
//
// Every one of these is read off data the app already stamps: last_seen_at on
// the student (0024, written by get_student_snapshot on the household's own
// app-open) and created_at on the device row the phone claimed (0040). Nobody
// types anything, which is the only reason this ships.
//
// The one approximation: nothing counts opens, so "came back" is inferred from
// the gap between claiming the phone and the last time it was seen. A family
// whose last visit was the same day they set the phone up did not return. A
// family with no device row at all but a last_seen_at from before 0040 is a
// family that used to look and has not since — quiet, by the same reading.

import { opened } from './reach'

/** Same-day is the first session still. A day later is a family that came back. */
const RETURN_GAP_MS = 86_400_000

export type Stage = 'active' | 'dark' | 'once' | 'quiet'
/** The three that are a problem to act on. 'active' is the one that is not. */
export type Missed = Exclude<Stage, 'active'>

interface Seen { lastSeenAt?: string }
interface Claim { studentId?: string; when: string }

export function stageOf(student: Seen, firstClaimAt: number | null, now = Date.now()): Stage {
  if (opened(student, now)) return 'active'
  const seen = student.lastSeenAt ? Date.parse(student.lastSeenAt) : NaN
  if (Number.isNaN(seen)) return 'dark'
  if (firstClaimAt === null) return 'quiet'
  return seen - firstClaimAt > RETURN_GAP_MS ? 'quiet' : 'once'
}

/**
 * When each student's first phone was claimed, keyed by student id. A second
 * phone says nothing about the first visit, so the earliest claim is the one
 * that counts.
 */
export function firstClaims(devices: readonly Claim[]): Record<string, number> {
  const first: Record<string, number> = {}
  for (const d of devices) {
    if (!d.studentId) continue
    const at = Date.parse(d.when)
    if (Number.isNaN(at)) continue
    if (first[d.studentId] === undefined || at < first[d.studentId]) first[d.studentId] = at
  }
  return first
}

export type Funnel = Record<Stage, number>

export function funnelSummary(
  students: readonly (Seen & { dbId?: string })[],
  devices: readonly Claim[],
  now = Date.now(),
): Funnel {
  const claims = firstClaims(devices)
  const out: Funnel = { active: 0, dark: 0, once: 0, quiet: 0 }
  for (const s of students) {
    const claim = s.dbId !== undefined ? claims[s.dbId] : undefined
    out[stageOf(s, claim ?? null, now)]++
  }
  return out
}
