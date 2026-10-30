// The theme registry (spec §2.7). Palettes are data files under ./palettes; the
// glob means adding a theme is adding one file, with nothing to register and no
// index for two people to edit at once.
import type { Theme, ThemeKind } from './types'

export type { Theme, ThemeKind } from './types'
export { THEME_TOKENS } from './types'

const found = import.meta.glob<{ theme: Theme }>('./palettes/*.ts', { eager: true })

export const THEMES: Theme[] = Object.values(found)
  .map((m) => m.theme)
  .filter((t): t is Theme => !!t?.name)
  .sort((a, b) => a.name.localeCompare(b.name))

export const FALLBACK_THEME = 'catppuccin-mocha'

export const themeNames = (): string[] => THEMES.map((t) => t.name)

export const themesOfKind = (kind: ThemeKind): Theme[] => THEMES.filter((t) => t.kind === kind)

// An unknown name is not an error: a config written by a newer build, or a typo
// on the command line, falls back to the default and says so through the caller.
export function findTheme(name: string | undefined): Theme {
  const byName = THEMES.find((t) => t.name === name)
  if (byName) return byName
  return THEMES.find((t) => t.name === FALLBACK_THEME) ?? THEMES[0]!
}

export const hasTheme = (name: string): boolean => THEMES.some((t) => t.name === name)
