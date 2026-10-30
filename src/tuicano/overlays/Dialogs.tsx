// The dialogs the GUI opens over the app (spec §3.3, §3.4 row 5): a channel's
// members, its name and topic, the archived agents, a new channel and search — the
// same state as the window (`openDialog`), drawn in the terminal's own frame.
//
// The host draws the frame; each body here draws itself, owns its keys and calls
// `close()` when it is done. Every mutation goes through a store action, and a core
// error lands where the person can see it: the form's `error`, or `overlay.note`.
import { useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import type { Dialog, State } from '../../app/store'
import type { AgentColor, Conversation, Message } from '../../shared/types'
import { isTeam } from '../../shared/types'
import { L } from '../../shared/lang'
import { conversationTitle, useAppState, store } from '../store'
import { useOverlay } from './api'
import { agentColor, useTheme } from '../theme/context'
import { CURSOR, Hint } from '../ui/kit'
import { Form } from '../ui/form'

// The core's message, without the RPC wrapper the GUI also strips (Dialogs.tsx).
const reason = (e: unknown): string => (e instanceof Error ? e.message.replace(/^Error invoking.*?: /, '') : String(e))

export function Dialogs({ dialog, close }: { dialog: Dialog; close: () => void }): ReactNode {
  switch (dialog.kind) {
    case 'members':
      return <Members id={dialog.id} close={close} />
    case 'rename':
      return <Rename id={dialog.id} close={close} />
    case 'topic':
      return <Topic id={dialog.id} close={close} />
    case 'new-channel':
      return <NewChannel close={close} />
    case 'archived':
      return <Archived close={close} />
    case 'search':
      return <Search close={close} />
  }
}

// ---------- members (spec §3.1 #12) ----------

function Members({ id, close }: { id: string; close: () => void }): ReactNode {
  const t = useTheme()
  const state = useAppState()
  const overlay = useOverlay()
  const conversation = state.conversations.find((c) => c.id === id)
  // The current members first, so the list reads as "who is in": the same team
  // filter the GUI uses (archived and the Tuca are not teammates).
  const team = state.agents.filter(isTeam)
  const ordered = [...team].sort(
    (a, b) => Number(conversation?.members.includes(b.id) ?? false) - Number(conversation?.members.includes(a.id) ?? false)
  )
  const [picked, setPicked] = useState<string[]>(() => conversation?.members ?? [])
  const [cursor, setCursor] = useState(0)
  const at = Math.max(0, Math.min(cursor, ordered.length - 1))

  useInput((input, key) => {
    if (key.escape) return close() // the host frame does not own Esc for dialogs
    if (key.upArrow || input === 'k') return setCursor(Math.max(0, at - 1))
    if (key.downArrow || input === 'j') return setCursor(Math.min(ordered.length - 1, at + 1))
    const agent = ordered[at]
    if (!agent) return
    if (input === ' ' || input === 'x') {
      return setPicked((p) => (p.includes(agent.id) ? p.filter((x) => x !== agent.id) : [...p, agent.id]))
    }
    if (key.return) store.setChannelMembers(id, picked).then(close, (e: unknown) => overlay.note(reason(e)))
  })

  if (!conversation) return <Text color={t.faint}>{L('Este canal sumiu.', 'This channel is gone.')}</Text>
  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{L(`Agentes em #${conversation.name}`, `Agents in #${conversation.name}`)}</Text>
      <Text color={t.dim}>{L('Quem está no canal lê a conversa e pode responder. Espaço alterna, Enter salva.', 'Whoever is in reads the conversation and can reply. Space toggles, Enter saves.')}</Text>
      {ordered.length === 0 ? <Text color={t.faint}>{L('Nenhum agente ainda.', 'No agents yet.')}</Text> : null}
      {ordered.map((a, i) => {
        const on = picked.includes(a.id)
        const selected = i === at
        return (
          <Text key={a.id} inverse={selected} color={agentColor(t, a.color)}>
            {`${selected ? CURSOR : ' '} [${on ? 'x' : ' '}] ${a.name}`}
            <Text color={t.faint}>{`  @${a.handle}${a.role ? ` · ${a.role}` : ''}`}</Text>
          </Text>
        )
      })}
      <Hint keys={[['space', 'toggle'], ['enter', 'save'], ['esc', 'cancel']]} />
    </Box>
  )
}

// ---------- rename / topic (spec §3.1 #9, #11) ----------

function Rename({ id, close }: { id: string; close: () => void }): ReactNode {
  const t = useTheme()
  const conversation = useAppState().conversations.find((c) => c.id === id)
  const [name, setName] = useState(() => conversation?.name ?? '')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  if (!conversation) return <Text color={t.faint}>{L('Este canal sumiu.', 'This channel is gone.')}</Text>
  return (
    <Form
      title={L(`Renomear #${conversation.name}`, `Rename #${conversation.name}`)}
      fields={[{ id: 'name', label: L('Nome', 'Name'), kind: 'text', value: name, onChange: setName, hint: L('minúsculas e hífens: “Lançamento do App” vira lancamento-do-app.', 'lowercase and hyphens: “App Launch” becomes app-launch.') }]}
      error={error}
      busy={busy}
      submitLabel="Enter"
      onCancel={close}
      onSubmit={async () => {
        setBusy(true)
        setError(undefined)
        try {
          await store.renameChannel(id, name)
          close()
        } catch (e) {
          // The point of this dialog: a taken name comes back as the core's message.
          setError(reason(e))
          setBusy(false)
        }
      }}
    />
  )
}

function Topic({ id, close }: { id: string; close: () => void }): ReactNode {
  const t = useTheme()
  const conversation = useAppState().conversations.find((c) => c.id === id)
  const [topic, setTopic] = useState(() => conversation?.topic ?? '')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  if (!conversation) return <Text color={t.faint}>{L('Este canal sumiu.', 'This channel is gone.')}</Text>
  return (
    <Form
      title={L(`Tema de #${conversation.name}`, `Topic of #${conversation.name}`)}
      fields={[{ id: 'topic', label: L('Tema', 'Topic'), kind: 'text', value: topic, onChange: setTopic, hint: L('Uma linha no topo do canal. Vazio, some.', 'One line at the top of the channel. Empty clears it.') }]}
      error={error}
      busy={busy}
      submitLabel="Enter"
      onCancel={close}
      onSubmit={async () => {
        setBusy(true)
        setError(undefined)
        try {
          await store.setTopic(id, topic) // an empty string clears it
          close()
        } catch (e) {
          setError(reason(e))
          setBusy(false)
        }
      }}
    />
  )
}

// ---------- new channel (spec §3.1 #8) ----------

function NewChannel({ close }: { close: () => void }): ReactNode {
  const overlay = useOverlay()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  return (
    <Form
      title={L('Novo canal', 'New channel')}
      fields={[{ id: 'name', label: L('Nome', 'Name'), kind: 'text', value: name, onChange: setName, hint: L('minúsculas e hífens: “Squad Pagamentos” vira squad-pagamentos.', 'lowercase and hyphens: “Payments Squad” becomes payments-squad.') }]}
      error={error}
      busy={busy}
      submitLabel="Enter"
      onCancel={close}
      onSubmit={async () => {
        setBusy(true)
        setError(undefined)
        try {
          // `newChannel` is the raw create returning the id; the core rejects a
          // duplicate or empty name, which is shown right here.
          const id = await store.newChannel(name)
          store.navigate({ kind: 'conversation', id })
          // What the window does next: open the members dialog for the new channel.
          // That replaces this overlay, so there is nothing left to `close()`.
          overlay.dialog({ kind: 'members', id })
        } catch (e) {
          setError(reason(e))
          setBusy(false)
        }
      }}
    />
  )
}

// ---------- archived (spec §3.1 #10) ----------

function Archived({ close }: { close: () => void }): ReactNode {
  const t = useTheme()
  const state = useAppState()
  const overlay = useOverlay()
  const agents = state.agents.filter((a) => a.archived)
  const [cursor, setCursor] = useState(0)
  const at = Math.max(0, Math.min(cursor, agents.length - 1))

  useInput((input, key) => {
    if (key.escape) return close()
    if (key.upArrow || input === 'k') return setCursor(Math.max(0, at - 1))
    if (key.downArrow || input === 'j') return setCursor(Math.min(agents.length - 1, at + 1))
    const agent = agents[at]
    if (!agent) return
    if (key.return) return void store.archiveAgent(agent.id, false).then(() => overlay.note(L(`${agent.name} voltou`, `${agent.name} is back`)), (e: unknown) => overlay.note(reason(e)))
    if (input === 'n') {
      store.navigate({ kind: 'agent', id: agent.id })
      close()
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{L(`Agentes arquivados (${agents.length})`, `Archived agents (${agents.length})`)}</Text>
      <Text color={t.dim}>{L('Eles não respondem nem rodam rotinas; o histórico e os recibos ficam. Enter traz um de volta.', 'They don’t reply or run routines; history and receipts stay. Enter brings one back.')}</Text>
      {agents.length === 0 ? <Text color={t.faint}>{L('Nenhum agente arquivado.', 'No archived agents.')}</Text> : null}
      {agents.map((a, i) => {
        const selected = i === at
        return (
          <Text key={a.id} inverse={selected} color={agentColor(t, a.color)}>
            {`${selected ? CURSOR : ' '} ${a.name}`}
            <Text color={t.faint}>{`  @${a.handle}${a.role ? ` · ${a.role}` : ''}`}</Text>
          </Text>
        )
      })}
      <Hint keys={[['enter', 'bring back'], ['n', 'open the page'], ['esc', 'cancel']]} />
    </Box>
  )
}

// ---------- search (spec §3.4 row 5, GUI Search) ----------

interface Hit {
  key: string
  group: string
  label: string
  context: string
  color?: AgentColor
  go: () => void
}

const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const who = (state: State, m: Message): string => {
  if (m.author.kind === 'agent') {
    const id = m.author.id
    return state.agents.find((a) => a.id === id)?.name ?? L('agente', 'agent')
  }
  return m.author.kind === 'me' ? L('você', 'you') : m.author.kind
}

// Channels keep their `#`; a DM reads as the agent's name (spec §3.4).
const titleOf = (state: State, c: Conversation): string => (c.kind === 'channel' ? `#${c.name}` : conversationTitle(state, c))

// The live filter: conversations, agents and message text, grouped by kind. Pure,
// so what is drawn and what Enter opens cannot disagree.
function hits(state: State, query: string): { rows: Hit[]; more: number } {
  const rows: Hit[] = []
  for (const c of state.conversations) {
    const title = titleOf(state, c)
    if (!fold(`${title} ${c.topic ?? ''}`).includes(query)) continue
    rows.push({ key: `conv-${c.id}`, group: L('Conversas', 'Conversations'), label: title, context: c.topic ?? (c.kind === 'channel' ? L('canal', 'channel') : L('conversa', 'conversation')), go: () => store.navigate({ kind: 'conversation', id: c.id }) })
  }
  for (const a of state.agents.filter((x) => !x.archived)) {
    if (!fold(`${a.name} ${a.handle} ${a.role}`).includes(query)) continue
    rows.push({ key: `agent-${a.id}`, group: L('Agentes', 'Agents'), label: a.name, context: `@${a.handle}${a.role ? ` · ${a.role}` : ''}`, color: a.color, go: () => void store.openDm(a.id) })
  }
  const matched = state.messages.filter((m) => fold(m.text).includes(query))
  const CAP = 20
  for (const m of matched.slice(0, CAP)) {
    const conv = state.conversations.find((c) => c.id === m.conversationId)
    rows.push({ key: `msg-${m.id}`, group: L('Mensagens', 'Messages'), label: m.text.trim().replace(/\s+/g, ' ').slice(0, 60), context: `${who(state, m)} ${L('em', 'in')} ${conv ? titleOf(state, conv) : L('uma conversa', 'a conversation')}`, go: () => store.navigate({ kind: 'conversation', id: m.conversationId }) })
  }
  return { rows, more: Math.max(0, matched.length - CAP) }
}

function Search({ close }: { close: () => void }): ReactNode {
  const t = useTheme()
  const state = useAppState()
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const query = fold(q.trim().replace(/^[#@]/, ''))
  const { rows, more } = query ? hits(state, query) : { rows: [], more: 0 }
  const at = Math.max(0, Math.min(cursor, rows.length - 1))

  useInput((input, key) => {
    if (key.escape) return close()
    if (key.upArrow) return setCursor(Math.max(0, at - 1))
    if (key.downArrow) return setCursor(Math.min(rows.length - 1, at + 1))
    if (key.return) {
      const hit = rows[at]
      if (hit) {
        close()
        hit.go()
      }
      return
    }
    if (key.backspace || key.delete) {
      // Backspace on an empty field closes, as Esc does.
      return q ? setQ(q.slice(0, -1)) : close()
    }
    if (input && !key.ctrl && !key.meta) return setQ(q + input)
  })

  // The groups are drawn with a heading each, as the window groups its hits.
  const body: ReactNode[] = []
  let group = ''
  rows.forEach((hit, i) => {
    if (hit.group !== group) {
      group = hit.group
      body.push(
        <Text key={`head-${group}`} bold color={t.heading}>
          {group}
        </Text>
      )
    }
    const selected = i === at
    body.push(
      <Text key={hit.key} inverse={selected} color={hit.color ? agentColor(t, hit.color) : selected ? t.text : t.dim}>
        {`${selected ? CURSOR : ' '} ${hit.label}`}
        <Text color={t.faint}>{`  ${hit.context}`}</Text>
      </Text>
    )
  })

  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{L('Buscar', 'Search')}</Text>
      <Text color={t.text}>
        <Text color={t.accent}>{'/ '}</Text>
        {q || <Text color={t.faint}>{L('digite para filtrar canais, agentes e mensagens', 'type to filter channels, agents and messages')}</Text>}
      </Text>
      {query && rows.length === 0 ? <Text color={t.faint}>{L(`Nada com “${q}”.`, `Nothing matching “${q}”.`)}</Text> : null}
      {body}
      {more > 0 ? <Text color={t.faint}>{L(`+${more} mensagem${more === 1 ? '' : 's'} (restrinja a busca)`, `+${more} more message${more === 1 ? '' : 's'} (narrow the search)`)}</Text> : null}
      <Hint keys={[['↑↓', 'move'], ['enter', 'open'], ['esc', 'close']]} />
    </Box>
  )
}
