// Gruvbox Light (https://github.com/morhetz/gruvbox): the official palette with bg0
// as the base and the ink darkened so it reads on paper. `accent` is the dark orange
// the light palette uses for its warm tone.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'gruvbox-light',
  kind: 'light',
  origin: 'Gruvbox Light',
  text: '#3c3836',
  dim: '#665c54',
  faint: '#928374',
  onAccent: '#fbf1c7',

  accent: '#af3a03',
  accentAlt: '#076678',

  agent: {
    sky: '#427b58',
    indigo: '#076678',
    violet: '#8f3f71',
    rose: '#b16286',
    amber: '#b57614',
    green: '#79740e',
    teal: '#689d6a',
    graphite: '#928374'
  },

  border: '#d5c4a1',
  borderFocus: '#076678',
  heading: '#504945',
  statusBg: '#ebdbb2',
  statusText: '#3c3836',

  me: '#076678',
  system: '#928374',
  routine: '#8f3f71',
  working: '#b57614',
  waiting: '#b16286',
  done: '#79740e',
  danger: '#9d0006',
  warn: '#af3a03',
  ok: '#79740e',

  bar: '#076678',
  barTrack: '#d5c4a1',
  step: '#928374',
  placeholder: '#a89984'
}
