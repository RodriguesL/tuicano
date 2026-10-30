// Everforest Dark (https://github.com/sainnhe/everforest): the official dark palette,
// medium bg0. The warm accent is its orange; its single aqua serves `sky`, so `teal`
// is the one added tone beside it.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'everforest-dark',
  kind: 'dark',
  origin: 'Everforest Dark',
  text: '#d3c6aa',
  dim: '#9da9a0',
  faint: '#7a8478',
  onAccent: '#2d353b',

  accent: '#e69875',
  accentAlt: '#7fbbb3',

  agent: {
    sky: '#83c092',
    indigo: '#7fbbb3',
    violet: '#d699b6',
    rose: '#e67e80',
    amber: '#dbbc7f',
    green: '#a7c080',
    teal: '#6fae9f',
    graphite: '#859289'
  },

  border: '#3d484d',
  borderFocus: '#7fbbb3',
  heading: '#d3c6aa',
  statusBg: '#343f44',
  statusText: '#d3c6aa',

  me: '#7fbbb3',
  system: '#859289',
  routine: '#d699b6',
  working: '#dbbc7f',
  waiting: '#e67e80',
  done: '#a7c080',
  danger: '#e67e80',
  warn: '#e69875',
  ok: '#a7c080',

  bar: '#7fbbb3',
  barTrack: '#343f44',
  step: '#859289',
  placeholder: '#7a8478'
}
