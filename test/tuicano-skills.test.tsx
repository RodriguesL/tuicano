// Skills (spec §3.1 #47–54): a proposal reads as waiting for you and `y` decides it;
// `i` lists the skills already on the machine.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const spies = vi.hoisted(() => ({
  saveSkill: vi.fn(async () => ({})),
  localSkills: vi.fn(async () => [{ source: '/home/me/.claude/skills/ci/SKILL.md', name: 'ci-watch', description: 'Watch CI', origin: 'Claude Code', files: [], scripts: false }]),
  linkSkill: vi.fn(async () => ({})),
  decideSkill: vi.fn(),
  restoreSkill: vi.fn(),
  archiveSkill: vi.fn(),
  removeSkill: vi.fn(),
  skillVersions: vi.fn(async () => [])
}))
vi.mock('../src/tuicano/store', async (orig) => ({ ...(await orig()), store: spies }))

import { mount, stateOf, agent, skill } from './helpers/screen'
import { Skills } from '../src/tuicano/screens/Skills'

const now = Date.now()
const tick = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => setTimeout(r, 0))
}

describe('Skills screen', () => {
  beforeEach(() => {
    for (const fn of Object.values(spies)) fn.mockClear()
  })

  it('shows a proposal as waiting for you and y approves it', () => {
    const state = stateOf(
      { type: 'agent', agent: agent({ id: 'a1', name: 'Lia' }) },
      { type: 'skill', skill: skill({ id: 's1', name: 'release-notes', description: 'Write the notes', body: 'step one', agents: [], state: 'pending', proposedBy: 'a1', createdAt: now, updatedAt: now }) }
    )
    const m = mount(() => <Skills state={state} active />)
    expect(m.frame()).toContain('release-notes')
    expect(m.frame()).toContain('waiting for you')
    m.press('y')
    expect(spies.decideSkill).toHaveBeenCalledWith('s1', true)
  })

  it('i lists the local skills and Enter links one', async () => {
    const state = stateOf(
      { type: 'agent', agent: agent({ id: 'a1', name: 'Lia' }) },
      { type: 'skill', skill: skill({ id: 's1', name: 'release-notes', description: 'Write the notes', body: 'step one', agents: [], state: 'active', createdAt: now, updatedAt: now }) }
    )
    const m = mount(() => <Skills state={state} active />)
    m.press('i')
    await tick()
    expect(spies.localSkills).toHaveBeenCalled()
    expect(m.frame()).toContain('ci-watch')
    m.press('\r')
    await tick()
    expect(spies.linkSkill).toHaveBeenCalledWith('/home/me/.claude/skills/ci/SKILL.md', [])
  })
})
