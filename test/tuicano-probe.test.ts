// The probe (spec §2.2) has two obligations that are easy to get wrong and
// invisible when wrong: it must answer within a bound when nothing ever answers,
// and it must give the tty back. A resumed tty is a live handle, so forgetting the
// second one hangs the *process* after a mode that only wanted a cell size.
import { describe, expect, it } from 'vitest'
import { probeCell } from '../src/tuicano/graphics/probe'

interface Fake {
  isTTY: boolean
  columns: number
  rows: number
  raw: boolean[]
  resumed: number
  paused: number
  written: string[]
  listeners: number
  answer(text: string): void
  setRawMode(v: boolean): void
  on(_e: string, cb: (c: Buffer) => void): void
  off(_e: string, cb: (c: Buffer) => void): void
  resume(): void
  pause(): void
  write(s: string): void
}

function stream(tty = true): Fake {
  const handlers: ((c: Buffer) => void)[] = []
  return {
    isTTY: tty,
    columns: 100,
    rows: 40,
    raw: [],
    resumed: 0,
    paused: 0,
    written: [],
    listeners: 0,
    answer(text) {
      for (const h of [...handlers]) h(Buffer.from(text, 'utf8'))
    },
    setRawMode(v) {
      this.raw.push(v)
    },
    on(_e, cb) {
      handlers.push(cb)
      this.listeners = handlers.length
    },
    off(_e, cb) {
      const at = handlers.indexOf(cb)
      if (at >= 0) handlers.splice(at, 1)
      this.listeners = handlers.length
    },
    resume() {
      this.resumed++
    },
    pause() {
      this.paused++
    },
    write(s) {
      this.written.push(s)
    }
  }
}

const read = (f: Fake): NodeJS.ReadStream => f as unknown as NodeJS.ReadStream
const write = (f: Fake): NodeJS.WriteStream => f as unknown as NodeJS.WriteStream

describe('the cell probe', () => {
  it('returns inside the bound when the terminal never answers', async () => {
    const input = stream()
    const output = stream()
    const started = Date.now()
    const cell = await probeCell({ input: read(input), output: write(output), timeoutMs: 60 })
    expect(Date.now() - started).toBeLessThan(500)
    // No pixels: the documented 8x16 fallback, never a zero.
    expect(cell).toEqual({ cols: 100, rows: 40, pxW: 8, pxH: 16 })
    expect(cell.pxW).toBeGreaterThan(0)
  })

  it('gives the tty back: raw mode off, stdin paused, no listener left', async () => {
    const input = stream()
    const output = stream()
    await probeCell({ input: read(input), output: write(output), timeoutMs: 40 })
    expect(input.raw).toEqual([true, false])
    expect(input.paused).toBeGreaterThan(0)
    expect(input.listeners).toBe(0)
  })

  it('uses the pixels when the terminal does answer CSI 14 t', async () => {
    const input = stream()
    const output = stream()
    const answer = (async (): Promise<void> => {
      await new Promise((r) => setTimeout(r, 10))
      input.answer('\x1b[4;990;1665t') // the reply: height, then width
    })()
    const cell = await probeCell({ input: read(input), output: write(output), timeoutMs: 500 })
    await answer
    // 1665/100 and 990/40: a cell is not a whole number of pixels, and the fit
    // math is what rounds for the picture (see test/graphics-fit.test.ts).
    expect(cell).toEqual({ cols: 100, rows: 40, pxW: 16.65, pxH: 24.75 })
    expect(output.written).toEqual(['\x1b[14t'])
    expect(input.paused).toBeGreaterThan(0)
  })

  it('asks nothing when there is no tty, and still answers', async () => {
    const input = stream(false)
    const output = stream(false)
    const cell = await probeCell({ input: read(input), output: write(output) })
    expect(cell).toEqual({ cols: 100, rows: 40, pxW: 8, pxH: 16 })
    expect(output.written).toEqual([])
    expect(input.resumed).toBe(0)
  })
})
