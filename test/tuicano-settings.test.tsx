// Settings (spec §3.1 #18/#19/#20/#44/#45/#46/#56/#57/#58/#59/#60/#61/#64): the
// harnesses show their state, `l` asks the core to log in, and when no terminal
// opens the command it returns is printed for the person to run.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, stateOf } from './helpers/screen'
import { store } from '../src/tuicano/store'
import { Settings } from '../src/tuicano/screens/Settings'
import type { Settings as SettingsData } from '../src/shared/types'

const settings = (o: Partial<SettingsData> = {}): SettingsData => ({
  workspaceName: 'Time',
  context: '',
  engines: {
    claude: { installed: true, loggedIn: false, path: '/usr/local/bin/claude' },
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

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('Settings screen', () => {
  afterEach(() => vi.restoreAllMocks())

  it("shows a harness's state and prints the login command when none opens", async () => {
    const login = vi.spyOn(store, 'loginEngine').mockResolvedValue({ opened: false, command: 'claude auth login' })
    const state = stateOf({ type: 'settings', settings: settings() })
    const m = mount(() => <Settings state={state} active />)
    expect(m.frame()).toContain('Claude Code')
    expect(m.frame()).toContain('not signed in')
    m.press('l')
    await flush()
    expect(login).toHaveBeenCalledWith('claude')
    expect(m.frame()).toContain('claude auth login')
    m.unmount()
  })

  it('r refreshes the engines and t sends a test reply', async () => {
    const refresh = vi.spyOn(store, 'refreshEngines').mockImplementation(() => {})
    const test = vi.spyOn(store, 'testEngine').mockResolvedValue({ ok: true, message: 'pong' })
    const state = stateOf({ type: 'settings', settings: settings({ engines: { ...settings().engines, claude: { installed: true, loggedIn: true } } }) })
    const m = mount(() => <Settings state={state} active />)
    m.press('r')
    m.press('t')
    await flush()
    expect(refresh).toHaveBeenCalled()
    expect(test).toHaveBeenCalledWith('sonnet')
    expect(m.frame()).toContain('working. pong')
    m.unmount()
  })
})
