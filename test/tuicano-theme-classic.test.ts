// The eight classic palettes (spec §2.7): same shape as catppuccin-mocha, mapped onto
// the semantic tokens, and picked up by the palette glob with nothing to register.
// Pinned here so a missing token or a colliding value fails loudly.
import { describe, expect, it } from 'vitest'
import { THEME_TOKENS, type Theme } from '../src/tuicano/theme/types'
import { findTheme, themeNames } from '../src/tuicano/theme/index'
import { theme as everforestDark } from '../src/tuicano/theme/palettes/everforest-dark'
import { theme as gruvboxDarkHard } from '../src/tuicano/theme/palettes/gruvbox-dark-hard'
import { theme as gruvboxLight } from '../src/tuicano/theme/palettes/gruvbox-light'
import { theme as oneDark } from '../src/tuicano/theme/palettes/one-dark'
import { theme as rosePine } from '../src/tuicano/theme/palettes/rose-pine'
import { theme as rosePineMoon } from '../src/tuicano/theme/palettes/rose-pine-moon'
import { theme as solarizedDark } from '../src/tuicano/theme/palettes/solarized-dark'
import { theme as solarizedLight } from '../src/tuicano/theme/palettes/solarized-light'

const HEX = /^#[0-9a-f]{6}$/
const AGENT_COLORS = ['sky', 'indigo', 'violet', 'rose', 'amber', 'green', 'teal', 'graphite'] as const

const palettes: Array<[string, Theme, 'dark' | 'light']> = [
  ['everforest-dark', everforestDark, 'dark'],
  ['gruvbox-dark-hard', gruvboxDarkHard, 'dark'],
  ['gruvbox-light', gruvboxLight, 'light'],
  ['one-dark', oneDark, 'dark'],
  ['rose-pine', rosePine, 'dark'],
  ['rose-pine-moon', rosePineMoon, 'dark'],
  ['solarized-dark', solarizedDark, 'dark'],
  ['solarized-light', solarizedLight, 'light']
]

describe('the classic palettes', () => {
  for (const [name, theme, kind] of palettes) {
    describe(name, () => {
      it('gives every semantic token a #rrggbb hex', () => {
        for (const token of THEME_TOKENS) {
          expect(typeof theme[token], token).toBe('string')
          expect(theme[token], token).toMatch(HEX)
        }
      })

      it('names the eight agent colours', () => {
        expect(Object.keys(theme.agent).sort()).toEqual([...AGENT_COLORS].sort())
        for (const color of AGENT_COLORS) expect(theme.agent[color], color).toMatch(HEX)
      })

      it('identifies itself and its kind', () => {
        expect(theme.name).toBe(name)
        expect(theme.kind).toBe(kind)
        expect(theme.origin.length).toBeGreaterThan(0)
      })

      it('keeps ink and surfaces apart so the accent stays readable', () => {
        expect(theme.text).not.toBe(theme.border)
        expect(theme.text).not.toBe(theme.barTrack)
        expect(theme.accent).not.toBe(theme.danger)
        expect(theme.onAccent).not.toBe(theme.text)
      })

      it('is registered by the glob, with nothing to register', () => {
        expect(themeNames()).toContain(name)
        expect(findTheme(name).name).toBe(name)
      })
    })
  }
})
