// Rendering a screen in a test (spec §2.8). Ink needs a terminal; ink-testing-library
// gives it a fake one, so a screen's frame and its keys can be asserted instead of
// looked at. Every screen test uses this, so they all press keys the same way.
import { render } from 'ink-testing-library'
import { createStore, type State } from '../../src/app/store'
import { OverlayContext, type Overlay, type OverlayApi } from '../../src/tuicano/overlays/api'
import { ThemeProvider } from '../../src/tuicano/theme/context'
import { findTheme } from '../../src/tuicano/theme'
import type { Agent, Approval, Artifact, Conversation, Memory, Message, Routine, Skill } from '../../src/shared/types'
import type { CoreEvent } from '../../src/shared/rpc'
import type { ReactNode } from 'react'

export const KEY = {
  up: '\u001b[A',
  down: '\u001b[B',
  right: '\u001b[C',
  left: '\u001b[D',
  enter: '\r',
  esc: '\u001b',
  tab: '\t',
  backtab: '\x1b[Z',
  space: ' ',
  backspace: '\u007f',
  ctrl: (c: string) => String.fromCharCode(c.charCodeAt(0) & 31)
}

export interface Call {
  kind: 'prompt' | 'confirm' | 'sheet' | 'dialog' | 'panel' | 'themes' | 'note' | 'close'
  title?: string
  detail?: string
  value?: unknown
}

/** The overlay api a screen sees in a test: it records what was asked for. */
export function overlaySpy(): OverlayApi & { calls: Call[] } {
  const calls: Call[] = []
  const api: OverlayApi & { calls: Call[] } = {
    calls,
    prompt: (p) => calls.push({ kind: 'prompt', title: p.title, value: p }),
    confirm: (o) => calls.push({ kind: 'confirm', title: o.title, detail: o.detail, value: o }),
    sheet: (o) => calls.push({ kind: 'sheet', title: o.title, value: o }),
    dialog: (d) => calls.push({ kind: 'dialog', value: d }),
    panel: (p) => calls.push({ kind: 'panel', value: p }),
    themes: () => calls.push({ kind: 'themes' }),
    note: (text) => calls.push({ kind: 'note', value: text }),
    close: () => calls.push({ kind: 'close' })
  }
  return api
}

/** A state built from `CoreEvent`s: the same reduce the client runs for real. */
export function stateOf(...events: (CoreEvent | undefined)[]): State {
  const store = createStore({
    call: (async () => undefined) as never,
    connect: async () => {},
    onNavigate: () => {},
    viewing: () => {}
  })
  for (const e of events) if (e) store.dispatch(e)
  return store.getState()
}

export interface Mounted {
  /** The last frame Ink drew, as text. */
  frame(): string
  /** Ink's first frame, for the cases where the first paint is the point. */
  first(): string
  press(...keys: string[]): Promise<void>
  type(text: string): Promise<void>
  overlay: ReturnType<typeof overlaySpy>
  unmount(): void
}

export function mount(node: (overlay: OverlayApi) => ReactNode, opts?: { theme?: string }): Mounted {
  const overlay = overlaySpy()
  const theme = findTheme(opts?.theme)
  const mounted = render(
    <ThemeProvider theme={theme}>
      <OverlayContext.Provider value={overlay}>{node(overlay)}</OverlayContext.Provider>
    </ThemeProvider>,
    // The same rendering the client asks Ink for: whole frames, not diffs, so a frame
    // read after a keypress is the screen and not a patch of it.
  )
  // `<Static>` (the banner) writes its own chunk above the frame, so the *last* write
  // is not always the live frame. What was drawn since the keypress is.
  let since = 0
  // A keypress reaches the component, which commits asynchronously, and a handler that
  // re-registers (a state change) can drop a key that arrives in the same tick. Real
  // keystrokes are milliseconds apart, so the harness is too.
  const settle = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 60))
  }
  return {
    frame: () => mounted.frames.slice(since).join('\n') || (mounted.lastFrame() ?? ''),
    first: () => mounted.frames[0] ?? '',
    press: async (...keys) => {
      since = mounted.frames.length
      keys.forEach((k) => mounted.stdin.write(k))
      await settle()
    },
    type: async (text) => {
      since = mounted.frames.length
      mounted.stdin.write(text)
      await settle()
    },
    overlay,
    unmount: () => mounted.unmount()
  }
}

/** Two microtask turns: what a lane's test needed to let Ink commit a frame. */
export const tick = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => setTimeout(r, 0))
}

// ---------- the objects these tests need, without a database ----------

export const agent = (o: Partial<Agent> = {}): Agent => ({
  id: 'a1',
  name: 'Lia',
  handle: 'lia',
  role: 'Pesquisa',
  color: 'teal',
  instructions: '',
  modelId: 'sonnet',
  effort: 'medium',
  limit: 2_000_000,
  used: 0,
  grants: {},
  memory: 'auto',
  computer: false,
  archived: false,
  ...o
})

export const channel = (o: Partial<Conversation> = {}): Conversation => ({ id: 'c1', kind: 'channel', name: 'geral', members: ['a1'], ...o })
export const dm = (o: Partial<Conversation> = {}): Conversation => ({ id: 'd1', kind: 'dm', name: 'a1', members: ['a1'], ...o })

export const message = (o: Partial<Message> = {}): Message => ({
  id: 'm1',
  conversationId: 'c1',
  author: { kind: 'me' },
  text: 'ola',
  at: 1_700_000_000_000,
  ...o
})

export const approval = (o: Partial<Approval> = {}): Approval => ({
  id: 'ap1',
  hash: 'h',
  agentId: 'a1',
  conversationId: 'c1',
  messageId: 'm2',
  connectorId: 'tasks',
  connectorName: 'Tasks',
  tool: 'delete_task',
  args: { id: 3 },
  why: 'You asked',
  highRisk: false,
  state: 'pending',
  createdAt: 1_700_000_000_000,
  expiresAt: 1_700_000_000_000 + 86_400_000,
  ...o
})

export const artifact = (o: Partial<Artifact> = {}): Artifact => ({ id: 'ar1', agentId: 'a1', conversationId: 'c1', messageId: 'm1', kind: 'image', name: 'shot.png', title: 'Shot', source: 'https://example.com', size: 10, createdAt: 0, ...o })
export const memory = (o: Partial<Memory> = {}): Memory => ({ id: 'me1', scope: 'me', text: 'Prefers short answers', state: 'active', origin: 'me', messageIds: [], createdAt: 0, confirmedAt: 0, ...o })
export const routine = (o: Partial<Routine> = {}): Routine => ({ id: 'r1', name: 'Resumo do dia', agentId: 'a1', conversationId: 'c1', prompt: 'Resuma', schedule: { days: [1, 2, 3, 4, 5], time: '09:00' }, enabled: true, createdAt: 0, ...o })
export const skill = (o: Partial<Skill> = {}): Skill => ({ id: 's1', name: 'video', description: 'Cria vídeos', body: 'Passos', agents: [], state: 'active', createdAt: 0, updatedAt: 0, ...o })

export type { Agent, Approval, Artifact, Conversation, Memory, Message, Routine, Skill, State, Overlay }
