// Kanagawa Lotus (https://github.com/rebelot/kanagawa.nvim), the light one; lotus
// white paper with the same inks as the dark variants.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'kanagawa-lotus',
  kind: 'light',
  origin: 'Kanagawa Lotus',
  text: '#545464',
  dim: '#8a8980',
  faint: '#a09cac',
  onAccent: '#f2ecbc',

  // Lotus is light, so `onAccent` is its paper base; lotus-orange is the warm
  // brand tone and crystal blue the cool contrast.
  accent: '#cc6d00',
  accentAlt: '#4d699b',

  agent: {
    sky: '#b5cbd2',
    indigo: '#4d699b',
    violet: '#766b90',
    rose: '#b35b79',
    amber: '#de9800',
    green: '#6f894e',
    teal: '#5e857a',
    graphite: '#8a8980'
  },

  border: '#c9cbd1',
  borderFocus: '#4d699b',
  heading: '#766b90',
  statusBg: '#c9cbd1',
  statusText: '#545464',

  me: '#4d699b',
  system: '#8a8980',
  routine: '#766b90',
  working: '#de9800',
  waiting: '#b35b79',
  done: '#6f894e',
  danger: '#c84053',
  warn: '#cc6d00',
  ok: '#6f894e',

  bar: '#4d699b',
  barTrack: '#c9cbd1',
  step: '#8a8980',
  placeholder: '#a09cac'
}
