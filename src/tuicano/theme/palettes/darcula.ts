// JetBrains' Darcula, the IDE scheme. It is not published as a terminal palette,
// so these are the scheme's known values, approximated where the IDE has no token
// (there is no pink, so `waiting` uses a matching mauve).
import type { Theme } from '../types'

export const theme: Theme = {
  name: 'darcula',
  kind: 'dark',
  origin: 'Darcula (JetBrains), approximated',
  text: '#a9b7c6',
  dim: '#808080',
  faint: '#606366',
  onAccent: '#2b2b2b',

  // The keyword orange is the warm brand tone; the number blue is the contrast.
  accent: '#cc7832',
  accentAlt: '#6897bb',

  agent: {
    sky: '#6897bb',
    indigo: '#214283',
    violet: '#9876aa',
    rose: '#ff6b68',
    amber: '#ffc66d',
    green: '#6a8759',
    teal: '#629755',
    graphite: '#808080'
  },

  border: '#3c3f41',
  borderFocus: '#6897bb',
  heading: '#ffc66d',
  statusBg: '#3c3f41',
  statusText: '#a9b7c6',

  me: '#6897bb',
  system: '#808080',
  routine: '#9876aa',
  working: '#ffc66d',
  waiting: '#c77dbb',
  done: '#6a8759',
  danger: '#ff6b68',
  warn: '#cc7832',
  ok: '#6a8759',

  bar: '#6897bb',
  barTrack: '#3c3f41',
  step: '#606366',
  placeholder: '#606366'
}
