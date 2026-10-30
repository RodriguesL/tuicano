// The terminal client's own settings (spec §2.7): a small JSON file next to the
// data folder it belongs to. Deliberately not the app's database: the window has
// its own idea of a theme (system/light/dark) and neither renderer should be
// writing the other's preferences into a shared row.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Protocol } from './graphics/types'

export interface TuiConfig {
  /** A theme name; an unknown one falls back to the default. */
  theme?: string
  /** 'auto' or a forced protocol, as --graphics takes. */
  graphics?: 'auto' | Protocol
}

export const configPath = (dataDir: string): string => join(dataDir, 'tuicano.config.json')

// A missing file, or one somebody edited by hand until it broke, is not a reason
// to refuse to start: it reads as empty and the next write fixes it.
export function readConfig(dataDir: string): TuiConfig {
  try {
    const raw = JSON.parse(readFileSync(configPath(dataDir), 'utf8')) as unknown
    if (!raw || typeof raw !== 'object') return {}
    const cfg = raw as TuiConfig
    return { ...(typeof cfg.theme === 'string' ? { theme: cfg.theme } : {}), ...(typeof cfg.graphics === 'string' ? { graphics: cfg.graphics } : {}) }
  } catch {
    return {}
  }
}

export function writeConfig(dataDir: string, patch: TuiConfig): TuiConfig {
  const next = { ...readConfig(dataDir), ...patch }
  try {
    writeFileSync(configPath(dataDir), `${JSON.stringify(next, null, 2)}\n`)
  } catch {
    // Read-only folder: the setting still applies for this run.
  }
  return next
}
