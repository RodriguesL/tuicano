// Onboarding (spec §3.4 row 12): one step at a time, `l` signs in a harness, and
// `b` goes back a step.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, stateOf, KEY } from './helpers/screen'
import { store } from '../src/tuicano/store'
import { Onboarding } from '../src/tuicano/screens/Onboarding'
import type { Prompt } from '../src/tuicano/overlays/api'
import type { Settings } from '../src/shared/types'

const settings = (o: Partial<Settings> = {}): Settings => ({
  workspaceName: '',
  context: '',
  engines: {
    claude: { installed: true, loggedIn: false },
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
  onboarding: { done: false },
  ...o
})

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('Onboarding screen', () => {
  afterEach(() => vi.restoreAllMocks())

  it('walks from your name to the harnesses, and back', async () => {
    vi.spyOn(store, 'updateSettings').mockImplementation(() => {})
    const login = vi.spyOn(store, 'loginEngine').mockResolvedValue({ opened: false, command: 'claude auth login' })
    const state = stateOf({ type: 'settings', settings: settings() })
    const m = mount(() => <Onboarding state={state} active />)
    expect(m.frame()).toContain('step 1 of 5')

    m.press(KEY.enter)
    const prompt = m.overlay.calls.find((c) => c.kind === 'prompt')!.value as Prompt
    await prompt.onSubmit('Ana')
    await flush()
    expect(m.frame()).toContain('step 2 of 5')

    m.press('l')
    await flush()
    expect(login).toHaveBeenCalledWith('claude')
    expect(m.frame()).toContain('claude auth login')

    m.press('b')
    await flush()
    expect(m.frame()).toContain('step 1 of 5')
    m.unmount()
  })

  it('the models step opens a sheet when a harness is ready', async () => {
    vi.spyOn(store, 'updateSettings').mockImplementation(() => {})
    const state = stateOf({ type: 'settings', settings: settings({ engines: { ...settings().engines, claude: { installed: true, loggedIn: true } } }) })
    const m = mount(() => <Onboarding state={state} active />)
    m.press(KEY.enter)
    const prompt = m.overlay.calls.find((c) => c.kind === 'prompt')!.value as Prompt
    await prompt.onSubmit('Ana')
    await flush()
    m.press(KEY.enter) // engines -> models
    await flush()
    m.press(KEY.enter) // models -> opens the sheet
    await flush()
    expect(m.overlay.calls.some((c) => c.kind === 'sheet' && c.title === 'Models')).toBe(true)
    m.unmount()
  })
})
