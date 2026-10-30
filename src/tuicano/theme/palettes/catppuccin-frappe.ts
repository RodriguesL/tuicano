// Catppuccin Frappé (https://catppuccin.com/palette), dark; same shape and token
// names as the reference, mapped semantically rather than literally.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'catppuccin-frappe',
  kind: 'dark',
  origin: 'Catppuccin Frappé',
  text: '#c6d0f5',
  dim: '#a5adce',
  faint: '#737994',
  onAccent: '#303446',

  // Peach keeps Tucano's orange; blue is the cool contrast.
  accent: '#ef9f76',
  accentAlt: '#8caaee',

  agent: {
    sky: '#99d1db',
    indigo: '#8caaee',
    violet: '#ca9ee6',
    rose: '#f4b8e4',
    amber: '#e5c890',
    green: '#a6d189',
    teal: '#81c8be',
    graphite: '#838ba7'
  },

  border: '#51576d',
  borderFocus: '#8caaee',
  heading: '#babbf1',
  statusBg: '#414559',
  statusText: '#c6d0f5',

  me: '#8caaee',
  system: '#838ba7',
  routine: '#ca9ee6',
  working: '#e5c890',
  waiting: '#f4b8e4',
  done: '#a6d189',
  danger: '#e78284',
  warn: '#ef9f76',
  ok: '#a6d189',

  bar: '#8caaee',
  barTrack: '#51576d',
  step: '#838ba7',
  placeholder: '#737994'
}
