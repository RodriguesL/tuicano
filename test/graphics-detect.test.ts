import { describe, expect, it } from 'vitest'
import { detectProtocol, parseGraphicsFlag } from '../src/tuicano/graphics/detect'

describe('detectProtocol', () => {
  it('reads the protocol out of the environment, kitty first', () => {
    const base = { TERM: 'xterm-256color' } // a neutral TERM: not dumb, empty, kitty or sixel
    const cases: [Record<string, string | undefined>, string][] = [
      [{ TERM: 'xterm-256color', KITTY_WINDOW_ID: '1' }, 'kitty'], // KITTY_WINDOW_ID alone is enough
      [{ TERM: 'xterm-kitty' }, 'kitty'],
      [{ ...base, TERM_PROGRAM: 'ghostty' }, 'kitty'],
      [{ TERM: 'xterm-ghostty' }, 'kitty'],
      [{ ...base, TERM_PROGRAM: 'WezTerm' }, 'kitty'], // kitty beats WezTerm's own iTerm2 support
      [{ ...base, TERM_PROGRAM: 'iTerm.app' }, 'iterm2'],
      [{ ...base, ITERM_SESSION_ID: 'w0t0p0' }, 'iterm2'],
      [{ ...base, TERM_PROGRAM: 'vscode' }, 'iterm2'],
      [{ ...base, TERM_PROGRAM: 'Hyper' }, 'iterm2'],
      [{ TERM: 'xterm-256color' }, 'none'],
      [{ ...base, TERM_PROGRAM: 'Apple_Terminal' }, 'none'], // no OSC 1337
      [{ TERM: 'xterm-sixel' }, 'sixel'],
      [{ TERM: 'foot' }, 'sixel'],
      [{ TERM: 'foot-extra' }, 'sixel'],
      [{ TERM: 'mlterm' }, 'sixel'],
      [{ TERM: 'yaft-256color' }, 'sixel'],
      [{ ...base, TERM_PROGRAM: 'MacTerm' }, 'sixel'],
      [{ TERM: 'dumb' }, 'none'],
      [{ TERM: '' }, 'none'],
      [{}, 'none']
    ]
    for (const [env, want] of cases) expect(detectProtocol({ env }), JSON.stringify(env)).toBe(want)
  })

  it('an explicit override beats detection, including none over kitty', () => {
    expect(detectProtocol({ override: 'none', env: { TERM: 'xterm-kitty', KITTY_WINDOW_ID: '1' } })).toBe('none')
    expect(detectProtocol({ override: 'sixel', env: { TERM: 'dumb' } })).toBe('sixel')
    expect(detectProtocol({ override: 'auto', env: { TERM: 'xterm-kitty' } })).toBe('kitty')
    expect(detectProtocol({ override: 'iterm2', env: {} })).toBe('iterm2')
  })

  // Inside a multiplexer the picture can only travel the way the multiplexer
  // relays it: kitty through herdr's own pane output, nothing at all under tmux
  // until a passthrough lands.
  it('inside herdr: kitty when the outer terminal speaks it, text otherwise', () => {
    expect(detectProtocol({ env: { TERM: 'xterm-kitty', HERDR_ENV: '1' } })).toBe('kitty')
    expect(detectProtocol({ env: { TERM: 'xterm-256color', HERDR_ENV: '1', KITTY_WINDOW_ID: '1' } })).toBe('kitty')
    expect(detectProtocol({ env: { TERM: 'xterm-256color', HERDR_SOCKET_PATH: '/tmp/h.sock' } })).toBe('none')
    // iTerm2 and sixel are for a bare terminal: herdr does not relay them, even
    // when the outer terminal would have spoken them happily.
    expect(detectProtocol({ env: { TERM: 'xterm-256color', HERDR_ENV: '1', TERM_PROGRAM: 'iTerm.app' } })).toBe('none')
    expect(detectProtocol({ env: { TERM: 'foot', HERDR_ENV: '1' } })).toBe('none')
  })

  it('inside tmux: text mode, because the protocols need a passthrough we do not do yet', () => {
    expect(detectProtocol({ env: { TERM: 'screen-256color', TMUX: '/tmp/tmux-501/default,1,0' } })).toBe('none')
    expect(detectProtocol({ env: { TERM: 'xterm-kitty', KITTY_WINDOW_ID: '1', TMUX: '/tmp/x' } })).toBe('none')
  })

  it('an explicit --graphics still wins inside herdr and tmux', () => {
    expect(detectProtocol({ override: 'sixel', env: { TERM: 'screen-256color', TMUX: '/tmp/x' } })).toBe('sixel')
    expect(detectProtocol({ override: 'none', env: { TERM: 'xterm-kitty', HERDR_ENV: '1' } })).toBe('none')
  })
})

describe('parseGraphicsFlag', () => {
  it('reads both spellings and rejects nonsense', () => {
    expect(parseGraphicsFlag(['--graphics=kitty'])).toBe('kitty')
    expect(parseGraphicsFlag(['--graphics', 'sixel'])).toBe('sixel')
    expect(parseGraphicsFlag(['x', '--graphics=none'])).toBe('none')
    expect(parseGraphicsFlag(['--graphics=auto'])).toBe('auto')
    expect(parseGraphicsFlag(['--graphics=nope'])).toBeUndefined()
    expect(parseGraphicsFlag(['--graphics'])).toBeUndefined()
    expect(parseGraphicsFlag([])).toBeUndefined()
  })
})
