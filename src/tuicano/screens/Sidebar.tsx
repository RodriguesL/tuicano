// The sidebar (spec §3.4): the same rows the window draws, with a cursor the
// keyboard moves and the channel dialogs on single keys.
import { useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import type { State } from '../../app/store'
import { L } from '../../shared/lang'
import { store } from '../store'
import { openable, sidebarRows } from '../sidebar'
import { List } from '../ui/kit'
import { useOverlay } from '../overlays/api'
import { useTheme } from '../theme/context'

export function Sidebar({ state, active, width }: { state: State; active: boolean; width: number }): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const [cursor, setCursor] = useState(0)
  // Headings are drawn but never selected: the cursor walks the things you can open,
  // and the list renders with the same cursor index mapped back onto its own rows.
  const all = sidebarRows(state)
  const rows = openable(all)
  const at = Math.max(0, Math.min(cursor, rows.length - 1))
  const row = rows[at]
  const renderCursor = row ? all.findIndex((r) => r.key === row.key) : -1

  useInput(
    (input, key) => {
      if (key.upArrow || input === 'k') return setCursor(Math.max(0, at - 1))
      if (key.downArrow || input === 'j') return setCursor(Math.min(rows.length - 1, at + 1))
      if (!row) return
      if (key.return) {
        // An agent row opens its DM, as clicking it does in the window.
        if (row.view?.kind === 'agent') return void store.openDm(row.view.id)
        if (row.view) return store.navigate(row.view)
        return
      }
      if (row.view?.kind !== 'conversation') {
        // An agent's page, which the window opens from the conversation header.
        if (row.view?.kind === 'agent' && input === 'e') return store.navigate(row.view)
        return
      }
      const id = row.view.id
      const conversation = state.conversations.find((c) => c.id === id)
      if (input === 'R' && conversation?.kind === 'channel') return overlay.dialog({ kind: 'rename', id })
      if (input === 't' && conversation?.kind === 'channel') return overlay.dialog({ kind: 'topic', id })
      if (input === 'm' && conversation?.kind === 'channel') return overlay.dialog({ kind: 'members', id })
      if (input === 'd') {
        const name = conversation?.kind === 'channel' ? `#${conversation.name}` : L('esta conversa', 'this conversation')
        return overlay.confirm({ title: L(`Apagar ${name}?`, `Delete ${name}?`), detail: L('As mensagens e as rotinas dela vão junto. Não dá pra desfazer.', 'Its messages and routines go too. This cannot be undone.'), yes: L('apagar', 'delete'), onYes: () => store.deleteConversation(id) })
      }
      if (input === 'A' && conversation?.kind === 'dm') return overlay.dialog({ kind: 'archived' })
    },
    { isActive: active }
  )

  return (
    <Box flexDirection="column" width={width}>
      <Text bold color={t.heading}>
        {` ${state.settings.workspaceName || 'Tucano'}`}
      </Text>
      <List rows={all} cursor={Math.max(0, renderCursor)} active={active} empty={L('Nenhuma conversa ainda.', 'No conversations yet.')} />
    </Box>
  )
}

/** The workspace name, above the rows, drawn where there is room for it. */
export function Workspace({ name, width }: { name: string; width: number }): ReactNode {
  const t = useTheme()
  return <Text bold color={t.heading}>{` ${name}`.padEnd(width).slice(0, width)}</Text>
}
