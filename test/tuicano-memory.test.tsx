// Memory (spec §3.1 #29–34): both scopes read, and the keys that act on one.
import { describe, expect, it } from 'vitest'
import { mount, stateOf, agent, memory, KEY } from './helpers/screen'
import { Memory } from '../src/tuicano/screens/Memory'

const now = Date.now()
const tick = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => setTimeout(r, 0))
}

describe('Memory screen', () => {
  it('shows the scope about you and each agent, and ←/→ moves between them', async () => {
    const state = stateOf(
      { type: 'agent', agent: agent({ id: 'a1', name: 'Lia' }) },
      { type: 'memory', memory: memory({ id: 'm1', scope: 'me', text: 'Prefers short PRs', state: 'active', origin: 'me', confirmedAt: now, messageIds: [] }) },
      { type: 'memory', memory: memory({ id: 'm2', scope: 'a1', text: 'Knows the release process', state: 'active', origin: 'agent', agentId: 'a1', confirmedAt: now, messageIds: [] }) }
    )
    const m = mount(() => <Memory state={state} active />)
    expect(m.frame()).toContain('About you')
    expect(m.frame()).toContain('Prefers short PRs')
    expect(m.frame()).not.toContain('Knows the release process')

    m.press(KEY.right)
    await tick()
    expect(m.frame()).toContain("Lia's notes")
    expect(m.frame()).toContain('Knows the release process')

    m.press(KEY.left)
    await tick()
    expect(m.frame()).toContain('About you')
    expect(m.frame()).toContain('Prefers short PRs')

    // Tab is always-global in the router (it swaps focus), so it must not move the scope.
    m.press(KEY.tab)
    await tick()
    expect(m.frame()).toContain('About you')
    expect(m.frame()).not.toContain("Lia's notes")
  })

  it('f asks for a reason before forgetting', () => {
    const state = stateOf({ type: 'memory', memory: memory({ id: 'm1', scope: 'me', text: 'Live fact', state: 'active', confirmedAt: now, messageIds: [] }) })
    const m = mount(() => <Memory state={state} active />)
    m.press('f')
    const prompt = m.overlay.calls.find((c) => c.kind === 'prompt')
    expect(prompt?.title).toBe('Forget this')
    expect(prompt?.title).not.toBe('Delete this record for good?')
  })

  it('keeps forgotten records reachable and asks for confirmation before purging', async () => {
    const state = stateOf(
      { type: 'memory', memory: memory({ id: 'm1', scope: 'me', text: 'Live fact', state: 'active', confirmedAt: now, messageIds: [] }) },
      { type: 'memory', memory: memory({ id: 'm2', scope: 'me', text: 'Forgotten fact', state: 'forgotten', confirmedAt: now, messageIds: [] }) }
    )
    const m = mount(() => <Memory state={state} active />)
    // Forgotten ones are history: hidden until `h`, then shown.
    expect(m.frame()).not.toContain('Forgotten fact')
    m.press('h')
    await tick()
    expect(m.frame()).toContain('Forgotten fact')

    m.press(KEY.down) // onto the forgotten one
    await tick()
    m.press('P')
    const confirm = m.overlay.calls.find((c) => c.kind === 'confirm')
    expect(confirm?.title).toBe('Delete this record for good?')
  })
})
