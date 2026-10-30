// The router (spec §2.8): which layer owns a keypress. This is the file that broke
// silently once — the app's letters fired while a screen was focused, so a screen's
// own `a`/`n`/`i` did two things at once, and Ctrl+T (a raw control character in a
// real terminal) never reached its binding at all.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KEY, mount } from './helpers/screen'
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
    m.unmount()
  })

  it('opens search on / while the sidebar has the cursor', async () => {
    const m = mount(() => <TuiApp />)
    await m.press('/')
    expect(m.frame()).toContain('Search')
    m.unmount()
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
    m.unmount()
  })

  it('opens the help on ? and closes it on any key', async () => {
    const m = mount(() => <TuiApp />)
    await m.press('?')
    expect(m.frame()).toContain('keys')
    await m.press('x')
    expect(m.frame()).not.toContain('swap focus')
    m.unmount()
  })
})
