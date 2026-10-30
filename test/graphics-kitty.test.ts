import { describe, expect, it } from 'vitest'
import { kittyImage, kittyRaster } from '../src/tuicano/graphics/kitty'
import type { Picture, Raster } from '../src/tuicano/graphics/types'

const pic = (bytes: Uint8Array, mime: Picture['mime'] = 'image/png'): Picture => ({ bytes, mime, width: 1, height: 1 })
const place = { cols: 3, rows: 2, pxW: 24, pxH: 32 }

describe('kittyImage', () => {
  it('passes a 1x1 PNG through unchanged, exact bytes', () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])
    const b64 = Buffer.from(png).toString('base64')
    expect(kittyImage(pic(png), place)).toBe(`\x1b_Ga=T,f=100,c=3,r=2,q=2,C=1,m=0;${b64}\x1b\\`)
  })

  it('refuses a JPEG with a clear error', () => {
    expect(() => kittyImage(pic(Uint8Array.from([1]), 'image/jpeg'), place)).toThrow(/kittyRaster/)
  })
})

describe('kittyRaster', () => {
  it('sends raw RGBA at its own pixel size; C follows moveCursor', () => {
    const raster: Raster = { data: Uint8Array.from([0, 0, 0, 255]), width: 1, height: 1 }
    const b64 = Buffer.from(raster.data).toString('base64')
    expect(kittyRaster(raster, place)).toBe(`\x1b_Ga=T,f=32,s=1,v=1,c=3,r=2,q=2,C=1,m=0;${b64}\x1b\\`)
    expect(kittyRaster(raster, place, { moveCursor: true })).toBe(`\x1b_Ga=T,f=32,s=1,v=1,c=3,r=2,q=2,C=0,m=0;${b64}\x1b\\`)
  })
})

describe('kitty chunking', () => {
  it('splits large payloads on 4096-char boundaries, keys only on the first chunk', () => {
    const bytes = new Uint8Array(4000).fill(7)
    const out = kittyImage(pic(bytes), place)
    const chunks = out.split('\x1b_G').slice(1)
    expect(chunks.length).toBeGreaterThan(1)

    const payloads = chunks.map((c) => c.slice(c.indexOf(';') + 1, -2))
    for (const c of chunks) expect(c.endsWith('\x1b\\')).toBe(true)
    expect(chunks[0]).toContain('a=T,f=100') // only the first carries the keys
    for (const c of chunks.slice(1)) expect(c.startsWith('m=')).toBe(true)
    for (const c of chunks.slice(0, -1)) expect(c).toContain('m=1;')
    expect(chunks.at(-1)).toContain('m=0;')
    for (const p of payloads) expect(p.length).toBeLessThanOrEqual(4096)
    expect(Buffer.from(payloads.join(''), 'base64').equals(Buffer.from(bytes))).toBe(true)
  })

  it('a payload of exactly 3072 bytes is a single chunk with m=0', () => {
    const bytes = new Uint8Array(3072).fill(1) // -> exactly 4096 base64 chars
    const out = kittyImage(pic(bytes), place)
    expect(out.match(/\x1b_G/g)!.length).toBe(1)
    expect(out).toContain('m=0;')
  })
})
