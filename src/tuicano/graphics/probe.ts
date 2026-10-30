// How big is one cell, in pixels (spec §2.2). Node's tty has no access to the
// winsize struct's ws_xpixel/ws_ypixel, so the terminal is asked: CSI 14 t makes
// it report the window in pixels. Asked once, before Ink takes the terminal over,
// with a short budget — a terminal that does not answer must not hold up the app.
import { cellSize, parseWindowSizeReport } from './cell'
import type { Cell } from './types'

const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24

export interface ProbeStreams {
  input: NodeJS.ReadStream
  output: NodeJS.WriteStream
  timeoutMs?: number
}

export async function probeCell({ input, output, timeoutMs = 120 }: ProbeStreams): Promise<Cell> {
  const cols = output.columns || DEFAULT_COLS
  const rows = output.rows || DEFAULT_ROWS
  const blind = (): Cell => cellSize({ cols, rows, pxW: 0, pxH: 0 })
  if (!input.isTTY || !output.isTTY) return blind()
  const reply = await new Promise<string | null>((resolve) => {
    let seen = ''
    const done = (v: string | null): void => {
      clearTimeout(timer)
      input.off('data', onData)
      try {
        input.setRawMode(false)
      } catch {
        // Not a tty after all: nothing to restore.
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
