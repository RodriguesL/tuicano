// Tokyo Night, the `night` variant (https://github.com/folke/tokyonight.nvim);
// the deep indigo night with the neon orange and cyan accents.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'tokyo-night',
  kind: 'dark',
  origin: 'Tokyo Night (night)',
  text: '#c0caf5',
  dim: '#a9b1d6',
  faint: '#565f89',
  onAccent: '#1a1b26',

  // The orange keeps Tucano's warm identity; the blue is the cool contrast.
  accent: '#ff9e64',
  accentAlt: '#7aa2f7',

  agent: {
    sky: '#7dcfff',
    indigo: '#7aa2f7',
    violet: '#bb9af7',
    rose: '#f7768e',
    amber: '#e0af68',
    green: '#9ece6a',
    teal: '#73daca',
    graphite: '#565f89'
  },

  border: '#3b4261',
  borderFocus: '#7aa2f7',
  heading: '#89ddff',
  statusBg: '#292e42',
  statusText: '#c0caf5',

  me: '#7aa2f7',
  system: '#565f89',
  routine: '#bb9af7',
  working: '#e0af68',
  waiting: '#ff007c',
  done: '#9ece6a',
  danger: '#f7768e',
  warn: '#ff9e64',
  ok: '#9ece6a',

  bar: '#7aa2f7',
  barTrack: '#292e42',
  step: '#565f89',
  placeholder: '#565f89'
}
