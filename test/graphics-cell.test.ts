import { describe, expect, it } from 'vitest'
import { cellSize, parseWindowSizeReport, parseWinsize } from '../src/tuicano/graphics/cell'

describe('parseWindowSizeReport', () => {
  it('reads the reply to CSI 14 t, wherever it sits in the buffer', () => {
    expect(parseWindowSizeReport('\x1b[4;480;1280t')).toEqual({ widthPx: 1280, heightPx: 480 })
    expect(parseWindowSizeReport('\x1b]11;rgb:0000/0000/0000\x07\x1b[4;600;800t\x1b[6n')).toEqual({ widthPx: 800, heightPx: 600 })
  })

  it('rejects garbage and zeroes', () => {
    expect(parseWindowSizeReport('')).toBeNull()
    expect(parseWindowSizeReport('\x1b[4;0;0t')).toBeNull()
    expect(parseWindowSizeReport('\x1b[4;x;yt')).toBeNull()
    expect(parseWindowSizeReport('no reply here')).toBeNull()
  })
})

describe('parseWinsize', () => {
  it('reads the four little-endian uint16 fields in struct order', () => {
    const b = new Uint8Array(8)
    const dv = new DataView(b.buffer)
    dv.setUint16(0, 24, true) // rows
    dv.setUint16(2, 80, true) // cols
    dv.setUint16(4, 1280, true) // xpixel
    dv.setUint16(6, 480, true) // ypixel
    expect(parseWinsize(b)).toEqual({ cols: 80, rows: 24, pxW: 1280, pxH: 480 })
  })
})

describe('cellSize', () => {
  it('divides the pixels by the grid', () => {
    expect(cellSize({ cols: 80, rows: 24, pxW: 1280, pxH: 480 })).toEqual({ cols: 80, rows: 24, pxW: 16, pxH: 20 })
  })

  it('falls back to 8x16 when the terminal reports no pixels, and never returns 0', () => {
    expect(cellSize({ cols: 80, rows: 24, pxW: 0, pxH: 0 })).toEqual({ cols: 80, rows: 24, pxW: 8, pxH: 16 })
    const c = cellSize({ cols: 0, rows: 0, pxW: 0, pxH: 0 })
    expect(c.cols).toBe(1)
    expect(c.rows).toBe(1)
    expect(c.pxW).toBeGreaterThanOrEqual(1)
    expect(c.pxH).toBeGreaterThanOrEqual(1)
  })
})
