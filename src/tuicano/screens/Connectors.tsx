// The connectors page in text (spec §3.1 #21-27, §3.3 row 7): the MCP servers
// connected once, their tools classified one by one, and the MCPs already set up
// in the harnesses. The same state and the same store actions as the window.
import { useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { store } from '../store'
import { L } from '../../shared/lang'
import { useOverlay, type ScreenProps } from '../overlays/api'
import { useTheme } from '../theme/context'
import { Hint, Table } from '../ui/kit'
import { Form, type FieldSpec } from '../ui/form'
import type { Connector, ConnectorAuth, ConnectorStatus, HarnessMcp, ToolClass } from '../../shared/types'

const CLASSES: ToolClass[] = ['read', 'write', 'sensitive']

// The GUI's own words for a connector's status (Pages.tsx); the same here. Built
// where it is used, not in a module constant, because the language isn't known yet
// when this module loads (CONTRIBUTING.md).
const STATUS = (): Record<ConnectorStatus, string> => ({
  connected: L('conectado', 'connected'),
  connecting: L('conectando…', 'connecting…'),
  needs_auth: L('precisa autorizar', 'needs authorization'),
  disconnected: L('desconectado', 'disconnected'),
  error: L('com problema', 'having trouble')
})

const KIND = (c: Connector): string => (c.kind === 'stdio' ? L('local', 'local') : L('remoto', 'remote'))

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

  const add = (): void => overlay.sheet({ title: L('Novo conector', 'New connector'), render: (close) => <AddConnector close={close} /> })

  const remove = (c: Connector): void =>
    overlay.confirm({ title: L(`Remover ${c.name}?`, `Remove ${c.name}?`), detail: L('Os agentes perdem acesso às ferramentas dele.', 'The agents lose access to its tools.'), yes: L('remover', 'remove'), onYes: () => store.removeConnector(c.id) })

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
          if (!m || m.added) return overlay.note(m ? L(`${m.name} já é um conector`, `${m.name} is already a connector`) : L('nada para importar', 'nothing to import'))
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
        return overlay.note(L(`autorizando ${c.name} no navegador…`, `authorizing ${c.name} in the browser…`))
      }
    },
    { isActive: active }
  )

  if (mcp) {
    return (
      <Box flexDirection="column">
        <Text bold color={t.heading}>{L('Nos seus harnesses', 'In your harnesses')}</Text>
        {mcp.error ? <Text color={t.danger}>{mcp.error}</Text> : null}
        {!mcp.list.length && !mcp.error ? <Text color={t.faint}>{L('Procurando…', 'Looking…')}</Text> : null}
        <Table
          columns={[
            { key: 'name', label: L('Servidor', 'Server') },
            { key: 'harness', label: 'Harness' },
            { key: 'added', label: L('Adicionado', 'Added') }
          ]}
          rows={mcp.list.map((m) => ({ name: m.name, harness: m.harnesses.join(', '), added: m.added ? L('sim', 'yes') : '' }))}
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
        <Text bold color={t.heading}>{`${open.name} · ${KIND(open)} · ${STATUS()[open.status]}`}</Text>
        {open.error ? <Text color={t.danger}>{open.error}</Text> : null}
        <Table
          columns={[
            { key: 'name', label: L('Ferramenta', 'Tool') },
            { key: 'cls', label: L('Classe', 'Class') },
            { key: 'on', label: L('Ligada', 'On') },
            { key: 'risk', label: L('Alto risco', 'High risk') }
          ]}
          rows={tools.map((x) => ({ name: x.name, cls: x.cls, on: x.enabled ? L('sim', 'yes') : L('não', 'no'), risk: x.highRisk ? L('sim', 'yes') : '' }))}
          cursor={toolAt}
          active={active}
        />
        {active ? <Hint keys={[['↑↓', 'move'], ['c', 'class'], ['space', 'on/off'], ['!', 'high risk'], ['a', 'authorize'], ['d', 'remove'], ['Esc', 'back']]} /> : null}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{L(`Conectores (${state.connectors.length})`, `Connectors (${state.connectors.length})`)}</Text>
      <Table
        columns={[
          { key: 'name', label: L('Nome', 'Name') },
          { key: 'kind', label: L('Tipo', 'Kind') },
          { key: 'status', label: L('Auth', 'Auth') },
          { key: 'tools', label: L('Ferramentas', 'Tools'), right: true }
        ]}
        rows={state.connectors.map((c) => ({ name: c.name, kind: KIND(c), status: STATUS()[c.status], tools: String(c.tools.length) }))}
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
    if (!name.trim()) return setError(L('Dê um nome.', 'Give it a name.'))
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
    { id: 'kind', label: L('Tipo', 'Type'), kind: 'select', value: kind, options: [{ value: 'remote', label: L('Remoto (URL)', 'Remote (URL)') }, { value: 'stdio', label: L('Local (comando)', 'Local (command)') }], onChange: (v) => setKind(v as 'remote' | 'stdio') },
    { id: 'name', label: L('Nome', 'Name'), kind: 'text', value: name, placeholder: kind === 'remote' ? L('Ex.: Linear', 'E.g. Linear') : L('Ex.: Postgres', 'E.g. Postgres'), onChange: setName },
    ...(kind === 'remote'
      ? ([
          { id: 'url', label: L('URL do servidor MCP', 'MCP server URL'), kind: 'text', value: url, placeholder: 'https://mcp.linear.app/mcp', onChange: setUrl },
          { id: 'auth', label: L('Autenticação', 'Authentication'), kind: 'select', value: auth, options: [{ value: 'oauth', label: 'OAuth' }, { value: 'token', label: 'Token' }, { value: 'none', label: L('Nenhuma', 'None') }], onChange: (v) => setAuth(v as ConnectorAuth) },
          ...(auth === 'token' ? [{ id: 'token', label: 'Token', kind: 'text', value: token, mask: true, onChange: setToken }] : [])
        ] as FieldSpec[])
      : ([
          { id: 'command', label: L('Comando', 'Command'), kind: 'text', value: command, placeholder: 'npx', onChange: setCommand },
          { id: 'args', label: L('Argumentos', 'Arguments'), kind: 'text', value: args, placeholder: '-y @modelcontextprotocol/server-postgres postgres://…', onChange: setArgs },
          { id: 'env', label: L('Variáveis de ambiente (NOME=valor por linha)', 'Environment (NAME=value per line)'), kind: 'lines', value: env, onChange: setEnv }
        ] as FieldSpec[]))
  ]

  return (
    <Box flexDirection="column">
      <Text color={t.faint}>{kind === 'stdio' ? L('Roda um processo no seu computador, com o seu usuário.', 'Runs a process on your computer, as your user.') : L('Um servidor MCP remoto; o token dele fica no cofre.', 'A remote MCP server; its token stays in the vault.')}</Text>
      <Form fields={fields} error={error} busy={busy} onCancel={close} onSubmit={submit} />
    </Box>
  )
}
