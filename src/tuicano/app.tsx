// TUIcano's root (spec §1.4, §2.8): the layout, the chrome the client owns (the
// composer, the status line, the help), the overlay host, and the global keys.
//
// One rule keeps this small: a component owns the keys it is *for*, and the layers
// above it are quiet while it is active. A screen moves its own cursor because it
// knows what its rows are; the app only decides who is listening.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Box, Text, useApp, useInput, useWindowSize } from 'ink'
import { writeConfig } from './config'
import { L } from '../shared/lang'
import { APPROVAL_KEYS, CONVERSATION_KEYS, GLOBAL_KEYS, LATER_KEYS, PICKER_KEYS, type KeyHelp } from './keys'
import { runtime } from './runtime'
import { findTheme } from './theme'
import type { View } from '../app/store'
import { ThemeProvider } from './theme/context'
import { useAppState, store, unreadTotal } from './store'
import { protocolLabel } from './graphics/transport'
import { ctrlKey } from './ui/input'
import { ImageOverlay } from './graphics/viewer'
import { OverlayContext, type Overlay, type OverlayApi, type ScreenProps } from './overlays/api'
import { OverlayHost } from './overlays/host'
import { Sidebar } from './screens/Sidebar'
import { Conversation } from './screens/Conversation'
import { Approvals } from './screens/Approvals'
import { AgentPage } from './screens/Agent'
import { TucaBuilder } from './screens/Tuca'
import { Connectors } from './screens/Connectors'
import { Memory } from './screens/Memory'
import { Routines } from './screens/Routines'
import { Skills } from './screens/Skills'
import { Banner } from './screens/Banner'
import { Usage } from './screens/Usage'
import { Report } from './screens/Report'
import { Settings } from './screens/Settings'
import { Onboarding } from './screens/Onboarding'

const HELP_MS = 3_000

// The single keys the sidebar prints beside its rows (spec §3.4): the hint a person
// reads has to be a key that works.
const NAV_KEYS: Record<string, View> = {
  u: { kind: 'usage' },
  c: { kind: 'connectors' },
  m: { kind: 'memory' },
  r: { kind: 'routines' },
  k: { kind: 'skills' },
  b: { kind: 'report' },
  g: { kind: 'new-agent' },
  t: { kind: 'tuca' }
}

export function TuiApp(): ReactNode {
  const state = useAppState()
  const { exit } = useApp()
  // The pane's real size, when it reports one: a pane can be 0x0 for a moment after
  // a split, and a NaN height or width is how a TUI dies in a multiplexer. With no
  // size to go on, Ink sizes the tree to its content.
  const { columns: winCols, rows: winRows } = useWindowSize()
  const height = Number.isFinite(winRows) && winRows > 2 ? winRows : undefined
  const sidebarWidth = Number.isFinite(winCols) ? Math.max(12, Math.min(32, Math.floor(winCols / 3))) : 30
  const [themeName, setThemeName] = useState(runtime.theme)
  const theme = useMemo(() => findTheme(themeName), [themeName])
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [note, setNote] = useState<string | undefined>()
  const [help, setHelp] = useState(false)
  const [image, setImage] = useState<ReactNode | null>(null)
  const [focus, setFocus] = useState<'sidebar' | 'pane'>('sidebar')
  const [composer, setComposer] = useState<string | null>(null)

  const view = state.view ?? { kind: 'new-agent' as const }
  const conversation = view.kind === 'conversation' ? view.id : undefined
  // The first run, before anything else: the same gate the window uses (spec §3.4).
  const intro = state.ready && state.settings.onboarding?.done === false

  // A popup pane (spec §5): herdr renders it session-modal, it has no pane id and it
  // emits no lifecycle events, so the plugin cannot close it — it closes itself, once
  // a decision has been made or the person presses Escape.
  const popupStart = useRef<number | undefined>(undefined)
  const pendingNow = state.approvals.filter((a) => a.state === 'pending').length
  if (runtime.popup && popupStart.current === undefined) popupStart.current = pendingNow
  useEffect(() => {
    if (runtime.popup && popupStart.current !== undefined && pendingNow < popupStart.current) exit()
  }, [pendingNow, exit])

  // A note is what just happened: it says its line and goes away.
  useEffect(() => {
    if (!note) return
    const timer = setTimeout(() => setNote(undefined), HELP_MS)
    return () => clearTimeout(timer)
  }, [note])

  const api: OverlayApi = {
    prompt: (prompt) => setOverlay({ kind: 'prompt', prompt }),
    confirm: (o) => setOverlay({ kind: 'confirm', title: o.title, detail: o.detail, yes: o.yes ?? 'yes', onYes: o.onYes }),
    sheet: (o) => setOverlay({ kind: 'sheet', title: o.title, render: o.render }),
    dialog: (dialog) => setOverlay({ kind: 'dialog', dialog }),
    panel: (panel) => setOverlay({ kind: 'panel', panel }),
    themes: () => setOverlay({ kind: 'themes' }),
    note: setNote,
    close: () => setOverlay(null)
  }

  const closeAll = (): void => {
    setOverlay(null)
    setHelp(false)
    setImage(null)
  }

  // A key handler must never read state from its own closure: Ink re-registers the
  // handler on every render, and a key that arrives during that window is handled by
  // the *previous* handler, with the previous state — which a person experiences as a
  // key that does nothing, and which once made `a` after a focus change drive the
  // wrong screen. Everything mutable is read through this ref instead.
  const latest = useRef({ overlay, help, image, composer, focus, view, focusables: state })
  latest.current = { overlay, help, image, composer, focus, view, focusables: state }

  // The layers below only listen when nothing is above them.
  const chrome = !overlay && !help && !image && composer === null
  const screen: ScreenProps = { state, active: chrome && focus === 'pane' }

  useInput(
    (input, key) => {
      const now = latest.current
      if (ctrlKey(input, key, 'c')) return exit()
      if (now.image) return setImage(null)
      if (now.help) return setHelp(false)
      if (now.overlay) return // the host owns the keyboard
      if (now.composer !== null) {
        if (key.escape) return setComposer(null)
        if (key.return) {
          const text = now.composer
          setComposer(null)
          const here = now.view.kind === 'conversation' ? now.view.id : undefined
          if (here && text.trim()) store.sendMessage(here, text)
          return
        }
        if (key.backspace || key.delete) return setComposer(now.composer.slice(0, -1))
        if (input && !key.ctrl && !key.meta) return setComposer(now.composer + input)
        return
      }
      // Focus, set explicitly rather than toggled: a toggle run twice (a key that
      // arrives twice, which a multiplexer can cause) cancels itself, and Tab is the
      // key a person leans on. Shift+Tab, or the backtab sequence, goes back.
      if (input === '\x1b[Z' || input === '\x1b[1;2Z') return setFocus('sidebar')
      if (key.tab || input === '\t') return setFocus(key.shift === true ? 'sidebar' : 'pane')
      if (input === 'q') return exit()
      if (input === '?') return setHelp(true)
      if (ctrlKey(input, key, 't')) return api.themes()
      // No global Esc: whichever layer is above owns it (an overlay closes, a screen
      // goes back, the composer leaves). Two owners for one key is how a screen ends
      // up doing two things at once.
      // Plain letters belong to the pane that has the cursor: a screen's `a`, `n`
      // or `i` is its own (add a memory, a new routine, bring a skill in), and the
      // app's letters live in the sidebar, which is where the app's own things are.
      if (now.focus !== 'sidebar') return
      if (input === 'a') return store.navigate({ kind: 'approvals' })
      if (input === 'n') return api.dialog({ kind: 'new-channel' })
      if (input === '/') return api.dialog({ kind: 'search' })
      if (input === ',') return store.navigate({ kind: 'settings' })
      // One key per screen, the ones the sidebar prints beside each row: the hint a
      // person reads has to be a key that works.
      const jump = NAV_KEYS[input]
      if (jump) return store.navigate(jump)
      if (input === 'i' && now.view.kind === 'conversation') return setComposer('')
      if (/^[1-9]$/.test(input)) {
        const channels = now.focusables.conversations.filter((c) => c.kind === 'channel')
        const target = channels[Number(input) - 1]
        if (target) store.navigate({ kind: 'conversation', id: target.id })
        return
      }
    },
    // Only the overlay host takes the keyboard away: it has its own handler (Esc, and
    // the forms inside it). The help and the image viewer are *this* handler's to
    // close, so switching it off for them would leave both unclosable.
    { isActive: !overlay }
  )

  const status = ((): string => {
    if (note) return note
    if (composer !== null) return `> ${composer}`
    const where = view.kind === 'conversation' ? L('conversa', 'conversation') : view.kind
    return `${protocolLabel(runtime.protocol)} ${Math.round(runtime.cell.pxW)}x${Math.round(runtime.cell.pxH)}px · ${theme.name} · ${unreadTotal(state)} ${L('não lidas', 'unread')} · ${where} · ${focus} · ? ${L('ajuda', 'help')}`
  })()

  if (image) return <>{image}</>

  return (
    <ThemeProvider theme={theme}>
      <OverlayContext.Provider value={api}>
        <Box flexDirection="column" height={height}>
          <Banner />
          {/* The body stays mounted while an overlay is up, and is only hidden: an
              overlay that *replaced* it unmounted the screen under it, so a screen's
              own state was lost every time it opened a prompt — the introduction
              restarted at step one after its name prompt, which is exactly what
              confirming seemed not to do. */}
          <Box flexDirection="column" flexGrow={1} display={overlay ? 'none' : 'flex'}>
            {intro ? (
              <Onboarding state={state} active={chrome} />
            ) : (
              <Box flexGrow={1}>
                <Sidebar state={state} active={chrome && focus === 'sidebar'} width={sidebarWidth} />
                <Box flexDirection="column" flexGrow={1} paddingLeft={1} overflow="hidden">
                  {renderView(view, screen, setImage)}
                </Box>
              </Box>
            )}
          </Box>
          {overlay ? (
            <OverlayHost
              overlay={overlay}
              onClose={closeAll}
              theme={themeName}
              onTheme={(name) => {
                setThemeName(name)
                writeConfig(runtime.dataDir, { theme: name })
                setNote(L(`tema: ${name}`, `theme: ${name}`))
              }}
            />
          ) : null}
          {help ? <Help /> : null}
          <Text backgroundColor={theme.statusBg} color={theme.statusText}>
            {status}
          </Text>
        </Box>
      </OverlayContext.Provider>
    </ThemeProvider>
  )
}

function renderView(view: NonNullable<ReturnType<typeof useAppState>['view']>, screen: ScreenProps, setImage: (n: ReactNode | null) => void): ReactNode {
  switch (view.kind) {
    case 'conversation':
      return <Conversation {...screen} id={view.id} onImage={setImage} />
    case 'approvals':
      return <Approvals {...screen} />
    case 'agent':
      return <AgentPage {...screen} id={view.id} />
    case 'new-agent':
      return <AgentPage {...screen} draft={view.draft} fromMessage={view.fromMessage} />
    case 'tuca':
      return <TucaBuilder {...screen} from={view.from} />
    case 'connectors':
      return <Connectors {...screen} />
    case 'memory':
      return <Memory {...screen} />
    case 'routines':
      return <Routines {...screen} />
    case 'skills':
      return <Skills {...screen} />
    case 'usage':
      return <Usage {...screen} />
    case 'report':
      return <Report {...screen} />
    case 'settings':
      return <Settings {...screen} />
  }
}

function Help(): ReactNode {
  const t = findTheme(runtime.theme)
  const groups: KeyHelp[][] = [GLOBAL_KEYS, CONVERSATION_KEYS, APPROVAL_KEYS, PICKER_KEYS, LATER_KEYS].filter((g) => g.length)
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={t.borderFocus} paddingX={1}>
      <Text bold color={t.heading}>
        {L('TUIcano — teclas', 'TUIcano — keys')}
      </Text>
      {groups.map((group, g) => (
        <Box key={g} flexDirection="column">
          {group.map((k) => (
            <Text key={k.keys}>
              <Text color={t.accent}>{`  ${k.keys.padEnd(18)}`}</Text>
              <Text color={t.dim}>{k.what}</Text>
            </Text>
          ))}
        </Box>
      ))}
      <Text color={t.faint}>{L('Esc fecha isto. Toda tecla da matriz de paridade está documentada em docs/spec-tuicano.md §5.', 'Esc closes this. Every key on the parity matrix is documented in docs/spec-tuicano.md §5.')}</Text>
    </Box>
  )
}
