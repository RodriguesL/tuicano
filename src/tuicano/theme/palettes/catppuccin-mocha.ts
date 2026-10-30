// Catppuccin Mocha (https://catppuccin.com/palette), and the reference for every
// other palette: same shape, same token names, semantic values.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'catppuccin-mocha',
  kind: 'dark',
  origin: 'Catppuccin Mocha',
  text: '#cdd6f4',
  dim: '#a6adc8',
  faint: '#6c7086',
  onAccent: '#1e1e2e',

  // The toucan's orange lives on in `accent` (peach), so a themed TUI still
  // looks like Tucano; mauve is the second tone.
  accent: '#fab387',
  accentAlt: '#cba6f7',

  agent: {
    sky: '#89dceb',
    indigo: '#89b4fa',
    violet: '#cba6f7',
    rose: '#f38ba8',
    amber: '#f9e2af',
    green: '#a6e3a1',
    teal: '#94e2d5',
    graphite: '#7f849c'
  },

  border: '#45475a',
  borderFocus: '#89b4fa',
  heading: '#b4befe',
  statusBg: '#313244',
  statusText: '#cdd6f4',

  me: '#89b4fa',
  system: '#9399b2',
  routine: '#cba6f7',
  working: '#f9e2af',
  waiting: '#f5c2e7',
  done: '#a6e3a1',
  danger: '#f38ba8',
  warn: '#fab387',
  ok: '#a6e3a1',

  bar: '#89b4fa',
  barTrack: '#45475a',
  step: '#7f849c',
  placeholder: '#6c7086'
}
