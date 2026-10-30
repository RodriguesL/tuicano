// Nord (https://www.nordtheme.com), the official palette; the polar-night greys
// with the frost blues and aurora accents.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'nord',
  kind: 'dark',
  origin: 'Nord',
  text: '#d8dee9',
  dim: '#81a1c1',
  faint: '#4c566a',
  onAccent: '#2e3440',

  // Nord's warm tone is the aurora orange; the frost blue is the cool contrast.
  accent: '#d08770',
  accentAlt: '#81a1c1',

  agent: {
    sky: '#88c0d0',
    indigo: '#81a1c1',
    violet: '#b48ead',
    rose: '#bf616a',
    amber: '#ebcb8b',
    green: '#a3be8c',
    teal: '#8fbcbb',
    graphite: '#4c566a'
  },

  border: '#434c5e',
  borderFocus: '#88c0d0',
  heading: '#8fbcbb',
  statusBg: '#3b4252',
  statusText: '#d8dee9',

  // Nord has one blue; `me` takes the darker frost so `dim` keeps the lighter one.
  me: '#5e81ac',
  system: '#4c566a',
  routine: '#b48ead',
  working: '#ebcb8b',
  waiting: '#bf616a',
  done: '#a3be8c',
  danger: '#bf616a',
  warn: '#d08770',
  ok: '#a3be8c',

  bar: '#5e81ac',
  barTrack: '#434c5e',
  step: '#4c566a',
  placeholder: '#4c566a'
}
