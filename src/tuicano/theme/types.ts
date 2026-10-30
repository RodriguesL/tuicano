// What a theme is (spec §2.7). Tokens are semantic, never per-screen: a screen
// asks for `danger`, not for red, so a new theme is data and a new screen cannot
// invent a colour. Values are hex; chalk downgrades them on a 256-colour terminal,
// and the theme declares which of the six looks it is for.
import type { AgentColor } from '../../shared/types'

export type ThemeKind = 'dark' | 'light'

export interface Theme {
  /** What the picker shows. */
  name: string
  kind: ThemeKind
  /** Where the palette comes from, in one line, for the picker and the doc. */
  origin: string
  /** Foreground, dimmed text, text on a filled surface. */
  text: string
  dim: string
  faint: string // the quietest ink: separators, hints
  onAccent: string
  /** The app's own colours: its brand, and a second tone for variety. */
  accent: string
  accentAlt: string
  /** One per agent colour the app stores (Agent.color). */
  agent: Record<AgentColor, string>
  /** Chrome: borders, the focused pane's border, headings, the status line. */
  border: string
  borderFocus: string
  heading: string
  statusBg: string
  statusText: string
  /** Message and run states. */
  me: string
  system: string
  routine: string
  working: string
  waiting: string
  done: string
  danger: string
  warn: string
  ok: string
  /** Data: bars, tables, the artifact/step chrome. */
  bar: string
  barTrack: string
  step: string
  /** What a picture is drawn with when the terminal has no graphics protocol. */
  placeholder: string
}

/** Every token, in picker order; the test uses it to prove a palette is complete. */
export const THEME_TOKENS = [
  'text',
  'dim',
  'faint',
  'onAccent',
  'accent',
  'accentAlt',
  'border',
  'borderFocus',
  'heading',
  'statusBg',
  'statusText',
  'me',
  'system',
  'routine',
  'working',
  'waiting',
  'done',
  'danger',
  'warn',
  'ok',
  'bar',
  'barTrack',
  'step',
  'placeholder'
] as const satisfies readonly (keyof Theme)[]
