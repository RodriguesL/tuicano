// Dracula (https://draculatheme.com), the official palette; the classic night
// background with the neon cyan/pink/purple accents.
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'dracula',
  kind: 'dark',
  origin: 'Dracula',
  text: '#f8f8f2',
  dim: '#6272a4',
  faint: '#6272a4',
  onAccent: '#282a36',

  // Dracula's warm tone is the orange; purple is the cool contrast.
  accent: '#ffb86c',
  accentAlt: '#bd93f9',

  agent: {
    sky: '#8be9fd',
    indigo: '#6272a4',
    violet: '#bd93f9',
    rose: '#ff79c6',
    amber: '#f1fa8c',
    green: '#50fa7b',
    // Dracula has a single cyan; teal takes its brighter variant so the eight
    // stay distinct.
    teal: '#9aedfe',
    graphite: '#44475a'
  },

  // Dracula's "blue" is purple, so the focused border and the cool tone agree.
  border: '#44475a',
  borderFocus: '#bd93f9',
  heading: '#8be9fd',
  statusBg: '#44475a',
  statusText: '#f8f8f2',

  me: '#bd93f9',
  system: '#6272a4',
  routine: '#bd93f9',
  working: '#f1fa8c',
  waiting: '#ff79c6',
  done: '#50fa7b',
  danger: '#ff5555',
  warn: '#ffb86c',
  ok: '#50fa7b',

  bar: '#bd93f9',
  barTrack: '#44475a',
  step: '#6272a4',
  placeholder: '#6272a4'
}
