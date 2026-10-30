// Rosé Pine Moon (https://rosepinetheme.com): the `moon` variant of the official
// palette. Same mapping as rose-pine, on the cooler base; green and teal stay the
// two additions Rosé Pine has no accent for.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'rose-pine-moon',
  kind: 'dark',
  origin: 'Rosé Pine Moon',
  text: '#e0def4',
  dim: '#908caa',
  faint: '#6e6a86',
  onAccent: '#232136',

  accent: '#f6c177',
  accentAlt: '#c4a7e7',

  agent: {
    sky: '#9ccfd8',
    indigo: '#3e8fb0',
    violet: '#c4a7e7',
    rose: '#eb6f92',
    amber: '#f6c177',
    green: '#a3be8c',
    teal: '#6fbfb8',
    graphite: '#6e6a86'
  },

  border: '#393552',
  borderFocus: '#3e8fb0',
  heading: '#ea9a97',
  statusBg: '#2a273f',
  statusText: '#e0def4',

  me: '#3e8fb0',
  system: '#6e6a86',
  routine: '#c4a7e7',
  working: '#f6c177',
  waiting: '#eb6f92',
  done: '#a3be8c',
  danger: '#eb6f92',
  warn: '#ea9a97',
  ok: '#a3be8c',

  bar: '#c4a7e7',
  barTrack: '#2a273f',
  step: '#6e6a86',
  placeholder: '#6e6a86'
}
