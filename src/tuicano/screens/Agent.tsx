// The agent's page in text (spec §3.3 rows 2 and 3): one screen for an existing
// agent and for a draft the Tuca's card proposes. The window's AgentPage keeps a
// local draft and saves it; so does this one, with a cursor standing in for the
// mouse and the same store actions behind each row.
import { useEffect, useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { store } from '../store'
import { client } from '../client'
import { computerOf, slug, type State } from '../../app/store'
import { useOverlay, type ScreenProps } from '../overlays/api'
import { agentColor, useTheme } from '../theme/context'
import { Bar, Hint, List, type Row } from '../ui/kit'
import { Form, type FieldSpec } from '../ui/form'
import { tokens } from '../../shared/format'
import {
  EFFORTS,
  ENGINES,
  ENGINE_IDS,
  MODELS,
  customModel,
  modelInfo,
  type Agent,
  type AgentColor,
  type EngineId,
  type GrantLevel,
  type MemoryMode,
  type Settings
} from '../../shared/types'

const COLORS: AgentColor[] = ['sky', 'indigo', 'violet', 'rose', 'amber', 'green', 'teal', 'graphite']
const LEVELS: GrantLevel[] = ['none', 'read', 'read_write']
const MEMORY_MODES: MemoryMode[] = ['auto', 'approve', 'read']
type ComputerChoice = 'none' | 'linux' | 'mac'
const COMPUTERS: ComputerChoice[] = ['none', 'linux', 'mac']
const HANDLE_OK = /^[a-z0-9][a-z0-9_-]{1,31}$/

// The harnesses an agent may actually run on: ready, not turned off, not "coming
// soon", and not excluded by the person's pick (spec §3.1 #46).
const usableHarnesses = (settings: Settings): EngineId[] => {
  const picked = settings.harnesses
  return ENGINE_IDS.filter((e) => {
    const st = settings.engines[e]
    return !!st && st.loggedIn && !st.off && !st.soon && (!picked || picked.includes(e))
  })
}

const isPlan = (engine: EngineId, settings: Settings): boolean =>
  (engine === 'claude' || engine === 'codex') && settings.engines[engine]?.route !== 'gateway'

// One selectable thing on the page; `heading` is a row the cursor skips.
type Sel =
  | { t: 'heading' }
  | { t: 'name' }
  | { t: 'handle' }
  | { t: 'role' }
  | { t: 'color' }
  | { t: 'instructions' }
  | { t: 'harness' }
  | { t: 'model' }
  | { t: 'effort' }
  | { t: 'limit' }
  | { t: 'grant'; id: string }
  | { t: 'memory' }
  | { t: 'computer' }
  | { t: 'browser' }
  | { t: 'web' }
  | { t: 'lend' }
  | { t: 'folder'; name: string }

const selKey = (s: Sel): string => (s.t === 'grant' ? `grant:${s.id}` : s.t === 'folder' ? `folder:${s.name}` : s.t)

export function AgentPage({ state, active, id, draft: proposed, fromMessage }: ScreenProps & { id?: string; draft?: Agent; fromMessage?: string }): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const existing = id ? state.agents.find((a) => a.id === id) : undefined
  const [draft, setDraft] = useState<Agent>(() => existing ?? proposed ?? store.newAgentDraft())
  const [handleTyped, setHandleTyped] = useState(false)
  const [cursor, setCursor] = useState(0)
  // Only reset when switching agents, not on every store change (the GUI's rule).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (existing) setDraft(existing)
    else if (proposed) setDraft(proposed)
  }, [id])

  const isNew = !existing
  const usable = usableHarnesses(state.settings)
  const model = modelInfo(draft.modelId)
  const engine: EngineId = model?.engine ?? usable[0] ?? 'claude'
  const chosen = state.conversations.filter((c) => c.kind === 'channel' && c.members.includes(draft.id)).map((c) => c.id)
  const handleErr = !HANDLE_OK.test(draft.handle) ? 'Use 2 to 32 lowercase letters, numbers, - or _.' : state.agents.some((a) => a.handle === draft.handle && a.id !== draft.id) ? `@${draft.handle} already exists.` : null
  const canSave = draft.name.trim().length > 0 && !handleErr && !!modelInfo(draft.modelId)?.id
  const computer: ComputerChoice = draft.computer ? (draft.computerKind ?? 'linux') : 'none'
  const info = draft.id ? computerOf(state, draft.id) : undefined

  // ---------- rows ----------

  const rows: Row[] = []
  const sels: Sel[] = []
  const head = (label: string): void => {
    rows.push({ key: `h:${rows.length}`, label, heading: true })
    sels.push({ t: 'heading' })
  }
  const put = (sel: Sel, r: Omit<Row, 'key'>): void => {
    rows.push({ key: selKey(sel), ...r })
    sels.push(sel)
  }

  head('Identity')
  put({ t: 'name' }, { label: 'Name', hint: draft.name || '—' })
  put({ t: 'handle' }, { label: '@handle', hint: `@${draft.handle || 'handle'}` })
  put({ t: 'role' }, { label: 'Role', hint: draft.role || '—' })
  put({ t: 'color' }, { label: 'Colour', hint: draft.color, color: agentColor(t, draft.color) })
  put({ t: 'instructions' }, { label: 'Instructions', hint: draft.instructions.split('\n')[0]?.slice(0, 60) || '(empty)' })
  head('Harness and model')
  put({ t: 'harness' }, { label: 'Harness', hint: usable.length ? ENGINES[engine].label : 'no harness is ready' })
  put({ t: 'model' }, { label: 'Model', hint: model?.label ?? draft.modelId })
  put({ t: 'effort' }, { label: 'Effort', hint: draft.effort })
  put({ t: 'limit' }, { label: 'Monthly limit', hint: `${draft.limit / 1_000_000}M tokens` })
  if (state.connectors.length) {
    head('Grants')
    for (const c of state.connectors) put({ t: 'grant', id: c.id }, { label: c.name, hint: draft.grants[c.id] ?? 'none' })
  }
  head('Powers')
  put({ t: 'memory' }, { label: 'Memory', hint: draft.memory })
  put({ t: 'computer' }, { label: 'Computer', hint: computer === 'none' ? 'none' : `${computer}${info ? ` · ${info.state}` : ''}` })
  put({ t: 'browser' }, { label: 'Browser', hint: draft.browser ? 'on' : 'off' })
  put({ t: 'web' }, { label: 'Web', hint: draft.web === false ? 'off' : 'on' })
  if (!isNew && draft.computer) {
    head('Folders')
    put({ t: 'lend' }, { label: 'Lend a folder…', hint: 'type a path' })
    for (const f of draft.folders ?? []) put({ t: 'folder', name: f.name }, { label: `/projetos/${f.name}`, hint: `${f.path}${f.readOnly ? ' · read only' : ' · read and write'}` })
  }

  const firstSel = Math.max(0, sels.findIndex((s) => s.t !== 'heading'))
  const at = sels[cursor]?.t === 'heading' ? firstSel : Math.max(0, Math.min(cursor, sels.length - 1))
  const current = sels[at]

  const move = (dir: number): void => {
    let i = at + dir
    while (i > 0 && i < sels.length && sels[i]?.t === 'heading') i += dir
    setCursor(Math.max(0, Math.min(sels.length - 1, i)))
  }

  // ---------- edits (a local draft, saved with S; access changes apply right away) ----------

  const ask = (title: string, value: string, onOk: (v: string) => void): void => overlay.prompt({ title, label: title, value, onSubmit: onOk })

  const cycle = <T,>(list: T[], value: T, set: (v: T) => void): void => {
    const i = list.indexOf(value)
    set(list[(i + 1) % list.length]!)
  }

  const setGrant = (connectorId: string, level: GrantLevel): void => {
    setDraft((d) => ({ ...d, grants: { ...d.grants, [connectorId]: level } }))
    if (!isNew) store.setGrant(draft.id, connectorId, level)
  }

  const applyComputer = (k: ComputerChoice): void => {
    const patch = { computer: k !== 'none', computerKind: (k === 'none' ? (draft.computerKind ?? 'linux') : k) as Agent['computerKind'] }
    setDraft((d) => ({ ...d, ...patch }))
    if (!isNew) store.patchAgent(draft.id, patch)
  }

  const setComputer = (k: ComputerChoice): void => {
    if (k === 'mac' && draft.computerKind !== 'mac') {
      return overlay.confirm({
        title: `Give ${draft.name || 'the agent'} this computer?`,
        detail: 'Its commands run as you, with everything you have installed, and reach what you reach.',
        yes: 'give it this computer',
        onYes: () => applyComputer('mac')
      })
    }
    applyComputer(k)
  }

  const togglePower = (key: 'browser' | 'web'): void => {
    const next = key === 'browser' ? !draft.browser : draft.web === false
    setDraft((d) => ({ ...d, [key]: next }))
    if (!isNew) store.patchAgent(draft.id, { [key]: next })
  }

  const cycleHarness = (): void => {
    if (!usable.length) return overlay.note('no harness is ready')
    const i = usable.indexOf(engine)
    const next = usable[(i + 1) % usable.length]!
    const first = isPlan(next, state.settings) ? MODELS.find((m) => m.engine === next) : undefined
    setDraft((d) => ({ ...d, modelId: first?.id ?? customModel(next, '') }))
  }

  // ---------- sheets ----------

  const editIdentity = (): void =>
    overlay.sheet({ title: 'Identity', render: (close) => <IdentitySheet state={state} agent={draft} chosen={chosen} onSaved={setDraft} close={close} /> })

  const openModel = (): void =>
    overlay.sheet({ title: 'Harness and model', render: (close) => <ModelSheet settings={state.settings} value={draft.modelId} onPick={(modelId) => setDraft((d) => ({ ...d, modelId }))} close={close} /> })

  const computerMenu = (): void => {
    if (isNew) return
    const agentId = draft.id
    overlay.sheet({
      title: `Computer · ${draft.name || 'agent'}`,
      render: (close) => (
        <Form
          fields={(['refresh', 'start', 'restart', 'open_folder', 'erase'] as const).map((a) => ({
            id: a,
            label: a.replace(/_/g, ' '),
            kind: 'action' as const,
            value: a.replace(/_/g, ' '),
            onActivate: () => {
              if (a === 'erase') {
                close()
                return overlay.confirm({ title: 'Erase its computer?', detail: 'Everything in it goes, including /work.', yes: 'erase', onYes: () => store.computerAction(agentId, 'erase') })
              }
              store.computerAction(agentId, a)
            }
          }))}
          onCancel={close}
        />
      )
    })
  }

  // ---------- actions ----------

  const save = (): void => {
    if (!canSave) return overlay.note(handleErr ?? 'give it a name')
    store
      .saveAgent(draft, chosen)
      .then(() => {
        if (isNew && fromMessage) store.settleDraft(fromMessage, draft.id)
        if (isNew) store.navigate({ kind: 'agent', id: draft.id })
        else overlay.note('saved')
      })
      .catch((e: unknown) => overlay.note(e instanceof Error ? e.message : String(e)))
  }

  const test = (): void => {
    if (!draft.modelId) return
    overlay.note('testing…')
    store
      .testEngine(draft.modelId)
      .then((r) => overlay.note(r.ok ? `works: ${r.message}` : r.message))
      .catch((e: unknown) => overlay.note(e instanceof Error ? e.message : String(e)))
  }

  const login = (): void => {
    store
      .loginEngine(engine)
      .then((r) => overlay.note(r.opened ? `a terminal opened for ${ENGINES[engine].label}` : `no terminal to open — run: ${r.command}`))
      .catch((e: unknown) => overlay.note(e instanceof Error ? e.message : String(e)))
  }

  // The TUI has no folder picker (spec §2.5): the typed path goes straight to the
  // core, which validates it. The store action wraps a picker, so this one call
  // goes through the client instead of through it.
  const lend = (): void => {
    if (isNew) return overlay.note('save the agent first')
    const agentId = draft.id
    overlay.prompt({
      title: 'Lend a folder',
      label: 'Path',
      placeholder: '/Users/you/projects/app',
      onSubmit: async (path) => {
        // Through the application layer, like every other action: a renderer with no
        // picker lends a typed path, and the core answers with why not.
        const why = await store.lendFolderPath(agentId, path)
        overlay.note(why ?? `lent ${path}`)
      }
    })
  }

  const folderAction = (action: 'read_only' | 'read_write' | 'return'): void => {
    if (isNew || current?.t !== 'folder') return
    store.folderAction(draft.id, current.name, action)
  }

  const activate = (sel: Sel | undefined): void => {
    switch (sel?.t) {
      case 'name':
        return ask('Name', draft.name, (v) => setDraft((d) => ({ ...d, name: v, ...(isNew && !handleTyped ? { handle: slug(v) } : {}) })))
      case 'handle':
        return ask('@handle', draft.handle, (v) => (setHandleTyped(true), setDraft((d) => ({ ...d, handle: v.toLowerCase().replace(/\s/g, '') }))))
      case 'role':
        return ask('Role', draft.role, (v) => setDraft((d) => ({ ...d, role: v })))
      case 'color':
        return cycle(COLORS, draft.color, (v) => setDraft((d) => ({ ...d, color: v })))
      case 'instructions':
        return editIdentity()
      case 'harness':
        return cycleHarness()
      case 'model':
        return openModel()
      case 'effort':
        return cycle(EFFORTS.map((e) => e.id), draft.effort, (v) => setDraft((d) => ({ ...d, effort: v })))
      case 'limit':
        return ask('Monthly limit (millions of tokens)', String(draft.limit / 1_000_000), (v) => setDraft((d) => ({ ...d, limit: Math.max(0, Math.round(Number(v) * 1_000_000) || 0) })))
      case 'grant':
        return cycle(LEVELS, draft.grants[sel.id] ?? 'none', (v) => setGrant(sel.id, v))
      case 'memory':
        return cycle(MEMORY_MODES, draft.memory, (v) => {
          setDraft((d) => ({ ...d, memory: v }))
          if (!isNew) store.patchAgent(draft.id, { memory: v })
        })
      case 'computer':
        return setComputer(COMPUTERS[(COMPUTERS.indexOf(computer) + 1) % COMPUTERS.length]!)
      case 'browser':
      case 'web':
        return togglePower(sel.t)
      case 'lend':
        return lend()
      default:
    }
  }

  useInput(
    (input, key) => {
      if (key.upArrow || input === 'k') return move(-1)
      if (key.downArrow || input === 'j') return move(1)
      if (key.return) return activate(current)
      if (input === 'e' || input === 'E') return editIdentity()
      if (input === 'm') return openModel()
      if (input === 't') return test()
      if (input === 'l') return current?.t === 'folder' || current?.t === 'lend' ? lend() : login()
      if (input === 'o') return folderAction('read_only')
      if (input === 'w') return folderAction('read_write')
      if (input === 'R') return folderAction('return')
      if (input === 'c' && !isNew) return computerMenu()
      if (input === 'v' && !isNew && draft.browser) return store.browserAction(draft.id, 'show')
      if (input === 'X' && !isNew && draft.browser)
        return overlay.confirm({ title: 'Delete its browser logins?', detail: 'Logins, cookies and history go; the agent stays signed out.', yes: 'delete', onYes: () => store.browserAction(draft.id, 'clear') })
      if (input === 's' || input === 'S') return save()
      if (input === 'D' && !isNew) return void store.openDm(draft.id)
      if (input === 'A' && !isNew) return void store.archiveAgent(draft.id, !draft.archived)
      if (key.escape) {
        const first = state.conversations.find((c) => c.kind === 'channel')
        if (first) store.navigate({ kind: 'conversation', id: first.id })
      }
    },
    { isActive: active }
  )

  const memberOf = state.conversations.filter((c) => c.kind === 'channel' && c.members.includes(draft.id)).map((c) => c.name)

  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>
        {isNew ? 'New agent' : draft.name || 'Agent'}
        {draft.archived ? <Text color={t.warn}>{'  · archived'}</Text> : null}
      </Text>
      <Text color={t.dim}>{`@${draft.handle || 'handle'} · ${draft.role || 'no role'}`}</Text>
      <Text color={t.faint}>{`${ENGINES[engine].label} · ${model?.label ?? draft.modelId}`}</Text>
      <List rows={rows} cursor={at} active={active} />
      <Text>
        <Text color={t.dim}>{'usage '}</Text>
        <Text color={t.text}>{`${tokens(draft.used)} / ${tokens(draft.limit)}`}</Text>
        <Text>{'  '}</Text>
        <Bar used={draft.used} limit={draft.limit} />
      </Text>
      <Text color={t.faint}>{`channels: ${memberOf.length ? memberOf.join(', ') : 'none'}`}</Text>
      {active ? (
        <Hint
          keys={[
            ['↑↓', 'move'],
            ['Enter', 'edit'],
            ['S', 'save'],
            ['e', 'identity'],
            ['m', 'model'],
            ['t', 'test'],
            ['l', 'login / lend'],
            ['c', 'computer'],
            ['D', 'dm'],
            ['A', 'archive'],
            ['Esc', 'back']
          ]}
        />
      ) : null}
    </Box>
  )
}

// The identity editor: the fields the window's Profile card takes, saved with the
// store so a taken handle shows the core's message (spec §3.1 #7).
function IdentitySheet({ state, agent, chosen, onSaved, close }: { state: State; agent: Agent; chosen: string[]; onSaved: (a: Agent) => void; close: () => void }): ReactNode {
  const [name, setName] = useState(agent.name)
  const [handle, setHandle] = useState(agent.handle)
  const [role, setRole] = useState(agent.role)
  const [color, setColor] = useState<AgentColor>(agent.color)
  const [instructions, setInstructions] = useState(agent.instructions)
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const handleErr = !HANDLE_OK.test(handle) ? 'Use 2 to 32 lowercase letters, numbers, - or _.' : state.agents.some((a) => a.handle === handle && a.id !== agent.id) ? `@${handle} already exists.` : undefined
  const fields: FieldSpec[] = [
    { id: 'name', label: 'Name', kind: 'text', value: name, onChange: setName },
    { id: 'handle', label: '@handle', kind: 'text', value: handle, hint: handleErr, onChange: (v) => setHandle(v.toLowerCase().replace(/\s/g, '')) },
    { id: 'role', label: 'Role', kind: 'text', value: role, onChange: setRole },
    { id: 'color', label: 'Colour', kind: 'select', value: color, options: COLORS.map((c) => ({ value: c, label: c })), onChange: (v) => setColor(v as AgentColor) },
    { id: 'instructions', label: 'Instructions', kind: 'lines', value: instructions, onChange: setInstructions }
  ]
  const submit = (): void => {
    if (!name.trim()) return setError('Give it a name.')
    if (handleErr) return setError(handleErr)
    setBusy(true)
    setError(undefined)
    const next: Agent = { ...agent, name: name.trim(), handle, role, color, instructions }
    store
      .saveAgent(next, chosen)
      .then(() => {
        onSaved(next)
        close()
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e))
        setBusy(false)
      })
  }
  return <Form title="Identity" fields={fields} error={error} busy={busy} onCancel={close} onSubmit={submit} />
}

// The model picker (spec §3.1 #45): the app's list on a plan, the harness's own
// list off it, fetched when the picker opens, with its error shown if it fails.
function ModelSheet({ settings, value, onPick, close }: { settings: Settings; value: string; onPick: (id: string) => void; close: () => void }): ReactNode {
  const usable = usableHarnesses(settings)
  const current = modelInfo(value)
  const [engine, setEngine] = useState<EngineId>(current?.engine && usable.includes(current.engine) ? current.engine : (usable[0] ?? 'claude'))
  const [model, setModel] = useState(value)
  const [name, setName] = useState('')
  const [list, setList] = useState<{ models: string[]; error?: string } | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const plan = isPlan(engine, settings)

  useEffect(() => {
    if (plan) return
    let live = true
    setList(null)
    store
      .engineModels(engine)
      .then((r) => live && setList(r))
      .catch((e: unknown) => live && setList({ models: [], error: e instanceof Error ? e.message : String(e) }))
    return () => {
      live = false
    }
  }, [engine, plan])

  const options = plan ? MODELS.filter((m) => m.engine === engine).map((m) => ({ value: m.id, label: m.label })) : (list?.models ?? []).map((m) => ({ value: customModel(engine, m), label: m }))
  if (model && !options.some((o) => o.value === model)) options.push({ value: model, label: modelInfo(model)?.label ?? model })

  const fields: FieldSpec[] = [
    {
      id: 'engine',
      label: 'Harness',
      kind: 'select',
      value: engine,
      options: usable.map((e) => ({ value: e, label: ENGINES[e].label })),
      onChange: (v) => {
        const e = v as EngineId
        setEngine(e)
        setName('')
        const first = isPlan(e, settings) ? MODELS.find((m) => m.engine === e) : undefined
        setModel(first?.id ?? customModel(e, ''))
      }
    },
    {
      id: 'model',
      label: 'Model',
      kind: 'select',
      value: model,
      options,
      hint: list?.error ? `couldn't get the list: ${list.error}` : plan ? undefined : list ? undefined : 'fetching…',
      onChange: setModel
    },
    { id: 'name', label: 'Other model (exact name)', kind: 'text', value: name, placeholder: 'the exact model name', onChange: setName },
    {
      id: 'test',
      label: 'Test',
      kind: 'action',
      value: 'send a test',
      onActivate: () => {
        const id = name.trim() ? customModel(engine, name) : model
        setResult('testing…')
        store
          .testEngine(id)
          .then((r) => setResult(r.ok ? `works: ${r.message}` : r.message))
          .catch((e: unknown) => setResult(e instanceof Error ? e.message : String(e)))
      }
    }
  ]

  return (
    <Box flexDirection="column">
      <Form fields={fields} onCancel={close} onSubmit={() => (onPick(name.trim() ? customModel(engine, name) : model), close())} />
      {result ? <Text>{result}</Text> : null}
    </Box>
  )
}
