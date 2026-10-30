// The connectors page in text (spec §3.1 #21-27, §3.3 row 7): the MCP servers
// connected once, their tools classified one by one, and the MCPs already set up
// in the harnesses. The same state and the same store actions as the window.
import { useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { store } from '../store'
import { useOverlay, type ScreenProps } from '../overlays/api'
import { useTheme } from '../theme/context'
import { Hint, Table } from '../ui/kit'
import { Form, type FieldSpec } from '../ui/form'
import type { Connector, ConnectorAuth, ConnectorStatus, HarnessMcp, ToolClass } from '../../shared/types'

const CLASSES: ToolClass[] = ['read', 'write', 'sensitive']

const STATUS: Record<ConnectorStatus, string> = {
  connected: 'authorized',
  connecting: 'connecting…',
  needs_auth: 'needs reconnecting',
  disconnected: 'needs reconnecting',
  error: 'error'
}

const KIND = (c: Connector): string => (c.kind === 'stdio' ? 'local' : 'remote')

// "a b 'c d'" → ["a", "b", "c d"], the same split the window's form uses.
const splitArgs = (line: string): string[] => [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]!)

export function Connectors({ state, active }: ScreenProps): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const [cursor, setCursor] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [toolCursor, setToolCursor] = useState(0)
  const [mcp, setMcp] = useState<{ list: HarnessMcp[]; error?: string } | null>(null)
  const [mcpCursor, setMcpCursor] = useState(0)

  const open = state.connectors.find((c) => c.id === openId)
  const tools = open?.tools ?? []
  const listAt = Math.max(0, Math.min(cursor, state.connectors.length - 1))
  const toolAt = Math.max(0, Math.min(toolCursor, tools.length - 1))
  const mcpAt = Math.max(0, Math.min(mcpCursor, (mcp?.list.length ?? 0) - 1))

  const loadMcps = (): void => {
    setMcp({ list: [] })
    store
      .harnessMcps()
      .then((l) => setMcp({ list: l }))
      .catch((e: unknown) => setMcp({ list: [], error: e instanceof Error ? e.message : String(e) }))
  }

  const add = (): void => overlay.sheet({ title: 'New connector', render: (close) => <AddConnector close={close} /> })

  const remove = (c: Connector): void =>
    overlay.confirm({ title: `Remove ${c.name}?`, detail: 'The agents lose access to its tools.', yes: 'remove', onYes: () => store.removeConnector(c.id) })

  const cycleClass = (name: string, cls: ToolClass, connectorId: string): void => {
    const next = CLASSES[(CLASSES.indexOf(cls) + 1) % CLASSES.length]!
    store.updateTool(connectorId, name, { cls: next })
  }

  useInput(
    (input, key) => {
      // The harnesses' own MCP servers: a small list over the page.
      if (mcp) {
        if (key.escape || input === 'i') return setMcp(null)
        if (key.upArrow || input === 'k') return setMcpCursor(Math.max(0, mcpAt - 1))
        if (key.downArrow || input === 'j') return setMcpCursor(Math.min((mcp.list.length || 1) - 1, mcpAt + 1))
        if (key.return) {
          const m = mcp.list[mcpAt]
          if (!m || m.added) return overlay.note(m ? `${m.name} is already a connector` : 'nothing to import')
          store
            .importHarnessMcp(m.key)
            .then((id) => (setMcp(null), setOpenId(id)))
            .catch((e: unknown) => overlay.note(e instanceof Error ? e.message : String(e)))
        }
        return
      }
      // Inside a connector: its tools (spec §3.1 #27).
      if (open) {
        if (key.escape || key.return) return setOpenId(null)
        if (key.upArrow || input === 'k') return setToolCursor(Math.max(0, toolAt - 1))
        if (key.downArrow || input === 'j') return setToolCursor(Math.min((tools.length || 1) - 1, toolAt + 1))
        const tool = tools[toolAt]
        if (!tool) return
        if (input === 'c') return cycleClass(tool.name, tool.cls, open.id)
        if (input === ' ') return store.updateTool(open.id, tool.name, { enabled: !tool.enabled })
        if (input === '!') return store.updateTool(open.id, tool.name, { highRisk: !tool.highRisk })
        if (input === 'a') return store.authorizeConnector(open.id)
        if (input === 'd') return remove(open)
        return
      }
      // The list of connectors.
      if (key.upArrow || input === 'k') return setCursor(Math.max(0, listAt - 1))
      if (key.downArrow || input === 'j') return setCursor(Math.min(state.connectors.length - 1, listAt + 1))
      if (key.return) {
        const c = state.connectors[listAt]
        if (c) return (setOpenId(c.id), setToolCursor(0))
        return
      }
      if (input === 'a') return add()
      if (input === 'i') return loadMcps()
      const c = state.connectors[listAt]
      if (!c) return
      if (input === 'd') return remove(c)
      if (input === 'c') return store.reconnectConnector(c.id)
      if (input === 'A') {
        store.authorizeConnector(c.id)
        return overlay.note(`authorizing ${c.name} in the browser…`)
      }
    },
    { isActive: active }
  )

  if (mcp) {
    return (
      <Box flexDirection="column">
        <Text bold color={t.heading}>{'MCP servers in your harnesses'}</Text>
        {mcp.error ? <Text color={t.danger}>{mcp.error}</Text> : null}
        {!mcp.list.length && !mcp.error ? <Text color={t.faint}>Looking…</Text> : null}
        <Table
          columns={[
            { key: 'name', label: 'Server' },
            { key: 'harness', label: 'Harness' },
            { key: 'added', label: 'Added' }
          ]}
          rows={mcp.list.map((m) => ({ name: m.name, harness: m.harnesses.join(', '), added: m.added ? 'yes' : '' }))}
          cursor={mcpAt}
          active={active}
        />
        {active ? <Hint keys={[['↑↓', 'move'], ['Enter', 'import'], ['Esc', 'back']]} /> : null}
      </Box>
    )
  }

  if (open) {
    return (
      <Box flexDirection="column">
        <Text bold color={t.heading}>{`${open.name} · ${KIND(open)} · ${STATUS[open.status]}`}</Text>
        {open.error ? <Text color={t.danger}>{open.error}</Text> : null}
        <Table
          columns={[
            { key: 'name', label: 'Tool' },
            { key: 'cls', label: 'Class' },
            { key: 'on', label: 'On' },
            { key: 'risk', label: 'High risk' }
          ]}
          rows={tools.map((x) => ({ name: x.name, cls: x.cls, on: x.enabled ? 'yes' : 'no', risk: x.highRisk ? 'yes' : '' }))}
          cursor={toolAt}
          active={active}
        />
        {active ? <Hint keys={[['↑↓', 'move'], ['c', 'class'], ['space', 'on/off'], ['!', 'high risk'], ['a', 'authorize'], ['d', 'remove'], ['Esc', 'back']]} /> : null}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{`Connectors (${state.connectors.length})`}</Text>
      <Table
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'kind', label: 'Kind' },
          { key: 'status', label: 'Auth' },
          { key: 'tools', label: 'Tools', right: true }
        ]}
        rows={state.connectors.map((c) => ({ name: c.name, kind: KIND(c), status: STATUS[c.status], tools: String(c.tools.length) }))}
        cursor={listAt}
        active={active}
      />
      {active ? <Hint keys={[['↑↓', 'move'], ['Enter', 'tools'], ['a', 'add'], ['d', 'remove'], ['c', 'reconnect'], ['A', 'authorize'], ['i', 'harness MCPs']]} /> : null}
    </Box>
  )
}

// The add form (spec §3.1 #21): the two shapes the core takes, with the core's own
// message shown in the form when it refuses.
function AddConnector({ close }: { close: () => void }): ReactNode {
  const t = useTheme()
  const [kind, setKind] = useState<'remote' | 'stdio'>('remote')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [auth, setAuth] = useState<ConnectorAuth>('oauth')
  const [token, setToken] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [env, setEnv] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  const envMap = (): Record<string, string> =>
    Object.fromEntries(
      env
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.includes('='))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
    )

  const submit = (): void => {
    if (!name.trim()) return setError('Give it a name.')
    setBusy(true)
    setError(undefined)
    const input =
      kind === 'remote'
        ? { name: name.trim(), kind, url: url.trim(), auth, token: auth === 'token' ? token.trim() : undefined }
        : { name: name.trim(), kind, command: command.trim(), args: splitArgs(args), env: envMap() }
    store
      .addConnector(input)
      .then(() => close())
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message.replace(/^Error: /, '') : String(e))
        setBusy(false)
      })
  }

  const fields: FieldSpec[] = [
    { id: 'kind', label: 'Type', kind: 'select', value: kind, options: [{ value: 'remote', label: 'Remote (URL)' }, { value: 'stdio', label: 'Local (command)' }], onChange: (v) => setKind(v as 'remote' | 'stdio') },
    { id: 'name', label: 'Name', kind: 'text', value: name, placeholder: kind === 'remote' ? 'E.g. Linear' : 'E.g. Postgres', onChange: setName },
    ...(kind === 'remote'
      ? ([
          { id: 'url', label: 'MCP server URL', kind: 'text', value: url, placeholder: 'https://mcp.linear.app/mcp', onChange: setUrl },
          { id: 'auth', label: 'Authentication', kind: 'select', value: auth, options: [{ value: 'oauth', label: 'OAuth' }, { value: 'token', label: 'Token' }, { value: 'none', label: 'None' }], onChange: (v) => setAuth(v as ConnectorAuth) },
          ...(auth === 'token' ? [{ id: 'token', label: 'Token', kind: 'text', value: token, mask: true, onChange: setToken }] : [])
        ] as FieldSpec[])
      : ([
          { id: 'command', label: 'Command', kind: 'text', value: command, placeholder: 'npx', onChange: setCommand },
          { id: 'args', label: 'Arguments', kind: 'text', value: args, placeholder: '-y @modelcontextprotocol/server-postgres postgres://…', onChange: setArgs },
          { id: 'env', label: 'Environment (NAME=value per line)', kind: 'lines', value: env, onChange: setEnv }
        ] as FieldSpec[]))
  ]

  return (
    <Box flexDirection="column">
      <Text color={t.faint}>{kind === 'stdio' ? 'Runs a process on your computer, as your user.' : 'A remote MCP server; its token stays in the vault.'}</Text>
      <Form fields={fields} error={error} busy={busy} onCancel={close} onSubmit={submit} />
    </Box>
  )
}
