import { describe, expect, it } from 'vitest'
import { fit } from '../src/tuicano/graphics/fit'

const cell = { cols: 80, rows: 24, pxW: 8, pxH: 16 }
const area = { cols: 80, rows: 24 }

describe('fit', () => {
  it('fits a square picture square on screen, not stretched by the 1:2 cell', () => {
    const p = fit({ width: 800, height: 800 }, cell, area)
    expect(p.cols / p.rows).toBeCloseTo(cell.pxH / cell.pxW, 5) // cols/rows ~ 2 => square on screen
    expect(p.cols * cell.pxW).toBeCloseTo(p.rows * cell.pxH, 5)
    expect(p.pxW).toBe(p.pxH)
  })

  it('fits landscape and portrait into wide and tall areas without overflowing', () => {
    const land = fit({ width: 1600, height: 800 }, cell, area)
    expect(land.cols).toBeLessThanOrEqual(80)
    expect(land.rows).toBeLessThanOrEqual(24)
    expect(land.pxW / land.pxH).toBeCloseTo(2, 1)

    const tall = fit({ width: 800, height: 1600 }, cell, { cols: 20, rows: 50 })
    expect(tall.cols).toBeLessThanOrEqual(20)
    expect(tall.rows).toBeLessThanOrEqual(50)
  })

  it('never upscales past the picture pixels', () => {
    const p = fit({ width: 10, height: 10 }, cell, area)
    expect(p.pxW).toBe(10)
    expect(p.pxH).toBe(10)
  })

  it('gives a 1x1 picture one cell', () => {
    expect(fit({ width: 1, height: 1 }, cell, area)).toEqual({ cols: 1, rows: 1, pxW: 1, pxH: 1 })
  })
})
