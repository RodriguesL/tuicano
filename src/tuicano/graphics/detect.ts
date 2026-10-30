// Which image protocol the terminal speaks (spec §3). Pure environment
// inspection — no probing, no I/O — so the decision is testable. 'none' is the
// text fallback.
import type { Protocol } from './types'

// Inside a multiplexer the picture can only travel the way the multiplexer
// relays it. herdr relays the kitty protocol through the pane's own output and
// manages placement itself (its pane.graphics API is gone), so kitty is the only
// in-herdr path; iTerm2's OSC 1337 and sixel are for a bare terminal. tmux
// needs a passthrough this client does not do yet, so it gets text there.
const kittySpeaks = (env: Record<string, string | undefined>): boolean =>
  env['KITTY_WINDOW_ID'] !== undefined ||
  env['TERM'] === 'xterm-kitty' ||
  env['TERM_PROGRAM'] === 'ghostty' ||
  env['TERM_PROGRAM'] === 'WezTerm' ||
  (env['TERM'] ?? '').startsWith('xterm-ghostty')

export function detectProtocol(opts: { override?: 'auto' | Protocol; env: Record<string, string | undefined> }): Protocol {
  const override = opts.override
  if (override && override !== 'auto') return override

  const env = opts.env
  const term = env['TERM']
  const prog = env['TERM_PROGRAM']
  // A dumb or unset TERM has no graphics of any kind, whatever else is set.
  if (!term || term === 'dumb') return 'none'

  const hosted = env['HERDR_ENV'] === '1' || env['HERDR_SOCKET_PATH'] !== undefined
  if (env['TMUX'] !== undefined) return 'none'
  if (hosted) return kittySpeaks(env) ? 'kitty' : 'none'

  // kitty first: the most capable of the three. WezTerm speaks it too, and we
  // prefer that over WezTerm's iTerm2 support for exactly that reason.
  if (kittySpeaks(env)) return 'kitty'

  // OSC 1337: iTerm.app, vscode and Hyper are known to implement it. Apple's
  // own Terminal.app does not, so it is deliberately absent from this list.
  if (prog === 'iTerm.app' || prog === 'vscode' || prog === 'Hyper' || env['ITERM_SESSION_ID'] !== undefined) return 'iterm2'

  // Sixel: foot, mlterm and MacTerm, or a TERM that names it.
  if (term.includes('sixel') || term === 'foot' || term.startsWith('foot-') || term === 'mlterm' || term.startsWith('yaft-') || prog === 'MacTerm') return 'sixel'

  return 'none'
}

const FLAGS = ['auto', 'kitty', 'iterm2', 'sixel', 'none'] as const

// Reads `--graphics=kitty` and `--graphics kitty`. Anything unknown — including
// a missing value — yields undefined so the caller can complain.
export function parseGraphicsFlag(argv: string[]): 'auto' | Protocol | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    const value = a.startsWith('--graphics=') ? a.slice('--graphics='.length) : a === '--graphics' ? argv[i + 1] : undefined
    if (value === undefined) continue
    return FLAGS.find((f) => f === value)
  }
  return undefined
}
