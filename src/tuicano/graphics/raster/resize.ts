// Sizing a picture to the terminal grid. Shrinking a 1280x800 frame is the
// common case, and nearest-neighbour there looks like noise, so downscale is a
// box average with fractional edge coverage (non-integer ratios must not leave
// seams). Upscale is nearest-neighbour: do not invent detail that is not there.
import type { Raster } from '../types'

export function resize(raster: Raster, width: number, height: number): Raster {
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  if (w === raster.width && h === raster.height) return raster
  // Only average when actually shrinking; a mixed up/down request falls back to
  // nearest so it stays predictable.
  if (w <= raster.width && h <= raster.height) return downscale(raster, w, h)
  return nearest(raster, w, h)
}

function downscale(src: Raster, w: number, h: number): Raster {
  const { data, width: sw, height: sh } = src
  const out = new Uint8Array(w * h * 4)
  const xRatio = sw / w
  const yRatio = sh / h
  for (let oy = 0; oy < h; oy++) {
    const sy0 = oy * yRatio
    const sy1 = sy0 + yRatio
    const iy0 = Math.floor(sy0)
    const iy1 = Math.min(sh, Math.ceil(sy1))
    for (let ox = 0; ox < w; ox++) {
      const sx0 = ox * xRatio
      const sx1 = sx0 + xRatio
      const ix0 = Math.floor(sx0)
      const ix1 = Math.min(sw, Math.ceil(sx1))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let total = 0
      for (let iy = iy0; iy < iy1; iy++) {
        // Cover the source box with fractional weights, so a non-integer ratio
        // is averaged exactly rather than rounded into seams.
        const wy = Math.min(sy1, iy + 1) - Math.max(sy0, iy)
        if (wy <= 0) continue
        for (let ix = ix0; ix < ix1; ix++) {
          const wx = Math.min(sx1, ix + 1) - Math.max(sx0, ix)
          if (wx <= 0) continue
          const weight = wx * wy
          const p = (iy * sw + ix) * 4
          r += data[p]! * weight
          g += data[p + 1]! * weight
          b += data[p + 2]! * weight
          a += data[p + 3]! * weight
          total += weight
        }
      }
      const o = (oy * w + ox) * 4
      out[o] = Math.round(r / total)
      out[o + 1] = Math.round(g / total)
      out[o + 2] = Math.round(b / total)
      out[o + 3] = Math.round(a / total)
    }
  }
  return { data: out, width: w, height: h }
}

function nearest(src: Raster, w: number, h: number): Raster {
  const { data, width: sw, height: sh } = src
  const out = new Uint8Array(w * h * 4)
  for (let oy = 0; oy < h; oy++) {
    const sy = Math.min(sh - 1, Math.floor((oy * sh) / h))
    for (let ox = 0; ox < w; ox++) {
      const sx = Math.min(sw - 1, Math.floor((ox * sw) / w))
      const p = (sy * sw + sx) * 4
      out.set(data.subarray(p, p + 4), (oy * w + ox) * 4)
    }
  }
  return { data: out, width: w, height: h }
}
