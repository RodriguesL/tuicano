// Gruvbox Dark (Hard) (https://github.com/morhetz/gruvbox): the official palette,
// bg0_h as the base. The toucan keeps its orange (the bright orange) in `accent`,
// so a gruvbox TUI still reads as Tucano.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'gruvbox-dark-hard',
  kind: 'dark',
  origin: 'Gruvbox Dark (Hard)',
  text: '#ebdbb2',
  dim: '#a89984',
  faint: '#928374',
  onAccent: '#1d2021',

  accent: '#fe8019',
  accentAlt: '#83a598',

  agent: {
    sky: '#8ec07c',
    indigo: '#83a598',
    violet: '#d3869b',
    rose: '#fb4934',
    amber: '#fabd2f',
    green: '#b8bb26',
    teal: '#689d6a',
    graphite: '#928374'
  },

  border: '#504945',
  borderFocus: '#83a598',
  heading: '#d5c4a1',
  statusBg: '#3c3836',
  statusText: '#ebdbb2',

  me: '#83a598',
  system: '#928374',
  routine: '#b16286',
  working: '#fabd2f',
  waiting: '#d3869b',
  done: '#b8bb26',
  danger: '#fb4934',
  warn: '#fe8019',
  ok: '#b8bb26',

  bar: '#83a598',
  barTrack: '#3c3836',
  step: '#928374',
  placeholder: '#928374'
}
