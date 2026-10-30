// Solarized Light (https://ethanschoonover.com/solarized): Ethan Schoonover's official
// palette on base3, the same eight accents with the ink darkened for paper. `teal` is
// the single addition, as in the dark variant; Solarized has one cyan.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'solarized-light',
  kind: 'light',
  origin: 'Solarized Light',
  text: '#657b83',
  dim: '#586e75',
  faint: '#93a1a1',
  onAccent: '#fdf6e3',

  accent: '#cb4b16',
  accentAlt: '#6c71c4',

  agent: {
    sky: '#2aa198',
    indigo: '#268bd2',
    violet: '#6c71c4',
    rose: '#d33682',
    amber: '#b58900',
    green: '#859900',
    teal: '#3aaea4',
    graphite: '#586e75'
  },

  border: '#eee8d5',
  borderFocus: '#268bd2',
  heading: '#586e75',
  statusBg: '#eee8d5',
  statusText: '#657b83',

  me: '#268bd2',
  system: '#93a1a1',
  routine: '#6c71c4',
  working: '#b58900',
  waiting: '#d33682',
  done: '#859900',
  danger: '#dc322f',
  warn: '#cb4b16',
  ok: '#859900',

  bar: '#268bd2',
  barTrack: '#eee8d5',
  step: '#93a1a1',
  placeholder: '#93a1a1'
}
