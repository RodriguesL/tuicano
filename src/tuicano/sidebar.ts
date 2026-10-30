// The sidebar's rows, built from the shared state (spec §3.3). Pure, so the
// keyboard cursor and the rendering cannot disagree about what row 4 is.
import { channelList, conversationTitle, pendingApprovals, type State, type View } from '../app/store'

export interface Row {
  key: string
  label: string
  badge?: number
  view: View
}

// The screens of the parity matrix that land in a later phase are still rows:
// the abstraction carries all 12 views, and the placeholder screen says which
// phase draws it.
export function sidebarRows(s: State): Row[] {
  const approvals = pendingApprovals(s).length
  const rows: Row[] = [{ key: 'nav:approvals', label: 'Approvals', badge: approvals || undefined, view: { kind: 'approvals' } }]
  const nav: [string, View['kind']][] = [
    ['Usage', 'usage'],
    ['Connectors', 'connectors'],
    ['Memory', 'memory'],
    ['Routines', 'routines'],
    ['Skills', 'skills'],
    ['Report', 'report'],
    ['Settings', 'settings']
  ]
  for (const [label, kind] of nav) rows.push({ key: `nav:${kind}`, label, view: { kind } as View })
  for (const c of channelList(s)) {
    rows.push({
      key: `conv:${c.id}`,
      label: c.kind === 'channel' ? `#${c.name}` : conversationTitle(s, c),
      badge: c.unread || undefined,
      view: { kind: 'conversation', id: c.id }
    })
  }
  for (const a of s.agents.filter((x) => !x.archived)) rows.push({ key: `agent:${a.id}`, label: a.name || a.handle, view: { kind: 'agent', id: a.id } })
  return rows
}

// The conversation on screen, when the view is one.
export function openConversation(s: State): string | undefined {
  return s.view?.kind === 'conversation' ? s.view.id : undefined
}
