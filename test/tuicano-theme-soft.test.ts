// The soft-themes batch: ten more palettes, added as data files only. The glob in
// the registry is the whole point, so this pins both that each file is complete
// and well-formed and that adding one needed no edit to the index.
import { describe, expect, it } from 'vitest'
import { findTheme, themeNames } from '../src/tuicano/theme'
import { THEME_TOKENS } from '../src/tuicano/theme/types'
import type { Theme } from '../src/tuicano/theme/types'
import { theme as catppuccinLatte } from '../src/tuicano/theme/palettes/catppuccin-latte'
import { theme as catppuccinFrappe } from '../src/tuicano/theme/palettes/catppuccin-frappe'
import { theme as catppuccinMacchiato } from '../src/tuicano/theme/palettes/catppuccin-macchiato'
import { theme as kanagawaWave } from '../src/tuicano/theme/palettes/kanagawa-wave'
import { theme as kanagawaDragon } from '../src/tuicano/theme/palettes/kanagawa-dragon'
import { theme as kanagawaLotus } from '../src/tuicano/theme/palettes/kanagawa-lotus'
import { theme as dracula } from '../src/tuicano/theme/palettes/dracula'
import { theme as darcula } from '../src/tuicano/theme/palettes/darcula'
import { theme as nord } from '../src/tuicano/theme/palettes/nord'
import { theme as tokyoNight } from '../src/tuicano/theme/palettes/tokyo-night'

const HEX = /^#[0-9a-f]{6}$/
const AGENT_KEYS = ['sky', 'indigo', 'violet', 'rose', 'amber', 'green', 'teal', 'graphite'] as const

// The file each palette must live in, and the kind it declares.
const PALETTES: { name: string; kind: Theme['kind']; theme: Theme }[] = [
  { name: 'catppuccin-latte', kind: 'light', theme: catppuccinLatte },
  { name: 'catppuccin-frappe', kind: 'dark', theme: catppuccinFrappe },
  { name: 'catppuccin-macchiato', kind: 'dark', theme: catppuccinMacchiato },
  { name: 'kanagawa-wave', kind: 'dark', theme: kanagawaWave },
  { name: 'kanagawa-dragon', kind: 'dark', theme: kanagawaDragon },
  { name: 'kanagawa-lotus', kind: 'light', theme: kanagawaLotus },
  { name: 'dracula', kind: 'dark', theme: dracula },
  { name: 'darcula', kind: 'dark', theme: darcula },
  { name: 'nord', kind: 'dark', theme: nord },
  { name: 'tokyo-night', kind: 'dark', theme: tokyoNight }
]

describe.each(PALETTES)('$name', ({ name, kind, theme }) => {
  it('fills every token with a #rrggbb colour', () => {
    for (const token of THEME_TOKENS) {
      const value = theme[token]
      expect(typeof value, token).toBe('string')
      expect(value, token).toMatch(HEX)
    }
  })

  it('has exactly the eight agent colours, each a hex', () => {
    expect(Object.keys(theme.agent).sort()).toEqual([...AGENT_KEYS].sort())
    for (const key of AGENT_KEYS) expect(theme.agent[key], key).toMatch(HEX)
  })

  it('names itself after its file and declares its kind', () => {
    expect(theme.name).toBe(name)
    expect(theme.kind).toBe(kind)
  })

  it('keeps the ink apart where a clash would be a bug', () => {
    expect(theme.text).not.toBe(theme.border)
    expect(theme.text).not.toBe(theme.barTrack)
    expect(theme.accent).not.toBe(theme.danger)
    expect(theme.onAccent).not.toBe(theme.text)
  })

  it('is picked up by the glob, so nothing had to be registered by hand', () => {
    expect(themeNames()).toContain(name)
    expect(findTheme(name).name).toBe(name)
  })
})
