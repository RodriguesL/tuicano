// Kanagawa Wave (https://github.com/rebelot/kanagawa.nvim), dark; the sumi ink
// background with the woodblock-red and surimi-orange accents.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'kanagawa-wave',
  kind: 'dark',
  origin: 'Kanagawa Wave',
  text: '#dcd7ba',
  dim: '#c8c093',
  faint: '#727169',
  onAccent: '#1f1f28',

  // Surimi-orange is the warm brand tone; crystal blue is the cool contrast.
  accent: '#ffa066',
  accentAlt: '#7e9cd8',

  agent: {
    sky: '#a3d4d5',
    indigo: '#7e9cd8',
    violet: '#957fb8',
    rose: '#d27e99',
    amber: '#e6c384',
    green: '#98bb6c',
    teal: '#6a9589',
    graphite: '#717c7c'
  },

  border: '#363646',
  borderFocus: '#7e9cd8',
  heading: '#9cabca',
  statusBg: '#2a2a37',
  statusText: '#dcd7ba',

  me: '#7e9cd8',
  system: '#727169',
  routine: '#957fb8',
  working: '#e6c384',
  waiting: '#d27e99',
  done: '#98bb6c',
  danger: '#e46876',
  warn: '#ffa066',
  ok: '#98bb6c',

  bar: '#7e9cd8',
  barTrack: '#363646',
  step: '#727169',
  placeholder: '#727169'
}
