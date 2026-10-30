// The sidebar's rows, built from the shared state (spec §3.3). Pure, so the
// keyboard cursor and the rendering cannot disagree about what row 4 is.
import { channelList, conversationTitle, pendingApprovals, type State, type View } from '../app/store'
import { L } from '../shared/lang'

export interface Row {
  key: string
  label: string
  hint?: string
  badge?: number | string
  color?: string
  /** A heading, not something to open. */
  heading?: boolean
  view?: View
}

// The screens of the parity matrix are all rows: the abstraction carries the 12
// views, and a screen that lands later simply has more to show.
export function sidebarRows(s: State): Row[] {
  const approvals = pendingApprovals(s).length
  const rows: Row[] = [{ key: 'head:nav', label: L('Workspace', 'Workspace'), heading: true }]
  rows.push({ key: 'nav:approvals', label: L('Aprovações', 'Approvals'), badge: approvals || undefined, color: approvals ? '?' : undefined, view: { kind: 'approvals' } })
  const nav: [string, View['kind'], string][] = [
    [L('Uso e limites', 'Usage and limits'), 'usage', 'u'],
    [L('Conectores', 'Connectors'), 'connectors', 'c'],
    [L('Memória', 'Memory'), 'memory', 'm'],
    [L('Rotinas', 'Routines'), 'routines', 'r'],
    ['Skills', 'skills', 'k'],
    [L('Boletim', 'Report'), 'report', 'b'],
    [L('Configurações', 'Settings'), 'settings', ',']
  ]
  for (const [label, kind, hint] of nav) rows.push({ key: `nav:${kind}`, label, hint, view: { kind } as View })
  // The views the window reaches from a button: making an agent, and the Tuca's
  // builder. Without these two rows the terminal could not reach them at all.
  rows.push({ key: 'nav:new-agent', label: L('Novo agente', 'New agent'), hint: 'g · blank', view: { kind: 'new-agent' } as View })
  rows.push({ key: 'nav:tuca', label: L('Tuca', 'Tuca'), hint: 't · builds agents', view: { kind: 'tuca' } as View })
  rows.push({ key: 'head:channels', label: L('Canais', 'Channels'), heading: true })
  for (const c of channelList(s)) {
    const dm = c.kind === 'dm'
    rows.push({
      key: `conv:${c.id}`,
      label: dm ? conversationTitle(s, c) : `#${c.name}`,
      hint: dm ? 'dm' : c.topic ? c.topic.slice(0, 24) : undefined,
      badge: c.unread || undefined,
      view: { kind: 'conversation', id: c.id }
    })
  }
  const agents = s.agents.filter((x) => !x.archived)
  if (agents.length) {
    rows.push({ key: 'head:agents', label: L('Agentes', 'Agents'), heading: true })
    for (const a of agents) rows.push({ key: `agent:${a.id}`, label: `@${a.handle}`, hint: `${a.role.slice(0, 20) || L('agente', 'agent')} · e = page`, color: a.color, view: { kind: 'agent', id: a.id } })
  }
  return rows
}

/** The rows that can be opened, in order, so a cursor index maps to something. */
export const openable = (rows: Row[]): Row[] => rows.filter((r) => !r.heading)
