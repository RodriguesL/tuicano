// One client per data folder (spec §1.4). The core starts SQLite, listens on the
// webhook port and runs routines the moment it is imported, so two clients on one
// folder would race all three — the GUI keeps its own single-instance lock in
// Electron, and this is the terminal's equivalent.
import { closeSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs'
import { join } from 'node:path'

export interface Lock {
  release(): void
}

// A file holding the pid of whoever is in there. A pid that is gone left the
// file behind (a crash, a kill -9), and that is not a reason to refuse to start.
export function acquireLock(dataDir: string): Lock {
  const file = join(dataDir, 'tuicano.lock')
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(file, 'wx')
      writeSync(fd, String(process.pid))
      closeSync(fd)
      const release = (): void => {
        try {
          if (Number(readFileSync(file, 'utf8')) === process.pid) rmSync(file, { force: true })
        } catch {
          // Already gone, or never ours: nothing to do.
        }
      }
      process.on('exit', release)
      process.on('SIGINT', () => process.exit(0))
      process.on('SIGTERM', () => process.exit(0))
      return { release }
    } catch (e) {
      const held = ((): number | undefined => {
        try {
          return Number(readFileSync(file, 'utf8')) || undefined
        } catch {
          return undefined
        }
      })()
      const alive = held !== undefined && held !== process.pid && (() => {
        try {
          process.kill(held, 0)
          return true
        } catch {
          return false
        }
      })()
      if (alive) throw new Error(`another client is using ${dataDir} (pid ${held}). One client per data folder: close it, or point TUCANO_DATA somewhere else.`)
      rmSync(file, { force: true })
      if (attempt === 1) throw new Error(`could not take the lock on ${file}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  throw new Error(`could not take the lock on ${file}`)
}
