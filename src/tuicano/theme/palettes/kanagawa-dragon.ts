// Kanagawa Dragon (https://github.com/rebelot/kanagawa.nvim), dark; Wave's muted
// sibling, all low-contrast ink and greys.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'kanagawa-dragon',
  kind: 'dark',
  origin: 'Kanagawa Dragon',
  text: '#c5c9c5',
  dim: '#a6a69c',
  faint: '#7a8382',
  onAccent: '#1d1c19',

  // Dragon is muted, so the warm accent is the dusty orange; aqua is the contrast.
  accent: '#b98d7b',
  accentAlt: '#8ba4b0',

  agent: {
    sky: '#8ea4a2',
    indigo: '#8ba4b0',
    violet: '#8992a7',
    rose: '#a292a3',
    amber: '#c4b28a',
    green: '#87a987',
    // Dragon ships a single aqua; teal borrows the mid grey-cyan so the eight
    // stay distinct.
    teal: '#7a8382',
    graphite: '#a6a69c'
  },

  border: '#282727',
  borderFocus: '#8ba4b0',
  heading: '#9e9b93',
  statusBg: '#282727',
  statusText: '#c5c9c5',

  me: '#8ba4b0',
  system: '#7a8382',
  routine: '#8992a7',
  working: '#c4b28a',
  waiting: '#a292a3',
  done: '#87a987',
  danger: '#c4746e',
  warn: '#b98d7b',
  ok: '#87a987',

  bar: '#8ba4b0',
  barTrack: '#282727',
  step: '#7a8382',
  placeholder: '#7a8382'
}
