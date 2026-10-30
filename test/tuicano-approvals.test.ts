// The gate (spec §3.1 #28): what a keypress means on an approval. The terminal
// has no press-and-hold, so a high-risk call needs the same key twice inside the
// window, and a single press must never approve one.
import { describe, expect, it } from 'vitest'
import { ARM_MS, gateIntent } from '../src/tuicano/approvals'

const plain = { highRisk: false }
const risky = { highRisk: true }
const T = 1_000_000

describe('the approval gate', () => {
  it('approves a plain call on one press', () => {
    expect(gateIntent('y', plain, undefined, T)).toEqual({ kind: 'approve', always: false })
  })

  it('approves always on Y, for a plain call', () => {
    expect(gateIntent('Y', plain, undefined, T)).toEqual({ kind: 'approve', always: true })
  })

  it('asks for a reason on x, whatever the risk', () => {
    expect(gateIntent('x', plain, undefined, T)).toEqual({ kind: 'ask-reason' })
    expect(gateIntent('x', risky, T - 10, T)).toEqual({ kind: 'ask-reason' })
  })

  it('never approves a high-risk call on a single press: it arms instead', () => {
    expect(gateIntent('y', risky, undefined, T)).toEqual({ kind: 'arm' })
    expect(gateIntent('Y', risky, undefined, T)).toEqual({ kind: 'arm' })
  })

  it('approves a high-risk call on the second press inside the window', () => {
    expect(gateIntent('y', risky, T - 1, T)).toEqual({ kind: 'approve', always: false })
    expect(gateIntent('Y', risky, T - 1, T)).toEqual({ kind: 'approve', always: true })
    expect(gateIntent('y', risky, T - (ARM_MS - 1), T)).toEqual({ kind: 'approve', always: false })
  })

  it('arms again when the window has passed', () => {
    expect(gateIntent('y', risky, T - ARM_MS, T)).toEqual({ kind: 'arm' })
    expect(gateIntent('y', risky, T - 60_000, T)).toEqual({ kind: 'arm' })
  })

  it('arms again on a clock that went backwards, instead of trusting it', () => {
    expect(gateIntent('y', risky, T + 5, T)).toEqual({ kind: 'arm' })
  })
})
