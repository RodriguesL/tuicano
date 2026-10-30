// Where a client's data lives (spec §4.7). The app and the terminal have to mean
// the same folder by default, or "the team" is two teams: the Electron app uses
// the platform's application-data directory plus the app name, and this is the
// same path, resolved without pulling in a dependency for it.
//
// Electron's `app.getPath('appData')` is exactly what `appData()` returns below,
// and `app.setName('Tucano')` is what makes the folder `Tucano`. One caveat worth
// knowing: run from the code, the app deliberately uses `Tucano Dev` instead, so a
// development window and a terminal are two folders unless one is pointed at the
// other (`--data` or `TUCANO_DATA`).
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export const APP_NAME = 'Tucano'

export function appData(): string {
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support')
  if (process.platform === 'win32') return process.env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming')
  return process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config')
}

export const defaultDataDir = (): string => join(appData(), APP_NAME)

// Precedence: the flag, then the environment, then the app's own folder. The flag
// wins over the environment because a person typing `--data` means it; the
// environment is how the app hands the folder to the core it spawns.
export function resolveDataDir(argv: string[], env: Record<string, string | undefined> = process.env): string {
  const at = argv.findIndex((a) => a === '--data' || a.startsWith('--data='))
  const fromFlag = at < 0 ? undefined : argv[at]!.includes('=') ? argv[at]!.slice('--data='.length) : argv[at + 1]
  if (fromFlag) return resolve(fromFlag)
  const fromEnv = env['TUCANO_DATA']
  return fromEnv ? resolve(fromEnv) : defaultDataDir()
}
