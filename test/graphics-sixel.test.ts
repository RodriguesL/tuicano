import { describe, expect, it } from 'vitest'
import { PALETTE, quantize, sixelImage } from '../src/tuicano/graphics/sixel'
import type { Raster } from '../src/tuicano/graphics/types'

describe('palette', () => {
  it('is a 6x6x6 cube then 24 greys, in that order', () => {
    expect(PALETTE.length).toBe(240 * 3)
    expect([PALETTE[0], PALETTE[1], PALETTE[2]]).toEqual([0, 0, 0]) // index 0
    expect([PALETTE[180 * 3], PALETTE[180 * 3 + 1], PALETTE[180 * 3 + 2]]).toEqual([255, 0, 0]) // pure red
    expect([PALETTE[215 * 3], PALETTE[215 * 3 + 1], PALETTE[215 * 3 + 2]]).toEqual([255, 255, 255]) // white
    expect([PALETTE[216 * 3], PALETTE[216 * 3 + 1], PALETTE[216 * 3 + 2]]).toEqual([0, 0, 0]) // first grey
    expect([PALETTE[239 * 3], PALETTE[239 * 3 + 1], PALETTE[239 * 3 + 2]]).toEqual([255, 255, 255]) // last grey
  })
})

describe('quantize', () => {
  it('maps exact colours to their cube index, one byte per pixel', () => {
    const rgba = Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255])
    expect([...quantize(rgba)]).toEqual([180, 30, 5, 215])
  })
})

describe('sixelImage', () => {
  it('exact introducer, attributes, definitions and bands for a known 2x2', () => {
    // row-major: red, green / blue, white
    const data = Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255])
    const raster: Raster = { data, width: 2, height: 2 }
    const defs = '#5;2;0;0;100#30;2;0;100;0#180;2;100;0;0#215;2;100;100;100'
    expect(sixelImage(raster, { cols: 2, rows: 2, pxW: 2, pxH: 2 })).toBe(`\x1bPq"1;1;2;2${defs}A?$?@$@?$?A-\x1b\\`)
  })

  it('pads the last band for an odd height', () => {
    // 1 column, 7 rows, all pure red: band two is only one row deep.
    const data = new Uint8Array(1 * 7 * 4)
    for (let i = 0; i < 7; i++) {
      data[i * 4] = 255
      data[i * 4 + 3] = 255
    }
    const raster: Raster = { data, width: 1, height: 7 }
    // band 1: six rows on -> 0x3F+0x3F = '~'; band 2: one row -> 0x3F+1 = '@'
    expect(sixelImage(raster, { cols: 1, rows: 1, pxW: 1, pxH: 7 })).toBe('\x1bPq"1;1;1;7#180;2;100;0;0~-@-\x1b\\')
  })
})
