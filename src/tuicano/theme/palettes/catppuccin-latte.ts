// Catppuccin Latte (https://catppuccin.com/palette), the light one; same shape and
// token names as the reference, so it drops into the registry with nothing to edit.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'catppuccin-latte',
  kind: 'light',
  origin: 'Catppuccin Latte',
  text: '#4c4f69',
  dim: '#6c6f85',
  faint: '#9ca0b0',
  onAccent: '#eff1f5',

  // Latte is light, so `onAccent` is its pale base; the toucan's peach still
  // carries the brand, and blue is the second tone.
  accent: '#fe640b',
  accentAlt: '#1e66f5',

  agent: {
    sky: '#04a5e5',
    indigo: '#1e66f5',
    violet: '#8839ef',
    rose: '#ea76cb',
    amber: '#df8e1d',
    green: '#40a02b',
    teal: '#179299',
    graphite: '#8c8fa1'
  },

  border: '#bcc0cc',
  borderFocus: '#1e66f5',
  heading: '#7287fd',
  statusBg: '#ccd0da',
  statusText: '#4c4f69',

  me: '#1e66f5',
  system: '#8c8fa1',
  routine: '#8839ef',
  working: '#df8e1d',
  waiting: '#ea76cb',
  done: '#40a02b',
  danger: '#d20f39',
  warn: '#fe640b',
  ok: '#40a02b',

  bar: '#1e66f5',
  barTrack: '#ccd0da',
  step: '#9ca0b0',
  placeholder: '#9ca0b0'
}
