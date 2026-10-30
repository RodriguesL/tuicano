// Language parity (spec §3.4, CONTRIBUTING.md): a screen a person reads says the
// same thing in Portuguese and English, copied from the window's own pair. Both
// sides are asserted, so a string that only exists in English (a literal not put
// through L) fails here: the Portuguese render would show it untranslated.
import { describe, expect, it } from 'vitest'
import { render } from 'ink-testing-library'
import { setLang } from '../src/shared/lang'
import { OverlayContext } from '../src/tuicano/overlays/api'
import { ThemeProvider } from '../src/tuicano/theme/context'
import { findTheme } from '../src/tuicano/theme'
import { sidebarRows } from '../src/tuicano/sidebar'
import { Conversation } from '../src/tuicano/screens/Conversation'
import { Memory } from '../src/tuicano/screens/Memory'
import { agent, channel, memory, message, overlaySpy, stateOf } from './helpers/screen'
import type { ReactNode } from 'react'

// Render once per language: L() is read during the render, so pinning the global
// first and drawing the same tree is the whole check.
const frameIn = (lang: 'pt' | 'en', node: ReactNode): string => {
  setLang(lang)
  const mounted = render(
    <ThemeProvider theme={findTheme(undefined)}>
      <OverlayContext.Provider value={overlaySpy()}>{node}</OverlayContext.Provider>
    </ThemeProvider>
  )
  const frame = mounted.lastFrame() ?? ''
  mounted.unmount()
  return frame
}

const state = () =>
  stateOf(
    { type: 'agent', agent: agent({ id: 'a1', name: 'Lia' }) },
    { type: 'conversation', conversation: channel({ id: 'c1', name: 'geral', members: ['a1'] }) },
    { type: 'message', message: message({ id: 'm1', conversationId: 'c1', author: { kind: 'agent', id: 'a1' }, text: 'feito', at: 2, run: { status: 'done', steps: [], memoryIds: ['me1'] } }) },
    { type: 'memory', memory: memory({ id: 'me1', scope: 'me', text: 'Prefere respostas curtas', state: 'active' }) }
  )

describe('the TUI in both languages', () => {
  it('names the sidebar rows in Portuguese and English', () => {
    const s = state()
    setLang('en')
    const en = sidebarRows(s).map((r) => r.label)
    setLang('pt')
    const pt = sidebarRows(s).map((r) => r.label)
    expect(en).toContain('Approvals')
    expect(en).toContain('Settings')
    expect(pt).toContain('Aprovações')
    expect(pt).toContain('Configurações')
    expect(pt).not.toContain('Settings')
  })

  it('labels a memory line in both languages, as the window does', () => {
    const s = state()
    const en = frameIn('en', <Conversation state={s} active id="c1" onImage={() => {}} />)
    const pt = frameIn('pt', <Conversation state={s} active id="c1" onImage={() => {}} />)
    expect(en).toContain('Kept: Prefere respostas curtas')
    expect(pt).toContain('Guardou: Prefere respostas curtas')
  })

  it('titles the memory screen in Portuguese and English', () => {
    const s = state()
    expect(frameIn('en', <Memory state={s} active />)).toContain('Memory · About you')
    expect(frameIn('pt', <Memory state={s} active />)).toContain('Memória · Sobre você')
  })
})
