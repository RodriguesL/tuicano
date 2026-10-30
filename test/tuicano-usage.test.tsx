// Usage (spec §3.1 #63): the agents, the counted-token rule, and the breakdown.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { agent, mount, stateOf, KEY } from './helpers/screen'
import { store } from '../src/tuicano/store'
import { Usage } from '../src/tuicano/screens/Usage'
import type { Settings, UsageReport } from '../src/shared/types'

const settings = (o: Partial<Settings> = {}): Settings => ({
  workspaceName: 'Time',
  context: '',
  engines: {
    claude: { installed: true, loggedIn: true },
    codex: { installed: false, loggedIn: false },
    opencode: { installed: false, loggedIn: false },
    pi: { installed: false, loggedIn: false }
  },
  routerModel: 'sonnet',
  memoryModel: 'haiku',
  memoryLearning: 'approve',
  defaultLimit: 2_000_000,
  approvalTtlHours: 24,
  theme: 'system',
  language: 'en',
  ...o
})

const report: UsageReport = {
  monthStart: Date.now() - 5 * 86_400_000,
  daysInMonth: 30,
  total: 1_000_000,
  replies: 8,
  apiUsd: 0.5,
  avgMs: 4200,
  days: [],
  who: [
    { id: 'a1', tokens: 600_000, replies: 6, avgMs: 4000 },
    { id: 'router', tokens: 10_000, replies: 2, avgMs: 100 }
  ],
  models: [{ model: 'sonnet', engine: 'claude', tokens: 600_000 }]
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('Usage screen', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows this month by agent and the counted rule', async () => {
    const spy = vi.spyOn(store, 'loadUsage').mockResolvedValue(report)
    const state = stateOf({ type: 'settings', settings: settings() }, { type: 'agent', agent: agent({ id: 'a1', name: 'Lia', used: 100_000, limit: 2_000_000 }) })
    const m = mount(() => <Usage state={state} active />)
    await flush()
    const frame = m.frame()
    expect(spy).toHaveBeenCalled()
    expect(frame).toContain('Usage and limits')
    expect(frame).toContain('Lia')
    expect(frame).toContain('cache-read token counts 10%')
    expect(frame).toContain('Router') // the app's own turns
    m.unmount()
  })

  it('←/→ changes the breakdown to models', async () => {
    vi.spyOn(store, 'loadUsage').mockResolvedValue(report)
    const state = stateOf({ type: 'settings', settings: settings() }, { type: 'agent', agent: agent({ id: 'a1', name: 'Lia' }) })
    const m = mount(() => <Usage state={state} active />)
    await flush()
    m.press(KEY.right)
    await flush()
    expect(m.frame()).toContain('Sonnet')
    m.unmount()
  })
})
