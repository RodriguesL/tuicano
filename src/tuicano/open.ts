// What `--open` means (spec §5, P6): the plugin opens a pane already looking at
// something. Pure, so the resolution is tested instead of discovered by hand.
import { channelList, conversationTitle, type State, type View } from '../app/store'

/** A view, or an agent whose DM has to be opened (which is an action, not a view). */
export type Opening = { kind: 'view'; view: View } | { kind: 'dm'; agentId: string }

const VIEWS: View['kind'][] = ['approvals', 'usage', 'connectors', 'memory', 'routines', 'skills', 'report', 'settings', 'new-agent', 'tuca']

export function resolveOpen(state: State, spec: string | undefined): Opening | undefined {
  const want = spec?.trim()
  if (!want) return undefined
  // A view by name.
  const byName = VIEWS.find((v) => v === want)
  if (byName) return { kind: 'view', view: { kind: byName } as View }
  // An agent by handle, id or name: its DM, the way the sidebar's agent rows work.
  // Case-insensitive, because a person types `@Lia`.
  const handle = want.replace(/^@/, '').toLowerCase()
  const agent = state.agents.find((a) => a.handle.toLowerCase() === handle || a.id === want || a.name.toLowerCase() === handle)
  if (agent) return { kind: 'dm', agentId: agent.id }
  // A channel by name, then any conversation by id, then by its DM title.
  const channel = channelList(state).find((c) => c.kind === 'channel' && c.name === want.replace(/^#/, ''))
  if (channel) return { kind: 'view', view: { kind: 'conversation', id: channel.id } }
  const byId = state.conversations.find((c) => c.id === want)
  if (byId) return { kind: 'view', view: { kind: 'conversation', id: byId.id } }
  const byTitle = state.conversations.find((c) => conversationTitle(state, c).toLowerCase() === want.toLowerCase())
  if (byTitle) return { kind: 'view', view: { kind: 'conversation', id: byTitle.id } }
  return undefined
}

/** What to tell someone whose `--open` matched nothing. */
export const opensNothing = (spec: string): string => `nothing matches "${spec}" — try a channel name, #channel, an @handle, or ${VIEWS.slice(0, 4).join(' / ')}`
