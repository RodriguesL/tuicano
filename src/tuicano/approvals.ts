// The approval gate (spec §3.1 #28), apart from the keyboard handling so it can
// be tested on its own: the product's whole point is that a sensitive call waits
// for a person, and the one thing that must never be wrong is what a keypress
// means.
import type { Approval } from '../shared/types'

export type GateKey = 'y' | 'x' | 'Y'

export type GateIntent =
  | { kind: 'approve'; always: boolean }
  // The terminal's equivalent of the GUI's 1.5 s press-and-hold on a high-risk
  // call: the same key again, inside the window.
  | { kind: 'arm' }
  | { kind: 'ask-reason' }

export const ARM_MS = 3_000

// `armedAt` is when this same approval was armed, if it was. A keypress must land
// inside the window to count as the confirmation.
export function gateIntent(key: GateKey, approval: Pick<Approval, 'highRisk'>, armedAt: number | undefined, now: number): GateIntent {
  if (key === 'x') return { kind: 'ask-reason' }
  if (!approval.highRisk) return { kind: 'approve', always: key === 'Y' }
  const confirmed = armedAt !== undefined && now >= armedAt && now - armedAt < ARM_MS
  return confirmed ? { kind: 'approve', always: key === 'Y' } : { kind: 'arm' }
}
