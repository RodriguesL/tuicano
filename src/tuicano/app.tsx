// TUIcano's root: layout, cursor, keymap and the screen registry (spec §1.4).
// One input handler for the whole client — with a sidebar, a pane, a composer
// and overlays, there has to be exactly one place that decides what a key means.
// Screens stay presentational and app.tsx passes them the cursor.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Box, Text, useApp, useInput, useWindowSize } from 'ink'
import { useEffect, useState, type ReactNode } from 'react'
import { APPROVAL_KEYS, CONVERSATION_KEYS, GLOBAL_KEYS, LATER_KEYS } from './keys'
import { gateIntent, type GateKey } from './approvals'
import { runtime } from './runtime'
import { sidebarRows } from './sidebar'
import { browserOf, store, unreadTotal, useAppState, type State } from './store'
import { Approvals } from './screens/Approvals'
import { Conversation } from './screens/Conversation'
import { Placeholder } from './screens/Placeholder'
import { Sidebar } from './screens/Sidebar'
import { ImageOverlay } from './graphics/viewer'
import { mimeOfName, pictureOfDataUrl, prepare, protocolLabel, type Prepared } from './graphics/transport'
import type { Approval } from '../shared/types'

const HELP_MS = 3_000

export function TuiApp(): ReactNode {
  const state = useAppState()
  const { exit } = useApp()
  // The pane's real size, not an assumed one: a multiplexer splits whatever the
  // terminal has, and a resize has to move the layout with it (spec §3).
  const { columns: winCols, rows: winRows } = useWindowSize()
  const [focus, setFocus] = useState<'sidebar' | 'pane'>('sidebar')
  const [row, setRow] = useState(0)
  const [inConversation, setInConversation] = useState(0)
  const [draft, setDraft] = useState<string | null>(null)
  const [reason, setReason] = useState<{ id: string; text: string } | null>(null)
  const [armed, setArmed] = useState<{ id: string; at: number } | null>(null)
  const [image, setImage] = useState<Prepared | null>(null)
  const [help, setHelp] = useState(false)
  const [note, setNote] = useState<string | undefined>()

  const rows = sidebarRows(state)
  const view = state.view ?? { kind: 'new-agent' as const }
  const conversation = view.kind === 'conversation' ? view.id : undefined
  const messages = conversation ? state.messages.filter((m) => m.conversationId === conversation) : []
  const pending = state.approvals.filter((a) => a.state === 'pending')

  // The lists can shrink under the cursor (a run finishes, an approval is decided).
  useEffect(() => {
    setRow((r) => Math.min(r, Math.max(0, rows.length - 1)))
  }, [rows.length])
  useEffect(() => {
    setInConversation((c) => Math.min(c, Math.max(0, messages.length - 1)))
  }, [messages.length])
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(undefined), HELP_MS)
    return () => clearTimeout(t)
  }, [note])

  // The approval under the cursor: in the Approvals screen it is that list, in a
  // conversation it is the selected reply's own request (spec §3.1 #28).
  const approvalUnderCursor = ((): Approval | undefined => {
    if (view.kind === 'approvals') return pending[Math.min(row, Math.max(0, pending.length - 1))]
    const m = messages[inConversation]
    return m?.run?.approvalId ? pending.find((a) => a.id === m.run!.approvalId) : undefined
  })()

  const decide = (a: Approval, decision: 'approved' | 'refused', why?: string, always?: boolean): void => {
    store.decideApproval(a.id, decision, why, always)
    setNote(`${decision === 'approved' ? 'approved' : 'refused'}: ${a.tool}`)
  }

  // The gate itself is in approvals.ts, where it is tested: a keypress on a
  // high-risk call must not approve it on its own (spec §3.1 #28).
  const approvalKey = (a: Approval, key: GateKey): void => {
    const intent = gateIntent(key, a, armed?.id === a.id ? armed.at : undefined, Date.now())
    if (intent.kind === 'arm') {
      setArmed({ id: a.id, at: Date.now() })
      setNote('high risk: press the same key again within 3 s to confirm')
      return
    }
    setArmed(null)
    if (intent.kind === 'ask-reason') return setReason({ id: a.id, text: '' })
    decide(a, 'approved', undefined, intent.always)
  }

  const picture = (): Prepared | null => {
    const m = messages[inConversation]
    if (!m) return null
    // A live frame of the agent's browser, when this reply used it (spec §2.1).
    const frame = m.run?.browser && m.author.kind === 'agent' ? browserOf(state, m.author.id)?.frame : undefined
    const fromFrame = frame ? pictureOfDataUrl(frame) : null
    if (fromFrame) return prepare(fromFrame.bytes, fromFrame.mime, runtime.protocol)
    for (const id of m.run?.artifactIds ?? []) {
      const a = state.artifacts.find((x) => x.id === id)
      const mime = a ? mimeOfName(a.name) : undefined
      if (!a || !mime) continue
      try {
        return prepare(new Uint8Array(readFileSync(join(runtime.dataDir, 'artifacts', a.id, a.name))), mime, runtime.protocol)
      } catch {
        return null
      }
    }
    return null
  }

  const open = (): void => {
    if (focus === 'sidebar') {
      const r = rows[row]
      if (!r) return
      if (r.view.kind === 'agent') {
        // An agent row opens its DM, as clicking it does in the app.
        void store.openDm(r.view.id)
        return
      }
      store.navigate(r.view)
      setFocus('pane')
      return
    }
    const p = picture()
    if (p) setImage(p)
    else setNote('nothing to show here')
  }

  const main = ((): ReactNode => {
    if (view.kind === 'conversation' && conversation) return <Conversation state={state} id={conversation} cursor={inConversation} focused={focus === 'pane'} />
    if (view.kind === 'approvals') return <Approvals state={state} cursor={row} armed={armed?.id} />
    return <Placeholder kind={view.kind} state={state} />
  })()

  useInput((input, key) => {
    if (key.ctrl && input === 'c') return exit()
    // Overlays first: anything closes them.
    if (image) return setImage(null)
    if (help) return setHelp(false)
    if (reason) {
      if (key.escape) return setReason(null)
      const a = pending.find((x) => x.id === reason.id)
      if (key.return) {
        setReason(null)
        if (a) decide(a, 'refused', reason.text.trim() || undefined)
        return
      }
      if (key.backspace || key.delete) return setReason({ ...reason, text: reason.text.slice(0, -1) })
      if (input && !key.ctrl && !key.meta) return setReason({ ...reason, text: reason.text + input })
      return
    }
    if (draft !== null) {
      if (key.escape) return setDraft(null)
      if (key.return) {
        const text = draft
        setDraft(null)
        if (conversation && text.trim()) store.sendMessage(conversation, text)
        return
      }
      if (key.backspace || key.delete) return setDraft(draft.slice(0, -1))
      if (input && !key.ctrl && !key.meta) return setDraft(draft + input)
      return
    }

    const move = (d: number): void => (focus === 'sidebar' ? setRow((r) => Math.max(0, Math.min(rows.length - 1, r + d))) : setInConversation((c) => Math.max(0, Math.min(messages.length - 1, c + d))))

    if (key.upArrow || input === 'k') return move(-1)
    if (key.downArrow || input === 'j') return move(1)
    if (key.tab) return setFocus((f) => (f === 'sidebar' ? 'pane' : 'sidebar'))
    if (key.return) return open()
    if (key.escape) return setFocus('sidebar')
    if (input === 'q') return exit()
    if (input === '?') return setHelp(true)
    if (input === 'a') return store.navigate({ kind: 'approvals' })
    if (input === 'i' && conversation) return setDraft('')
    if (/^[1-9]$/.test(input)) {
      const channels = state.conversations.filter((c) => c.kind === 'channel')
      const target = channels[Number(input) - 1]
      if (target) store.navigate({ kind: 'conversation', id: target.id })
      return
    }
    if ((input === 'y' || input === 'Y' || input === 'x') && approvalUnderCursor) return approvalKey(approvalUnderCursor, input)
    const m = messages[inConversation]
    if (!m?.run) return
    if (input === 's' && m.run.status === 'working') return store.stopRun(m.id)
    if (input === 'r') return store.retryRun(m.id)
    if (input === 'C' && m.run.status === 'paused') return store.continueRun(m.id)
    if (input === 'v') {
      const p = picture()
      return p ? setImage(p) : setNote('this message has no image')
    }
    if (input === 'o') {
      const artifact = (m.run.artifactIds ?? []).map((id) => state.artifacts.find((a) => a.id === id)).find((a) => a?.source?.startsWith('http'))
      const url = artifact?.source ?? /https?:\/\/\S+/.exec(m.text)?.[0]
      return url ? store.openExternal(url) : setNote('no link here')
    }
  })

  const status = ((): string => {
    if (note) return note
    if (draft !== null) return `> ${draft}`
    if (reason) return `reason to refuse (Enter refuses, Esc cancels): ${reason.text}`
    return `${protocolLabel(runtime.protocol)} ${runtime.cell.pxW}x${runtime.cell.pxH}px · ${unreadTotal(state)} unread · ${focus} · ? help`
  })()

  if (image) return <ImageOverlay prepared={image} cell={runtime.cell} />

  return (
    <Box flexDirection="column" height={Math.max(3, winRows)}>
      <Box flexGrow={1}>
        <Sidebar rows={rows} cursor={row} focused={focus === 'sidebar'} width={Math.max(12, Math.min(30, Math.floor(winCols / 3)))} workspace={state.settings.workspaceName || 'Tucano'} />
        <Box flexDirection="column" flexGrow={1} paddingLeft={1} overflow="hidden">
          {main}
        </Box>
      </Box>
      {help ? (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan">
          <Text bold>TUIcano — keys</Text>
          {GLOBAL_KEYS.map((k) => (
            <Text key={k.keys}>{`  ${k.keys.padEnd(16)} ${k.what}`}</Text>
          ))}
          {CONVERSATION_KEYS.map((k) => (
            <Text key={k.keys}>{`  ${k.keys.padEnd(16)} ${k.what}`}</Text>
          ))}
          {APPROVAL_KEYS.map((k) => (
            <Text key={k.keys}>{`  ${k.keys.padEnd(16)} ${k.what}`}</Text>
          ))}
          <Text dimColor>later phases:</Text>
          {LATER_KEYS.map((k) => (
            <Text key={k.keys} dimColor>{`  ${k.keys.padEnd(16)} ${k.what}`}</Text>
          ))}
        </Box>
      ) : null}
      <Text inverse>{status}</Text>
    </Box>
  )
}
