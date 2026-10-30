import { deflateSync } from 'node:zlib'
import { encode as jpegEncode } from 'jpeg-js'
import { describe, expect, it } from 'vitest'
import { decode, decodeJpeg, decodePng, resize, type Raster } from '../src/tuicano/graphics/raster'

// --- PNG fixtures, built here so no binary files are committed --------------

const SIG = [137, 80, 78, 71, 13, 10, 26, 10]

function be32(n: number): number[] {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
}

function crc32(buf: number[]): number {
  let c = 0xffffffff
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

// declaredLength lets a test lie about a chunk's size to provoke a truncation.
function chunk(type: string, data: number[], declaredLength = data.length): number[] {
  const typeBytes = [...type].map((c) => c.charCodeAt(0))
  return [...be32(declaredLength), ...typeBytes, ...data, ...be32(crc32([...typeBytes, ...data]))]
}

interface PngOpts {
  width: number
  height: number
  colorType: number
  bitDepth: number
  // Each scanline is already filtered: the bytes that go into IDAT after the
  // filter byte. Tests hand-pick these to prove the reverse filter.
  scanlines: { filter: number; data: number[] }[]
  palette?: number[][]
  trns?: number[]
  interlace?: number
}

function makePng(opts: PngOpts): Uint8Array {
  const flat: number[] = []
  for (const line of opts.scanlines) flat.push(line.filter, ...line.data)
  const ihdr = [...be32(opts.width), ...be32(opts.height), opts.bitDepth, opts.colorType, 0, 0, opts.interlace ?? 0]
  const parts = [...SIG, ...chunk('IHDR', ihdr)]
  if (opts.palette) parts.push(...chunk('PLTE', opts.palette.flat()))
  if (opts.trns) parts.push(...chunk('tRNS', opts.trns))
  parts.push(...chunk('IDAT', [...deflateSync(Uint8Array.from(flat))]))
  parts.push(...chunk('IEND', []))
  return Uint8Array.from(parts)
}

// A scanline of raw bytes, filter 0 (none).
const none = (data: number[]): { filter: number; data: number[] } => ({ filter: 0, data })

describe('decoding PNG', () => {
  it('reads a 2x2 truecolour image to exact RGBA', () => {
    const png = makePng({
      width: 2,
      height: 2,
      colorType: 2,
      bitDepth: 8,
      scanlines: [none([255, 0, 0, 0, 255, 0]), none([0, 0, 255, 255, 255, 255])]
    })
    const r = decodePng(png)
    expect([r.width, r.height]).toEqual([2, 2])
    expect(r.data).toEqual(Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]))
  })

  it('reads greyscale (colour type 0)', () => {
    const png = makePng({ width: 1, height: 2, colorType: 0, bitDepth: 8, scanlines: [none([10]), none([200])] })
    expect(decodePng(png).data).toEqual(Uint8Array.from([10, 10, 10, 255, 200, 200, 200, 255]))
  })

  it('keeps alpha on an RGBA image', () => {
    const png = makePng({ width: 1, height: 1, colorType: 6, bitDepth: 8, scanlines: [none([1, 2, 3, 4])] })
    expect(decodePng(png).data).toEqual(Uint8Array.from([1, 2, 3, 4]))
  })

  it('expands a palette with tRNS alpha', () => {
    const png = makePng({
      width: 2,
      height: 1,
      colorType: 3,
      bitDepth: 8,
      scanlines: [none([0, 1])],
      palette: [
        [255, 0, 0],
        [0, 255, 0]
      ],
      trns: [0, 128]
    })
    expect(decodePng(png).data).toEqual(Uint8Array.from([255, 0, 0, 0, 0, 255, 0, 128]))
  })

  it('down-shifts 16-bit samples to 8 bits', () => {
    const png = makePng({ width: 1, height: 1, colorType: 0, bitDepth: 16, scanlines: [none([0x12, 0x34])] })
    expect(decodePng(png).data).toEqual(Uint8Array.from([0x12, 0x12, 0x12, 255]))
  })

  // One 2x2 RGB image (6 raw bytes per row), filtered differently on its
  // second row. The filtered bytes for row 1 are computed by hand per filter,
  // so a reversed Sub/Up/Average/Paeth decodes to the wrong pixels and fails.
  const raw0 = [10, 20, 30, 40, 50, 60]
  const raw1 = [70, 80, 90, 100, 110, 120]
  const expected = Uint8Array.from([
    10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255
  ])
  const filterCases: [number, number[], string][] = [
    [0, [70, 80, 90, 100, 110, 120], 'none'],
    [1, [70, 80, 90, 30, 30, 30], 'sub'],
    [2, [60, 60, 60, 60, 60, 60], 'up'],
    [3, [65, 70, 75, 45, 45, 45], 'average'],
    [4, [60, 60, 60, 30, 30, 30], 'paeth']
  ]
  for (const [filter, data, name] of filterCases) {
    it(`reverses the ${name} filter (${filter})`, () => {
      const png = makePng({ width: 2, height: 2, colorType: 2, bitDepth: 8, scanlines: [none(raw0), { filter, data }] })
      expect(decodePng(png).data).toEqual(expected)
    })
  }

  it('throws a named error on malformed input', () => {
    expect(() => decodePng(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]))).toThrow(/bad signature/)
    // First chunk is not IHDR.
    const noIhdr = Uint8Array.from([...SIG, ...chunk('IDAT', [1])])
    expect(() => decodePng(noIhdr)).toThrow(/expected IHDR/)
    // IDAT claims more bytes than the file holds.
    const ihdr = [...be32(1), ...be32(1), 8, 2, 0, 0, 0]
    const truncated = Uint8Array.from([...SIG, ...chunk('IHDR', ihdr), ...chunk('IDAT', [1, 2, 3], 1000)])
    expect(() => decodePng(truncated)).toThrow(/truncated/)
    // Adam7 must not be guessed at.
    const interlaced = makePng({ width: 1, height: 1, colorType: 2, bitDepth: 8, scanlines: [none([0, 0, 0])], interlace: 1 })
    expect(() => decodePng(interlaced)).toThrow(/interlac/i)
    // Truecolour has no 1-bit form.
    const badDepth = makePng({ width: 1, height: 1, colorType: 2, bitDepth: 1, scanlines: [none([0])] })
    expect(() => decodePng(badDepth)).toThrow(/bit depth 1/)
  })
})

describe('decoding JPEG', () => {
  const solid = (color: [number, number, number], w: number, h: number, top?: [number, number, number]): Raster => {
    const data = new Uint8Array(w * h * 4)
    for (let y = 0; y < h; y++) {
      const [r, g, b] = top && y < h / 2 ? top : color
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4
        data[p] = r
        data[p + 1] = g
        data[p + 2] = b
        data[p + 3] = 255
      }
    }
    return { data, width: w, height: h }
  }
  const roundTrip = (r: Raster): Raster => decodeJpeg(new Uint8Array(jpegEncode(r, 100).data))

  it('decodes a solid colour back nearly exact (JPEG is lossy, so a tolerance)', () => {
    const out = roundTrip(solid([200, 50, 25], 8, 8))
    expect([out.width, out.height]).toEqual([8, 8])
    for (const p of [0, (4 * 8 + 4) * 4]) {
      expect(Math.abs(out.data[p]! - 200)).toBeLessThanOrEqual(8)
      expect(Math.abs(out.data[p + 1]! - 50)).toBeLessThanOrEqual(8)
      expect(Math.abs(out.data[p + 2]! - 25)).toBeLessThanOrEqual(8)
      expect(out.data[p + 3]).toBe(255)
    }
  })

  it('decodes two colours distinctly', () => {
    const out = roundTrip(solid([30, 30, 220], 8, 8, [220, 30, 30]))
    const top = (1 * 8 + 4) * 4
    const bottom = (6 * 8 + 4) * 4
    expect(out.data[top]).toBeGreaterThan(180) // red top
    expect(out.data[top + 2]).toBeLessThan(80)
    expect(out.data[bottom + 2]).toBeGreaterThan(180) // blue bottom
    expect(out.data[bottom]).toBeLessThan(80)
  })

  it('throws a named error on non-JPEG bytes', () => {
    expect(() => decodeJpeg(Uint8Array.from([1, 2, 3, 4, 5]))).toThrow(/JPEG/)
  })
})

describe('resizing', () => {
  // R = column * 16, G = row * 16, alpha opaque: 2x2 box averages are exact.
  const gradient = (): Raster => {
    const data = new Uint8Array(4 * 4 * 4)
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const p = (y * 4 + x) * 4
        data[p] = x * 16
        data[p + 1] = y * 16
        data[p + 3] = 255
      }
    return { data, width: 4, height: 4 }
  }

  it('downscales a 4x4 to 2x2 with exact box averages', () => {
    const out = resize(gradient(), 2, 2)
    expect([out.width, out.height]).toEqual([2, 2])
    expect(out.data).toEqual(Uint8Array.from([8, 8, 0, 255, 40, 8, 0, 255, 8, 40, 0, 255, 40, 40, 0, 255]))
  })

  it('upscales a 2x2 to 4x4 with nearest (no invented detail)', () => {
    const src: Raster = {
      data: Uint8Array.from([10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255]),
      width: 2,
      height: 2
    }
    const out = resize(src, 4, 4)
    expect(out.data).toEqual(
      Uint8Array.from([
        10, 0, 0, 255, 10, 0, 0, 255, 20, 0, 0, 255, 20, 0, 0, 255, 10, 0, 0, 255, 10, 0, 0, 255, 20, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0,
        255, 40, 0, 0, 255, 30, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255, 40, 0, 0, 255
      ])
    )
  })

  it('returns the raster unchanged when the size already matches', () => {
    const src = gradient()
    const out = resize(src, 4, 4)
    expect(out).toBe(src)
    expect(out.data).toBe(src.data)
  })

  it('handles one-pixel-wide and one-pixel-tall rasters, and never a zero edge', () => {
    const column: Raster = { data: Uint8Array.from([0, 0, 0, 255, 10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255]), width: 1, height: 4 }
    const shrunk = resize(column, 1, 2)
    expect([shrunk.width, shrunk.height]).toEqual([1, 2])
    expect(shrunk.data).toEqual(Uint8Array.from([5, 0, 0, 255, 25, 0, 0, 255]))

    const clamped = resize(column, 0, 5)
    expect([clamped.width, clamped.height]).toEqual([1, 5])
  })
})

describe('decode() dispatches on mime', () => {
  const png = makePng({ width: 1, height: 1, colorType: 2, bitDepth: 8, scanlines: [none([1, 2, 3])] })
  const jpeg = new Uint8Array(
    jpegEncode({ data: Uint8Array.from([9, 9, 9, 255, 9, 9, 9, 255, 9, 9, 9, 255, 9, 9, 9, 255]), width: 2, height: 2 }, 100).data
  )

  it('picks the PNG decoder for image/png', () => {
    expect(decode(png, 'image/png').data).toEqual(Uint8Array.from([1, 2, 3, 255]))
  })

  it('picks the JPEG decoder for image/jpeg', () => {
    expect([decode(jpeg, 'image/jpeg').width, decode(jpeg, 'image/jpeg').height]).toEqual([2, 2])
  })

  it('throws on an unknown mime', () => {
    expect(() => decode(png, 'image/gif' as never)).toThrow(/no raster decoder/)
  })
})
