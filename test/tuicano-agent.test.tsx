// The agent page in text (spec §3.3 rows 2 and 3): the frame shows who the agent
// is, its model and limit and its grants; the editor and the model picker open as
// sheets, and saving goes through the same store action the window calls.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AgentPage } from '../src/tuicano/screens/Agent'
import { store } from '../src/tuicano/store'
import { KEY, agent, channel, mount, stateOf } from './helpers/screen'
import type { Connector, EngineStatus, Settings } from '../src/shared/types'

const engines = (over: Partial<Record<keyof Settings['engines'], EngineStatus>> = {}): Settings['engines'] => ({
  claude: { installed: true, loggedIn: true, route: 'plan' },
  codex: { installed: true, loggedIn: true, route: 'plan' },
  opencode: { installed: true, loggedIn: true, route: 'providers' },
  pi: { installed: false, loggedIn: false },
  ...over
})

const settings = (over: Partial<Settings> = {}): Settings => ({
  workspaceName: 'Me',
  context: '',
  engines: engines(),
  routerModel: 'haiku',
  memoryModel: 'haiku',
  memoryLearning: 'approve',
  defaultLimit: 2_000_000,
  approvalTtlHours: 24,
  theme: 'system',
  language: 'en',
  ...over
})

const linear: Connector = {
  id: 'c1',
  name: 'Linear',
  kind: 'remote',
  url: 'https://mcp.linear.app/mcp',
  auth: 'oauth',
  status: 'connected',
  tools: [{ name: 'list_issues', description: '', cls: 'read', enabled: true, highRisk: false, isNew: false }]
}

const baseState = (agentOver = {}, over: Partial<Settings> = {}) =>
  stateOf(
    { type: 'settings', settings: settings(over) },
    { type: 'agent', agent: agent({ name: 'Lia', handle: 'lia', modelId: 'sonnet', limit: 2_000_000, used: 500_000, grants: { c1: 'read' }, ...agentOver }) },
    { type: 'conversation', conversation: channel({ members: ['a1'] }) },
    { type: 'connector', connector: linear }
  )

// A sheet's content is a render function; render it the way the host would.
const renderSheet = (mounted: ReturnType<typeof mount>): ReactNode => {
  const sheet = mounted.overlay.calls.find((c) => c.kind === 'sheet')
  if (!sheet) throw new Error('no sheet was opened')
  return (sheet.value as { render: (close: () => void) => ReactNode }).render(() => {})
}

afterEach(() => vi.restoreAllMocks())

describe('the agent page', () => {
  it('shows the name, the model, the limit and the grants', () => {
    const state = baseState()
    const frame = mount(() => <AgentPage state={state} active id="a1" />).frame()
    expect(frame).toContain('Lia')
    expect(frame).toContain('@lia')
    expect(frame).toContain('Sonnet')
    expect(frame).toContain('2M') // tokens(2_000_000)
    expect(frame).toContain('Linear')
    expect(frame).toContain('read') // the grant level
  })

  it('e opens the identity editor and saving calls the store', async () => {
    const save = vi.spyOn(store, 'saveAgent').mockResolvedValue(undefined)
    const state = baseState()
    const m = mount(() => <AgentPage state={state} active id="a1" />)
    m.press('e')
    expect(m.overlay.calls.some((c) => c.kind === 'sheet')).toBe(true)
    const form = mount(() => renderSheet(m))
    form.type('x') // on the name field: "Lia" → "Liax"
    await Promise.resolve()
    form.press(KEY.ctrl('s'))
    await Promise.resolve()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]![0].name).toBe('Liax')
  })

  it('S saves the draft through the store', () => {
    const save = vi.spyOn(store, 'saveAgent').mockResolvedValue(undefined)
    const m = mount(() => <AgentPage state={baseState()} active id="a1" />)
    m.press('S')
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('the model picker lists the app models for a plan harness', () => {
    const m = mount(() => <AgentPage state={baseState()} active id="a1" />)
    m.press('m')
    const picker = mount(() => renderSheet(m))
    const frame = picker.frame()
    expect(frame).toContain('Sonnet')
    expect(frame).toContain('Opus')
  })

  it('the model picker lists the fetched models for a provider', async () => {
    vi.spyOn(store, 'engineModels').mockResolvedValue({ models: ['qwen', 'llama'] })
    const state = baseState({ modelId: 'opencode:qwen' })
    const m = mount(() => <AgentPage state={state} active id="a1" />)
    m.press('m')
    const picker = mount(() => renderSheet(m))
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    expect(picker.frame()).toContain('qwen')
    expect(picker.frame()).toContain('llama')
  })

  it('cycling a grant on an existing agent calls store.setGrant', async () => {
    const grant = vi.spyOn(store, 'setGrant').mockImplementation(() => {})
    const m = mount(() => <AgentPage state={baseState()} active id="a1" />)
    // Grant rows come after Identity (5) + Harness and model (4), the two headings
    // the cursor skips: nine steps down reach the first connector's grant.
    for (let i = 0; i < 9; i++) {
      m.press(KEY.down)
      await Promise.resolve()
    }
    m.press(KEY.enter)
    await Promise.resolve()
    expect(grant).toHaveBeenCalledWith('a1', 'c1', 'read_write')
  })

  it('clearing the browser asks with a confirmation first', () => {
    const clear = vi.spyOn(store, 'browserAction').mockImplementation(() => {})
    const m = mount(() => <AgentPage state={baseState({ browser: true })} active id="a1" />)
    m.press('X')
    const confirm = m.overlay.calls.find((c) => c.kind === 'confirm')
    expect(confirm?.title).toContain('logins')
    expect(clear).not.toHaveBeenCalled() // nothing happens until the confirmation
  })
})
