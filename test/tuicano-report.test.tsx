// Report (spec §3.1 #62): the week, the problems, and ←/→ moving the week.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { agent, mount, stateOf, KEY } from './helpers/screen'
import { store } from '../src/tuicano/store'
import { Report } from '../src/tuicano/screens/Report'
import { startOfWeek } from '../src/shared/format'
import type { Report as ReportData, Settings } from '../src/shared/types'

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

const report: ReportData = {
  since: startOfWeek(Date.now()),
  until: startOfWeek(Date.now()) + 7 * 86_400_000,
  agents: [
    {
      agentId: 'a1',
      total: { replies: 4, ok: 3 },
      failed: 1,
      cut: 0,
      paused: 0,
      approvals: { asked: 1, refused: 0 },
      avgTokens: 1000,
      avgMs: 5000,
      problems: [{ kind: 'failed', at: Date.now(), conversationId: 'c1', messageId: 'm1', detail: 'boom' }],
      weeks: []
    }
  ],
  skills: [],
  work: []
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('Report screen', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows the week, the rate and the problems', async () => {
    const spy = vi.spyOn(store, 'loadReport').mockResolvedValue(report)
    const state = stateOf({ type: 'settings', settings: settings() }, { type: 'agent', agent: agent({ id: 'a1', name: 'Lia' }) })
    const m = mount(() => <Report state={state} active />)
    await flush()
    const frame = m.frame()
    expect(spy).toHaveBeenCalled()
    expect(frame).toContain('Report')
    expect(frame).toContain('Lia')
    expect(frame).toContain('3/4')
    expect(frame).toContain('Failed')
    expect(frame).toContain('boom')
    m.unmount()
  })

  it('← moves to the previous week', async () => {
    const spy = vi.spyOn(store, 'loadReport').mockResolvedValue(report)
    const state = stateOf({ type: 'settings', settings: settings() })
    const m = mount(() => <Report state={state} active />)
    await flush()
    const first = spy.mock.calls[0]![0]!
    m.press(KEY.left)
    await flush()
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(spy.mock.calls[1]![0]!).toBeLessThan(first)
    m.unmount()
  })
})
