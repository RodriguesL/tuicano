// A PNG decoder, built on node:zlib alone (pngjs is not a dependency and this
// is small enough not to be one). It only has to feed a terminal: the output is
// always 8-bit RGBA, row-major, no inter-row padding. It refuses what it cannot
// decode (Adam7 interlace, absurd bit depths) with a message that names the
// problem, because a silently wrong image is worse than an error.
import { inflateSync } from 'node:zlib'
import type { Raster } from '../types'

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

// Channels per pixel, by colour type. Bit depth is separate.
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

// What bit depths each colour type may carry in a valid PNG.
const DEPTHS: Record<number, number[]> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16]
}

export function decodePng(bytes: Uint8Array): Raster {
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) throw new Error('not a PNG: bad signature')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  let ihdr: { width: number; height: number; bitDepth: number; colorType: number; interlace: number } | undefined
  const idats: Uint8Array[] = []
  let palette: Uint8Array | undefined
  let trns: Uint8Array | undefined
  let first = true
  let pos = 8
  while (pos + 8 <= bytes.length) {
    const len = view.getUint32(pos)
    const type = String.fromCharCode(bytes[pos + 4]!, bytes[pos + 5]!, bytes[pos + 6]!, bytes[pos + 7]!)
    const dataStart = pos + 8
    const dataEnd = dataStart + len
    // The chunk claims more bytes than the file holds: stop, do not read past.
    if (dataEnd + 4 > bytes.length) throw new Error(`truncated PNG: chunk ${type} ends past the end of the file`)
    if (first && type !== 'IHDR') throw new Error(`malformed PNG: first chunk is ${type}, expected IHDR`)
    first = false
    if (type === 'IHDR') {
      if (len !== 13) throw new Error(`malformed PNG: IHDR is ${len} bytes, expected 13`)
      ihdr = {
        width: view.getUint32(dataStart),
        height: view.getUint32(dataStart + 4),
        bitDepth: bytes[dataStart + 8]!,
        colorType: bytes[dataStart + 9]!,
        interlace: bytes[dataStart + 12]!
      }
    } else if (type === 'PLTE') palette = bytes.subarray(dataStart, dataEnd)
    else if (type === 'tRNS') trns = bytes.subarray(dataStart, dataEnd)
    else if (type === 'IDAT') idats.push(bytes.subarray(dataStart, dataEnd))
    else if (type === 'IEND') break
    pos = dataEnd + 4
  }

  if (!ihdr) throw new Error('malformed PNG: no IHDR chunk')
  if (ihdr.interlace === 1) throw new Error('unsupported PNG: Adam7 interlacing (interlace = 1)')
  if (ihdr.interlace !== 0) throw new Error(`malformed PNG: unknown interlace method ${ihdr.interlace}`)

  const { width, height, bitDepth, colorType } = ihdr
  const channels = CHANNELS[colorType]
  if (channels === undefined) throw new Error(`unsupported PNG: unknown colour type ${colorType}`)
  if (!DEPTHS[colorType]!.includes(bitDepth)) throw new Error(`unsupported PNG: bit depth ${bitDepth} for colour type ${colorType}`)
  if (colorType === 3 && !palette) throw new Error('malformed PNG: palette colour type without a PLTE chunk')

  // Bytes per pixel for the filters. Sub-byte depths still filter byte-wise,
  // so bpp is clamped to 1 — getting this wrong silently corrupts every row.
  const bpp = Math.max(1, Math.ceil((channels * bitDepth) / 8))
  const stride = Math.ceil((width * channels * bitDepth) / 8)

  let inflated: Uint8Array
  try {
    inflated = inflateSync(Buffer.concat(idats))
  } catch (e) {
    throw new Error(`malformed PNG: IDAT stream did not inflate (${(e as Error).message})`)
  }
  if (inflated.length < height * (stride + 1)) throw new Error('truncated PNG: IDAT holds fewer scanlines than IHDR declares')

  const pixels = unfilter(inflated, width, height, stride, bpp)

  // Transparency values are stored 16-bit regardless of the image's depth.
  const greyTrns = colorType === 0 && trns ? (trns[0]! << 8) | trns[1]! : undefined
  const rgbTrns = colorType === 2 && trns ? [(trns[0]! << 8) | trns[1]!, (trns[2]! << 8) | trns[3]!, (trns[4]! << 8) | trns[5]!] : undefined

  const out = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const row = pixels.subarray(y * stride, y * stride + stride)
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      if (colorType === 0) {
        const s = rawSample(row, x, bitDepth)
        out[o] = out[o + 1] = out[o + 2] = to8(s, bitDepth)
        out[o + 3] = greyTrns !== undefined && s === greyTrns ? 0 : 255
      } else if (colorType === 2) {
        const r = rawSample(row, x * 3, bitDepth)
        const g = rawSample(row, x * 3 + 1, bitDepth)
        const b = rawSample(row, x * 3 + 2, bitDepth)
        out[o] = to8(r, bitDepth)
        out[o + 1] = to8(g, bitDepth)
        out[o + 2] = to8(b, bitDepth)
        out[o + 3] = rgbTrns && r === rgbTrns[0] && g === rgbTrns[1] && b === rgbTrns[2] ? 0 : 255
      } else if (colorType === 3) {
        const idx = rawSample(row, x, bitDepth)
        out[o] = palette![idx * 3]!
        out[o + 1] = palette![idx * 3 + 1]!
        out[o + 2] = palette![idx * 3 + 2]!
        out[o + 3] = trns && idx < trns.length ? trns[idx]! : 255
      } else if (colorType === 4) {
        const g = rawSample(row, x * 2, bitDepth)
        out[o] = out[o + 1] = out[o + 2] = to8(g, bitDepth)
        out[o + 3] = to8(rawSample(row, x * 2 + 1, bitDepth), bitDepth)
      } else {
        out[o] = to8(rawSample(row, x * 4, bitDepth), bitDepth)
        out[o + 1] = to8(rawSample(row, x * 4 + 1, bitDepth), bitDepth)
        out[o + 2] = to8(rawSample(row, x * 4 + 2, bitDepth), bitDepth)
        out[o + 3] = to8(rawSample(row, x * 4 + 3, bitDepth), bitDepth)
      }
    }
  }

  return { data: out, width, height }
}

// Reverse the per-scanline filters into one flat buffer of raw scanlines.
function unfilter(inflated: Uint8Array, width: number, height: number, stride: number, bpp: number): Uint8Array {
  const out = new Uint8Array(height * stride)
  let p = 0
  for (let y = 0; y < height; y++) {
    const filter = inflated[p++]!
    const row = y * stride
    const prev = row - stride
    for (let x = 0; x < stride; x++) {
      const cur = inflated[p + x]!
      const a = x >= bpp ? out[row + x - bpp]! : 0 // left
      const b = y > 0 ? out[prev + x]! : 0 // up
      const c = x >= bpp && y > 0 ? out[prev + x - bpp]! : 0 // up-left
      let val: number
      if (filter === 0) val = cur
      else if (filter === 1) val = cur + a
      else if (filter === 2) val = cur + b
      else if (filter === 3) val = cur + ((a + b) >> 1)
      else if (filter === 4) val = cur + paeth(a, b, c)
      else throw new Error(`malformed PNG: unknown filter type ${filter} on row ${y}`)
      out[row + x] = val & 0xff
    }
    p += stride
  }
  return out
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

// One channel's raw value at a pixel-sample index, before any 8-bit scaling.
function rawSample(row: Uint8Array, index: number, bitDepth: number): number {
  if (bitDepth === 16) return (row[index * 2]! << 8) | row[index * 2 + 1]!
  if (bitDepth === 8) return row[index]!
  const bit = index * bitDepth
  return (row[bit >> 3]! >> (8 - bitDepth - (bit & 7))) & ((1 << bitDepth) - 1)
}

// PNG samples to 8 bits: 16-bit is down-shifted, sub-byte values are scaled so
// black stays 0 and the max stays 255.
function to8(v: number, bitDepth: number): number {
  if (bitDepth === 16) return v >> 8
  if (bitDepth === 8) return v
  return Math.round((v * 255) / ((1 << bitDepth) - 1))
}
