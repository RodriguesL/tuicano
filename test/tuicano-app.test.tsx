// The router (spec §2.8): which layer owns a keypress. This is the file that broke
// silently once — the app's letters fired while a screen was focused, so a screen's
// own `a`/`n`/`i` did two things at once, and Ctrl+T (a raw control character in a
// real terminal) never reached its binding at all.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KEY, channel, mount } from './helpers/screen'
import { TuiApp } from '../src/tuicano/app'
import { store } from '../src/tuicano/store'
import { client } from '../src/tuicano/client'

// The client has one store, so a test resets the screen it starts on; and a screen
// under the router may ask the core for something on mount, which in a test has no
// answer — so the call is stubbed rather than left to reject in the background.
beforeEach(() => {
  vi.spyOn(client, 'call').mockResolvedValue(undefined as never)
  store.navigate({ kind: 'memory' })
})
afterEach(() => vi.restoreAllMocks())

describe('the router', () => {
  it('opens the theme picker on Ctrl+T, as a terminal actually delivers it', async () => {
    const m = mount(() => <TuiApp />)
    await m.press('\x14') // what a pty sends for Ctrl+T
    expect(m.frame()).toContain('Enter picks')
    await m.unmount()
  })

  it('opens search on / while the sidebar has the cursor', async () => {
    const m = mount(() => <TuiApp />)
    await m.press('/')
    expect(m.frame()).toContain('Search')
    await m.unmount()
  })

  it("keeps its letters in the sidebar: with the pane focused, `a` is the screen's", async () => {
    const navigate = vi.spyOn(store, 'navigate')
    // Pane focused: the screen's `a` (add a memory) runs — its prompt is on screen —
    // and the app's does not. (The app provides its own overlay api, so the frame is
    // the evidence here, not the test's spy.)
    const pane = mount(() => <TuiApp />)
    await pane.press(KEY.tab)
    await pane.press('a')
    expect(pane.frame()).toContain('New memory')
    expect(navigate).not.toHaveBeenCalledWith({ kind: 'approvals' })
    pane.unmount()
    // Sidebar focused: the same key is the app's, and it navigates.
    const side = mount(() => <TuiApp />)
    await side.press('a')
    expect(navigate).toHaveBeenCalledWith({ kind: 'approvals' })
    side.unmount()
    navigate.mockRestore()
  })

  it('focuses the pane on Tab, and the sidebar on Shift+Tab, whatever arrives twice', async () => {
    const m = mount(() => <TuiApp />)
    await m.press(KEY.tab, KEY.tab) // twice in a row: it must not cancel itself
    expect(m.frame()).toContain('· pane ·')
    await m.press(KEY.backtab)
    expect(m.frame()).toContain('· sidebar ·')
    await m.unmount()
  })

  it('opens the help on ? and closes it on any key', async () => {
    // Structural markers, not copy: the help is the host's round-bordered panel and the
    // screen behind it (memory) draws none, so the border is what tells it is up. Copy
    // would tie this to the language the test happens to run in.
    const m = mount(() => <TuiApp />)
    await m.press('?')
    expect(m.frame()).toContain('╭')
    await m.press('x')
    expect(m.frame()).not.toContain('╭')
    await m.unmount()
  })

  it('lets you write from the pane, not only from the sidebar', async () => {
    store.navigate({ kind: 'conversation', id: 'c1' })
    const m = mount(() => <TuiApp />)
    await m.press(KEY.tab) // the pane has the cursor: the conversation is where you read
    await m.press('i')
    await m.type('hello')
    expect(m.frame()).toContain('> hello')
    await m.unmount()
  })

  it('has one key that goes back a screen, from anywhere', async () => {
    store.navigate({ kind: 'conversation', id: 'c1' })
    const m = mount(() => <TuiApp />)
    await m.press('u') // usage, from the conversation
    expect(store.getState().view).toEqual({ kind: 'usage' })
    await m.press(KEY.backspace)
    expect(store.getState().view).toEqual({ kind: 'conversation', id: 'c1' })
    await m.unmount()
  })

  it('opens search from the pane too', async () => {
    const m = mount(() => <TuiApp />)
    await m.press(KEY.tab)
    await m.press('/')
    expect(m.frame()).toContain('╔')
    await m.unmount()
  })

  it('numbers the channels the way 1-9 jumps to them', async () => {
    // Two channels whose insertion order is not their name order: the sidebar sorts by
    // name, so the key has to jump by the same order or the number lies.
    store.dispatch({ type: 'conversation', conversation: channel({ id: 'zebra', name: 'zebra' }) })
    store.dispatch({ type: 'conversation', conversation: channel({ id: 'alfa', name: 'alfa' }) })
    const m = mount(() => <TuiApp />)
    await m.press('1')
    expect(store.getState().view).toEqual({ kind: 'conversation', id: 'alfa' })
    await m.press('2')
    expect(store.getState().view).toEqual({ kind: 'conversation', id: 'zebra' })
    await m.unmount()
  })
})
