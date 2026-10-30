// The raster layer the rest of the client calls: bytes in the picture's own
// mime, pixels out. Sixel always needs this; kitty needs it only for JPEG.
import type { Raster } from '../types'
import { decodeJpeg } from './jpeg'
import { decodePng } from './png'

export { decodePng } from './png'
export { decodeJpeg } from './jpeg'
export { resize } from './resize'
export { type Raster } from '../types'

export function decode(bytes: Uint8Array, mime: 'image/png' | 'image/jpeg'): Raster {
  if (mime === 'image/png') return decodePng(bytes)
  if (mime === 'image/jpeg') return decodeJpeg(bytes)
  throw new Error(`no raster decoder for ${String(mime)}`)
}
