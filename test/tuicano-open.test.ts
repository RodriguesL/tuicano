// The `--open` resolver (spec §5): a herdr action opens a pane already looking at a
// channel, a DM or a screen, and a typo has to say what it could have meant.
import { describe, expect, it } from 'vitest'
import { agent, channel, dm, stateOf } from './helpers/screen'
import { opensNothing, resolveOpen } from '../src/tuicano/open'

const state = () =>
  stateOf(
    { type: 'agent', agent: agent({ id: 'a1', handle: 'lia', name: 'Lia' }) },
    { type: 'conversation', conversation: channel({ id: 'c1', name: 'engenharia', members: ['a1'] }) },
    { type: 'conversation', conversation: dm({ id: 'd1', name: 'a1' }) }
  )

describe('the --open resolver', () => {
  it('takes a view by name', () => {
    expect(resolveOpen(state(), 'approvals')).toEqual({ kind: 'view', view: { kind: 'approvals' } })
    expect(resolveOpen(state(), 'usage')).toEqual({ kind: 'view', view: { kind: 'usage' } })
  })

  it('takes a channel by name, with or without the #', () => {
    expect(resolveOpen(state(), '#engenharia')).toEqual({ kind: 'view', view: { kind: 'conversation', id: 'c1' } })
    expect(resolveOpen(state(), 'engenharia')).toEqual({ kind: 'view', view: { kind: 'conversation', id: 'c1' } })
  })

  it('takes an agent by handle or id, as a DM to open', () => {
    expect(resolveOpen(state(), '@lia')).toEqual({ kind: 'dm', agentId: 'a1' })
    expect(resolveOpen(state(), 'lia')).toEqual({ kind: 'dm', agentId: 'a1' })
  })

  it('takes a DM by the name the sidebar shows it under', () => {
    expect(resolveOpen(state(), 'Lia')).toEqual({ kind: 'dm', agentId: 'a1' })
  })

  it('says nothing for an empty or unknown spec, and offers what it knows', () => {
    expect(resolveOpen(state(), undefined)).toBeUndefined()
    expect(resolveOpen(state(), '')).toBeUndefined()
    expect(resolveOpen(state(), 'nope')).toBeUndefined()
    expect(opensNothing('nope')).toContain('nope')
    expect(opensNothing('nope')).toContain('#channel')
  })
})
