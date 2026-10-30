// Routines (spec §3.1 #43, #55, #65, #66): what the list shows, and what space/R do.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const spies = vi.hoisted(() => ({
  saveRoutine: vi.fn(async () => ({})),
  removeRoutine: vi.fn(),
  runRoutine: vi.fn(),
  checkTrigger: vi.fn(async () => 'nothing new'),
  navigate: vi.fn(),
  dmWith: vi.fn(async () => 'd1')
}))
vi.mock('../src/tuicano/store', async (orig) => ({ ...(await orig()), store: spies }))

import { mount, stateOf, agent, channel, routine } from './helpers/screen'
import { describeSchedule } from '../src/shared/types'
import { Routines } from '../src/tuicano/screens/Routines'

const schedule = { days: [1, 2, 3, 4, 5], time: '09:00' }

const state = (): ReturnType<typeof stateOf> =>
  stateOf(
    { type: 'agent', agent: agent({ id: 'a1', name: 'Lia' }) },
    { type: 'conversation', conversation: channel({ id: 'c1', members: ['a1'] }) },
    { type: 'routine', routine: routine({ id: 'r1', name: 'Good morning', agentId: 'a1', conversationId: 'c1', schedule, enabled: true }) }
  )

describe('Routines screen', () => {
  beforeEach(() => {
    for (const fn of Object.values(spies)) fn.mockClear()
  })

  it('shows the schedule text', () => {
    const m = mount(() => <Routines state={state()} active />)
    expect(m.frame()).toContain('Good morning')
    expect(m.frame()).toContain(describeSchedule(schedule))
  })

  it('space flips the routine on and off', () => {
    const m = mount(() => <Routines state={state()} active />)
    m.press(' ')
    expect(spies.saveRoutine).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1', enabled: false }))
  })

  it('R runs it now', () => {
    const m = mount(() => <Routines state={state()} active />)
    m.press('R')
    expect(spies.runRoutine).toHaveBeenCalledWith('r1')
  })

  it('c checks the trigger when there is one', () => {
    const s = stateOf(
      { type: 'agent', agent: agent({ id: 'a1', name: 'Lia' }) },
      { type: 'conversation', conversation: channel({ id: 'c1', members: ['a1'] }) },
      { type: 'routine', routine: routine({ id: 'r1', name: 'Watch', agentId: 'a1', conversationId: 'c1', schedule, enabled: true, trigger: { kind: 'webhook', token: 'abc' } }) }
    )
    const m = mount(() => <Routines state={s} active />)
    m.press('c')
    expect(spies.checkTrigger).toHaveBeenCalledWith({ kind: 'webhook', token: 'abc' })
  })
})
