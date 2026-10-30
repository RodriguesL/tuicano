// The screen tour (spec §5): every view is reachable from the keyboard, and the route
// is the *status line*, which prints the view it is showing. That is the marker on
// purpose: it cannot be satisfied by a sidebar label that appears on every screen
// (which is how an earlier ad-hoc tour reported 19/23 and proved nothing), and it does
// not depend on the language or the wording a screen happens to use.
//
// The pty version of the same tour — which also exercises raw mode, the alternate
// screen and the real graphics path — is scripts/tour-tui.py.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KEY, agent, channel, dm, message, mount, stateOf } from './helpers/screen'
import { TuiApp } from '../src/tuicano/app'
import { store } from '../src/tuicano/store'
import { sidebarRows } from '../src/tuicano/sidebar'
import { client } from '../src/tuicano/client'

/** The view the client is showing, as the status line names it. */
const showing = (frame: string): string => /· (\S+) · (sidebar|pane) ·/.exec(frame)?.[1] ?? '?'

const seeded = () =>
  stateOf(
    { type: 'agent', agent: agent({ id: 'a1', handle: 'lia', name: 'Lia' }) },
    { type: 'conversation', conversation: channel({ id: 'c1', name: 'geral', members: ['a1'] }) },
    { type: 'conversation', conversation: dm({ id: 'd1', name: 'a1' }) },
    { type: 'message', message: message({ id: 'm1', conversationId: 'c1', text: 'ola' }) }
  )

beforeEach(() => {
  vi.spyOn(client, 'call').mockResolvedValue(undefined as never)
  // The store is one instance for the client, so the tour seeds it through the same
  // events the core would send.
  const state = seeded()
  for (const c of state.conversations) store.dispatch({ type: 'conversation', conversation: c })
  for (const a of state.agents) store.dispatch({ type: 'agent', agent: a })
  store.navigate({ kind: 'conversation', id: 'c1' })
})
afterEach(() => vi.restoreAllMocks())

/** How many rows down the agent's row is, asked of the sidebar itself. */
const downsToAgent = (): number => {
  const state = store.getState()
  const rows = sidebarRows(state).filter((r) => !r.heading)
  return Math.max(0, rows.findIndex((r) => r.view?.kind === 'agent'))
}

describe('the tour: every view from the keyboard', () => {
  it('reaches all twelve views, and the status line says which one', async () => {
    const m = mount(() => <TuiApp />)
    const jump: [string, string[]][] = [
      ['conversation', []],
      ['approvals', ['a']],
      ['usage', ['u']],
      ['connectors', ['c']],
      ['memory', ['m']],
      ['routines', ['r']],
      ['skills', ['k']],
      ['report', ['b']],
      ['settings', [',']],
      ['new-agent', ['g']],
      ['tuca', ['t']]
    ]
    for (const [view, keys] of jump) {
      await m.press(...keys)
      expect(showing(m.frame()), `${view} via ${keys.join('') || 'the default'}`).toBe(view)
    }
    // The last view the sidebar cannot reach with one key: an agent's page, from the
    // agent row in the sidebar (Enter opens its DM, `e` opens the page).
    for (let i = 0; i < downsToAgent(); i++) await m.press(KEY.down)
    await m.press('e')
    expect(showing(m.frame())).toBe('agent')
    await m.unmount()
  })
})

describe('the tour: the overlays and the chrome', () => {
  // Markers here are structural on purpose: a key *label* (never translated), a theme
  // *name*, and the double border the overlay host draws around every modal. Wording
  // belongs to the screens' own tests, which pin a language.
  const OVERLAY_FRAME = '╔' // the host's double border: every modal
  const HELP_FRAME = 'docs/spec-tuicano.md' // the help's own footer, unique to it

  it('opens the help, the themes, the search, a new channel and the composer', async () => {
    const m = mount(() => <TuiApp />)
    await m.press('?')
    expect(m.frame()).toContain(HELP_FRAME)
    await m.press('x') // any key closes it
    expect(m.frame()).not.toContain(HELP_FRAME)
    await m.press('\x14') // Ctrl+T: the theme picker
    expect(m.frame()).toContain(OVERLAY_FRAME)
    await m.press(KEY.esc)
    expect(m.frame()).not.toContain(OVERLAY_FRAME)
    await m.press('/') // search
    expect(m.frame()).toContain(OVERLAY_FRAME)
    await m.press(KEY.esc)
    await m.press('n') // a new channel
    expect(m.frame()).toContain(OVERLAY_FRAME)
    await m.press(KEY.esc)
    await m.press('i') // the composer belongs to the sidebar layer, in a conversation
    await m.type('ola')
    expect(m.frame()).toContain('> ola')
    await m.unmount()
  })

  it('keeps the composer out of a screen that is not a conversation', async () => {
    const m = mount(() => <TuiApp />)
    await m.press('u') // usage
    await m.press('i')
    expect(m.frame()).not.toContain('> ')
    await m.unmount()
  })
})
