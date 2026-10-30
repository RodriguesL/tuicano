// The theme registry (spec §2.6): palettes are data found by a glob, so the things
// worth pinning are that the glob finds them, that none is half-written, and that a
// bad name degrades instead of throwing.
import { describe, expect, it } from 'vitest'
import { THEMES, THEME_TOKENS, findTheme, hasTheme, themeNames, themesOfKind } from '../src/tuicano/theme'

const HEX = /^#[0-9a-f]{6}$/i

describe('the theme registry', () => {
  it('finds the palettes with nothing registered by hand', () => {
    // Eighteen at the time of writing; the point is that a file dropped into
    // palettes/ shows up here without an index edit.
    expect(THEMES.length).toBeGreaterThanOrEqual(18)
    expect(themeNames()).toContain('catppuccin-mocha')
    expect(themeNames()).toContain('kanagawa-dragon')
    expect(themeNames()).toContain('gruvbox-dark-hard')
  })

  it('has no duplicate names', () => {
    expect(new Set(themeNames()).size).toBe(themeNames().length)
  })

  it('every palette is complete, whatever family it came from', () => {
    for (const theme of THEMES) {
      for (const token of THEME_TOKENS) expect(HEX.test(theme[token]), `${theme.name}.${token} = ${theme[token]}`).toBe(true)
      expect(Object.keys(theme.agent).sort()).toEqual(['amber', 'graphite', 'green', 'indigo', 'rose', 'sky', 'teal', 'violet'])
      for (const [color, hex] of Object.entries(theme.agent)) expect(HEX.test(hex), `${theme.name}.agent.${color}`).toBe(true)
      expect(theme.origin.length).toBeGreaterThan(2)
      expect(['dark', 'light']).toContain(theme.kind)
    }
  })

  it('keeps text and surfaces apart, which is what makes it readable', () => {
    for (const theme of THEMES) {
      expect(theme.text, theme.name).not.toBe(theme.border)
      expect(theme.text, theme.name).not.toBe(theme.barTrack)
      // Text drawn on the accent has to differ from text on the background.
      expect(theme.onAccent, theme.name).not.toBe(theme.text)
      expect(theme.accent, theme.name).not.toBe(theme.danger)
    }
  })

  it('falls back instead of throwing on a name it does not know', () => {
    expect(hasTheme('catppuccin-mocha')).toBe(true)
    expect(hasTheme('nope')).toBe(false)
    expect(findTheme('nope').name).toBe('catppuccin-mocha')
    expect(findTheme(undefined).name).toBe('catppuccin-mocha')
    expect(findTheme('dracula').name).toBe('dracula')
  })

  it('groups by kind for anything that wants to offer light themes', () => {
    expect(themesOfKind('light').map((t) => t.name)).toContain('catppuccin-latte')
    expect(themesOfKind('dark').length).toBeGreaterThan(themesOfKind('light').length)
  })
})
