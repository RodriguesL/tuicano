// What an overlay is, and how a screen asks for one (spec §2.8). Screens never
// draw their own modal frame: they ask the host, which keeps the frame, the Esc
// key and the focus gating in one place while twelve screens stay presentational.
import { createContext, useContext, type ReactNode } from 'react'
import type { Dialog, Panel, State } from '../../app/store'

export interface Prompt {
  title: string
  label?: string
  value?: string
  placeholder?: string
  hint?: string
  /** A secret: masked, never echoed back. */
  mask?: boolean
  onSubmit: (text: string) => void | Promise<void>
  onCancel?: () => void
}

export type Overlay =
  | { kind: 'prompt'; prompt: Prompt }
  | { kind: 'confirm'; title: string; detail?: string; yes: string; onYes: () => void | Promise<void> }
  | { kind: 'sheet'; title: string; render: (close: () => void) => ReactNode }
  | { kind: 'dialog'; dialog: Dialog }
  | { kind: 'panel'; panel: Panel }
  | { kind: 'themes' }

export interface OverlayApi {
  prompt(prompt: Prompt): void
  confirm(o: { title: string; detail?: string; yes?: string; onYes: () => void | Promise<void> }): void
  /** A screen's own form, inside the host's frame; `close` is how it is done. */
  sheet(o: { title: string; render: (close: () => void) => ReactNode }): void
  dialog(dialog: Dialog): void
  panel(panel: Panel): void
  themes(): void
  /** A line in the status bar, for what just happened. */
  note(text: string | undefined): void
  close(): void
}

const noop = (): void => {}

export const OverlayContext = createContext<OverlayApi>({
  prompt: noop,
  confirm: noop,
  sheet: noop,
  dialog: noop,
  panel: noop,
  themes: noop,
  note: noop,
  close: noop
})

export const useOverlay = (): OverlayApi => useContext(OverlayContext)

/** What every screen receives. Screens own their cursor and their keys. */
export interface ScreenProps {
  state: State
  /** True when this screen owns the keyboard: no overlay, no composer, no image. */
  active: boolean
}
