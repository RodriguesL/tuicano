// The connectors page in text (spec §3.1 #21-27, §3.3 row 7): the list with its
// tools, cycling a class, and the add form surfacing the core's own message.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { Connectors } from '../src/tuicano/screens/Connectors'
import { store } from '../src/tuicano/store'
import { KEY, mount, stateOf } from './helpers/screen'
import type { Connector, HarnessMcp, Settings } from '../src/shared/types'

const settings: Settings = {
  workspaceName: 'Me',
  context: '',
  engines: {
    claude: { installed: true, loggedIn: true, route: 'plan' },
    codex: { installed: true, loggedIn: true, route: 'plan' },
    opencode: { installed: true, loggedIn: true, route: 'providers' },
    pi: { installed: false, loggedIn: false }
  },
  routerModel: 'haiku',
  memoryModel: 'haiku',
  memoryLearning: 'approve',
  defaultLimit: 2_000_000,
  approvalTtlHours: 24,
  theme: 'system',
  language: 'en'
}

const linear: Connector = {
  id: 'c1',
  name: 'Linear',
  kind: 'remote',
  url: 'https://mcp.linear.app/mcp',
  auth: 'oauth',
  status: 'needs_auth',
  tools: [
    { name: 'list_issues', description: '', cls: 'read', enabled: true, highRisk: false, isNew: false },
    { name: 'create_issue', description: '', cls: 'write', enabled: false, highRisk: false, isNew: true }
  ]
}

const state = () => stateOf({ type: 'settings', settings }, { type: 'connector', connector: linear })

const renderSheet = (mounted: ReturnType<typeof mount>): ReactNode => {
  const sheet = mounted.overlay.calls.find((c) => c.kind === 'sheet')
  if (!sheet) throw new Error('no sheet was opened')
  return (sheet.value as { render: (close: () => void) => ReactNode }).render(() => {})
}

afterEach(() => vi.restoreAllMocks())

describe('the connectors page', () => {
  it('shows the connector with its kind, auth state and tool count', () => {
    const frame = mount(() => <Connectors state={state()} active />).frame()
    expect(frame).toContain('Linear')
    expect(frame).toContain('remote')
    expect(frame).toContain('needs reconnecting')
    expect(frame).toContain('2') // two tools
  })

  it('Enter opens the tools, and c cycles a tool class', async () => {
    const update = vi.spyOn(store, 'updateTool').mockReturnValue(undefined)
    const m = mount(() => <Connectors state={state()} active />)
    m.press(KEY.enter)
    await Promise.resolve()
    expect(m.frame()).toContain('list_issues')
    m.press('c')
    await Promise.resolve()
    expect(update).toHaveBeenCalledWith('c1', 'list_issues', { cls: 'write' })
  })

  it('a opens the add form and shows the core error', async () => {
    vi.spyOn(store, 'addConnector').mockRejectedValue(new Error('that URL is not reachable'))
    const m = mount(() => <Connectors state={state()} active />)
    m.press('a')
    const form = mount(() => renderSheet(m))
    form.press(KEY.enter) // off the "Type" select, onto "Name"
    await Promise.resolve()
    form.type('My server')
    await Promise.resolve()
    form.press(KEY.ctrl('s'))
    await new Promise((r) => setTimeout(r, 0))
    expect(form.frame()).toContain('not reachable')
  })

  it('i lists the harness MCP servers and Enter imports one', async () => {
    const found: HarnessMcp[] = [{ key: 'k1', name: 'github', kind: 'remote', address: 'https://api.githubcopilot.com/mcp/', harnesses: ['claude'], added: false }]
    vi.spyOn(store, 'harnessMcps').mockResolvedValue(found)
    const imp = vi.spyOn(store, 'importHarnessMcp').mockResolvedValue('c9')
    const m = mount(() => <Connectors state={state()} active />)
    m.press('i')
    await new Promise((r) => setTimeout(r, 0))
    expect(m.frame()).toContain('github')
    m.press(KEY.enter)
    await new Promise((r) => setTimeout(r, 0))
    expect(imp).toHaveBeenCalledWith('k1')
  })

  it('d removes a connector only after a confirmation', () => {
    const remove = vi.spyOn(store, 'removeConnector').mockImplementation(() => {})
    const m = mount(() => <Connectors state={state()} active />)
    m.press('d')
    expect(m.overlay.calls.some((c) => c.kind === 'confirm')).toBe(true)
    expect(remove).not.toHaveBeenCalled()
  })
})
