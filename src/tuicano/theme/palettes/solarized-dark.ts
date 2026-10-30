// Solarized Dark (https://ethanschoonover.com/solarized): Ethan Schoonover's official
// palette, base03 as the base. The warm accent is its orange; Solarized has a single
// cyan, so `teal` is the one added tone beside it.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'solarized-dark',
  kind: 'dark',
  origin: 'Solarized Dark',
  text: '#839496',
  dim: '#657b83',
  faint: '#586e75',
  onAccent: '#002b36',

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

  border: '#073642',
  borderFocus: '#268bd2',
  heading: '#93a1a1',
  statusBg: '#073642',
  statusText: '#839496',

  me: '#268bd2',
  system: '#586e75',
  routine: '#6c71c4',
  working: '#b58900',
  waiting: '#d33682',
  done: '#859900',
  danger: '#dc322f',
  warn: '#cb4b16',
  ok: '#859900',

  bar: '#268bd2',
  barTrack: '#073642',
  step: '#586e75',
  placeholder: '#586e75'
}
