// Atom One Dark (https://github.com/atom/one-dark-syntax): the official palette. The
// warm accent is its orange; One Dark has a single cyan, so `teal` is the one added
// tone beside it.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'one-dark',
  kind: 'dark',
  origin: 'Atom One Dark',
  text: '#abb2bf',
  dim: '#818896',
  faint: '#5c6370',
  onAccent: '#282c34',

  accent: '#d19a66',
  accentAlt: '#c678dd',

  agent: {
    sky: '#56b6c2',
    indigo: '#61afef',
    violet: '#c678dd',
    rose: '#e06c75',
    amber: '#e5c07b',
    green: '#98c379',
    teal: '#6fc2b8',
    graphite: '#5c6370'
  },

  border: '#3e4451',
  borderFocus: '#61afef',
  heading: '#61afef',
  statusBg: '#2c313c',
  statusText: '#abb2bf',

  me: '#61afef',
  system: '#5c6370',
  routine: '#c678dd',
  working: '#e5c07b',
  waiting: '#e06c75',
  done: '#98c379',
  danger: '#e06c75',
  warn: '#d19a66',
  ok: '#98c379',

  bar: '#61afef',
  barTrack: '#3e4451',
  step: '#5c6370',
  placeholder: '#5c6370'
}
