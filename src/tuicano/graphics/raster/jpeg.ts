// JPEG frames of an agent's browser come in as JPEG, and sixel (and the kitty
// protocol, for JPEG only) need raw pixels. jpeg-js is pure JS, no native code.
import { decode } from 'jpeg-js'
import type { Raster } from '../types'

export function decodeJpeg(bytes: Uint8Array): Raster {
  let img: { data: Uint8Array; width: number; height: number }
  try {
    img = decode(bytes, { useTArray: true, formatAsRGBA: true })
  } catch (e) {
    throw new Error(`not a JPEG, or a broken one: ${(e as Error).message}`)
  }
  // Copy into a plain Uint8Array: jpeg-js may hand back a view into a pooled buffer.
  return { data: new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength), width: img.width, height: img.height }
}
