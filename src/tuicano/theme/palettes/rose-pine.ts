// Rosé Pine (https://rosepinetheme.com): the official palette. Its six accents cover
// every hue but green and teal, so those two slots are the only additions, kept in
// the palette's pastel register. `accent` is gold, the warmest tone it has.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'rose-pine',
  kind: 'dark',
  origin: 'Rosé Pine',
  text: '#e0def4',
  dim: '#908caa',
  faint: '#6e6a86',
  onAccent: '#191724',

  accent: '#f6c177',
  accentAlt: '#c4a7e7',

  agent: {
    sky: '#9ccfd8',
    indigo: '#31748f',
    violet: '#c4a7e7',
    rose: '#eb6f92',
    amber: '#f6c177',
    green: '#a3be8c',
    teal: '#6fbfb8',
    graphite: '#6e6a86'
  },

  border: '#26233a',
  borderFocus: '#31748f',
  heading: '#ebbcba',
  statusBg: '#1f1d2e',
  statusText: '#e0def4',

  me: '#31748f',
  system: '#6e6a86',
  routine: '#c4a7e7',
  working: '#f6c177',
  waiting: '#eb6f92',
  done: '#a3be8c',
  danger: '#eb6f92',
  warn: '#ebbcba',
  ok: '#a3be8c',

  bar: '#c4a7e7',
  barTrack: '#1f1d2e',
  step: '#6e6a86',
  placeholder: '#6e6a86'
}
