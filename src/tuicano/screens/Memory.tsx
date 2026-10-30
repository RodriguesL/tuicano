// Memory (spec §3.1 #29–34, view §3.3 #8): what the agents remember, and about
// whom. The scopes — about me, then each agent's own notes — read as tabs and the
// list carries each sentence with its state, where it came from and when. The GUI
// keeps the whole timeline visible (src/renderer/.../Memory.tsx); here history is a
// toggle (`h`) so the working set stays quiet, and a forgotten record is still there
// to purge.
import { useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { store } from '../store'
import { useOverlay, type ScreenProps } from '../overlays/api'
import { useTheme } from '../theme/context'
import { ago } from '../../shared/format'
import { Hint, List, type Row } from '../ui/kit'
import { Form, type FieldSpec } from '../ui/form'
import { isTeam, type Memory as MemoryRow, type MemoryScope } from '../../shared/types'

const origin = (m: MemoryRow): string => (m.origin === 'me' ? 'you wrote it' : m.origin === 'extraction' ? 'learned' : 'an agent')

export function Memory({ state, active }: ScreenProps): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const [scopeAt, setScopeAt] = useState(0)
  const [cursor, setCursor] = useState(0)
  const [history, setHistory] = useState(false)

  // `me` first, then one tab per non-archived agent: a person can read what each
  // one remembers (spec §3.3 #8).
  const scopes = [{ id: 'me', label: 'About you' }, ...state.agents.filter(isTeam).map((a) => ({ id: a.id, label: `${a.name}'s notes` }))]
  const scope = scopes[Math.min(scopeAt, scopes.length - 1)]!
  const memories = state.memories.filter((m) => m.scope === scope.id && (history || (m.state !== 'archived' && m.state !== 'forgotten')))
  const at = Math.max(0, Math.min(cursor, memories.length - 1))
  const m = memories[at]

  const move = (n: number): void => {
    setScopeAt((i) => (i + n + scopes.length) % scopes.length)
    setCursor(0) // a new scope starts at its first memory
  }

  const add = (): void =>
    overlay.sheet({ title: 'New memory', render: (close) => <AddMemory scopes={scopes} initial={scope.id} close={close} /> })

  useInput(
    (input, key) => {
      if (key.rightArrow) return move(1)
      if (key.leftArrow) return move(-1)
      if (key.upArrow || input === 'k') return setCursor(Math.max(0, at - 1))
      if (key.downArrow || input === 'j') return setCursor(Math.min(memories.length - 1, at + 1))
      if (input === 'h') return setHistory((h) => !h)
      if (input === 'a') return add()
      if (!m) return
      if (input === 'e') return overlay.prompt({ title: 'Edit memory', label: 'Sentence', value: m.text, onSubmit: (text) => store.editMemory(m.id, text) })
      if (input === 'c') return store.confirmMemory(m.id)
      if (input === 'y' && m.state === 'pending') return store.decideMemory(m.id, true)
      if (input === 'x' && m.state === 'pending') return store.decideMemory(m.id, false)
      // A reason is optional, so an empty prompt answer forgets without one (spec §3.1 #33).
      if (input === 'f') return overlay.prompt({ title: 'Forget this', label: 'Reason (optional)', onSubmit: (reason) => store.forgetMemory(m.id, reason || undefined) })
      if (input === 'P' && m.state === 'forgotten')
        return overlay.confirm({ title: 'Delete this record for good?', detail: `${m.text} — the record that keeps it from being learned again is removed too.`, yes: 'delete', onYes: () => store.purgeMemory(m.id) })
    },
    { isActive: active }
  )

  const rows: Row[] = memories.map((mem) => {
    const dim = mem.state === 'archived' || mem.state === 'forgotten'
    return { key: mem.id, label: mem.text, hint: `${mem.state} · ${origin(mem)} · ${ago(mem.createdAt)}`, color: dim ? t.faint : undefined }
  })

  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>
        {`Memory · ${scope.label}`}
        {m?.state === 'pending' ? <Text color={t.warn}>{'  · waiting for you'}</Text> : null}
      </Text>
      <List rows={rows} cursor={at} active={active} empty={history ? 'Nothing remembered here.' : 'Nothing remembered here yet. Press a to teach it something.'} />
      {history ? <Text color={t.faint}>showing archived and forgotten ones</Text> : null}
      {active ? <Hint keys={[['←/→', 'scope'], ['a', 'add'], ['e', 'edit'], ['c', 'still true'], ['y/x', 'keep/drop'], ['f', 'forget'], ['P', 'purge'], ['h', 'history']]} /> : null}
    </Box>
  )
}

function AddMemory({ scopes, initial, close }: { scopes: { id: string; label: string }[]; initial: string; close: () => void }): ReactNode {
  const [scope, setScope] = useState(initial)
  const [text, setText] = useState('')
  const fields: FieldSpec[] = [
    { id: 'scope', label: 'Scope', kind: 'select', value: scope, options: scopes.map((s) => ({ value: s.id, label: s.label })), onChange: setScope },
    { id: 'text', label: 'What to remember', kind: 'lines', value: text, placeholder: 'e.g. prefers small pull requests', onChange: setText }
  ]
  return (
    <Form
      fields={fields}
      onCancel={close}
      onSubmit={() => {
        if (!text.trim()) return
        store.addMemory(scope as MemoryScope, text.trim())
        close()
      }}
    />
  )
}
