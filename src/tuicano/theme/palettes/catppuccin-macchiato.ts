// Catppuccin Macchiato (https://catppuccin.com/palette), dark; same shape and token
// names as the reference, mapped semantically rather than literally.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'catppuccin-macchiato',
  kind: 'dark',
  origin: 'Catppuccin Macchiato',
  text: '#cad3f5',
  dim: '#a5adcb',
  faint: '#6e738d',
  onAccent: '#24273a',

  // Peach keeps Tucano's orange; blue is the cool contrast.
  accent: '#f5a97f',
  accentAlt: '#8aadf4',

  agent: {
    sky: '#91d7e3',
    indigo: '#8aadf4',
    violet: '#c6a0f6',
    rose: '#f5bde6',
    amber: '#eed49f',
    green: '#a6da95',
    teal: '#8bd5ca',
    graphite: '#8087a2'
  },

  border: '#494d64',
  borderFocus: '#8aadf4',
  heading: '#b7bdf8',
  statusBg: '#363a4f',
  statusText: '#cad3f5',

  me: '#8aadf4',
  system: '#8087a2',
  routine: '#c6a0f6',
  working: '#eed49f',
  waiting: '#f5bde6',
  done: '#a6da95',
  danger: '#ed8796',
  warn: '#f5a97f',
  ok: '#a6da95',

  bar: '#8aadf4',
  barTrack: '#494d64',
  step: '#8087a2',
  placeholder: '#6e738d'
}
