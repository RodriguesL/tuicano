// DCS sixel (ESC P q ... ESC \). Pure: a decoded Raster in, an escape sequence
// out. No median-cut, no dependency: a fixed 6x6x6 cube plus 24 greys means a
// test can predict every index by hand.
import type { Placement, Raster } from './types'

const LEVELS = [0, 51, 102, 153, 204, 255]

// 216 cube entries (r*36 + g*6 + b) then 24 greys, in that order.
export const PALETTE: Uint8Array = (() => {
  const p = new Uint8Array(240 * 3)
  let o = 0
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        p[o++] = LEVELS[r]!
        p[o++] = LEVELS[g]!
        p[o++] = LEVELS[b]!
      }
    }
  }
  for (let i = 0; i < 24; i++) {
    const v = Math.round((i * 255) / 23)
    p[o++] = v
    p[o++] = v
    p[o++] = v
  }
  return p
})()

// Nearest palette entry in RGB, ties going to the lowest index so the result is
// deterministic. Only ever called once per distinct colour (quantize caches).
function nearest(r: number, g: number, b: number): number {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < 240; i++) {
    const o = i * 3
    const dr = r - PALETTE[o]!
    const dg = g - PALETTE[o + 1]!
    const db = b - PALETTE[o + 2]!
    const d = dr * dr + dg * dg + db * db
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

export function quantize(rgba: Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba.length >> 2)
  const cache = new Map<number, number>()
  for (let i = 0; i < out.length; i++) {
    const o = i << 2
    const key = (rgba[o]! << 16) | (rgba[o + 1]! << 8) | rgba[o + 2]!
    let idx = cache.get(key)
    if (idx === undefined) {
      idx = nearest(rgba[o]!, rgba[o + 1]!, rgba[o + 2]!)
      cache.set(key, idx)
    }
    out[i] = idx
  }
  return out
}

// Sixel takes percentages 0-100, not 0-255.
const pct = (v: number): number => Math.round((v * 100) / 255)

export function sixelImage(raster: Raster, place: Placement): string {
  const { width: w, height: h } = raster
  const idx = quantize(raster.data)
  const used = [...new Set(idx)].sort((a, b) => a - b)

  let out = '\x1bPq'
  out += `"1;1;${w};${h}` // raster attributes: square pixels, then the raster size
  for (const c of used) {
    const o = c * 3
    out += `#${c};2;${pct(PALETTE[o]!)};${pct(PALETTE[o + 1]!)};${pct(PALETTE[o + 2]!)}`
  }

  for (let band = 0; band < h; band += 6) {
    // Only the colours present in this band get a pass, ascending for determinism.
    const here = new Set<number>()
    for (let y = band; y < Math.min(band + 6, h); y++) for (let x = 0; x < w; x++) here.add(idx[y * w + x]!)
    let first = true
    for (const c of [...here].sort((a, b) => a - b)) {
      if (!first) out += '$' // back to the left margin for the next colour
      first = false
      for (let x = 0; x < w; x++) {
        let bits = 0
        for (let y = 0; y < 6; y++) {
          const py = band + y
          if (py < h && idx[py * w + x] === c) bits |= 1 << y
        }
        out += String.fromCharCode(0x3f + bits) // 0x3F (= '?') for an empty sixel
      }
    }
    out += '-'
  }
  return out + '\x1b\\'
}
