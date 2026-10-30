// How big is one cell, in pixels (spec §2.2). Node's tty has no access to the
// winsize struct's ws_xpixel/ws_ypixel, so the terminal is asked: CSI 14 t makes
// it report the window in pixels.
//
// Silence is always possible, and it is the normal case under a multiplexer or a
// pipe, so two rules hold here: the wait is hard-bounded (a few hundred ms at the
// outside), and the tty is handed back exactly as it was found. The second one is
// the subtle one — a resumed tty is a live handle, so leaving it resumed hangs the
// *process* after a mode that only wanted a cell size, long after this promise
// resolved (that bug cost a 3.5-minute `S+` on `--graphics-info`).
import { cellSize, parseWindowSizeReport } from './cell'
import type { Cell } from './types'

const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24
const DEFAULT_MS = 200

export interface ProbeStreams {
  input: NodeJS.ReadStream
  output: NodeJS.WriteStream
  timeoutMs?: number
}

export async function probeCell({ input, output, timeoutMs = DEFAULT_MS }: ProbeStreams): Promise<Cell> {
  const cols = output.columns || DEFAULT_COLS
  const rows = output.rows || DEFAULT_ROWS
  const blind = (): Cell => cellSize({ cols, rows, pxW: 0, pxH: 0 })
  if (!input.isTTY || !output.isTTY) return blind()
  const reply = await new Promise<string | null>((resolve) => {
    let seen = ''
    let settled = false
    const done = (v: string | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      input.off('data', onData)
      try {
        input.setRawMode(false)
      } catch {
        // Not a tty after all: nothing to restore.
      }
      try {
        // Paused, not unref'd: paused is how a stream stops holding the event loop
        // open without Ink losing a stdin it will resume itself.
        input.pause()
      } catch {
        // Already gone.
      }
      resolve(v)
    }
    const onData = (chunk: Buffer): void => {
      seen += chunk.toString('utf8')
      if (parseWindowSizeReport(seen)) done(seen)
    }
    const timer = setTimeout(() => done(null), timeoutMs)
    try {
      input.setRawMode(true)
    } catch {
      return done(null)
    }
    input.on('data', onData)
    input.resume()
    output.write('\x1b[14t')
  })
  const pixels = reply ? parseWindowSizeReport(reply) : null
  return cellSize({ cols, rows, pxW: pixels?.widthPx ?? 0, pxH: pixels?.heightPx ?? 0 })
}
