// The kitty graphics protocol (APC: ESC _ G ... ESC \). Pure: bytes in, escape
// sequence out, no terminal.
//
// kittyImage only passes a PNG through unchanged (f=100) — that is the point of
// the format, no decode and no re-encode. A JPEG cannot go that way, and this
// file does not decode, so it throws: decode the JPEG and call kittyRaster.
import type { Picture, Placement, Raster } from './types'

// 4096 = 1024 base64 quanta of 4 chars, so chunking the base64 *string* at 4096
// never splits a quantum (chunking the raw bytes would).
const CHUNK = 4096

function transmit(keys: string[], dataB64: string): string {
  const chunks: string[] = []
  for (let i = 0; i < dataB64.length; i += CHUNK) chunks.push(dataB64.slice(i, i + CHUNK))
  if (chunks.length === 0) chunks.push('')
  let out = ''
  for (let i = 0; i < chunks.length; i++) {
    const last = i === chunks.length - 1
    // The first chunk carries all the keys; the rest only say whether more follows.
    const control = i === 0 ? `${keys.join(',')},m=${last ? 0 : 1}` : `m=${last ? 0 : 1}`
    out += `\x1b_G${control};${chunks[i]}\x1b\\`
  }
  return out
}

// C=1 leaves the cursor alone: Ink owns it and will fight us otherwise.
function cursorKey(moveCursor: boolean | undefined): string {
  return `C=${moveCursor ? 0 : 1}`
}

export function kittyImage(pic: Picture, place: Placement, opts?: { moveCursor?: boolean }): string {
  if (pic.mime !== 'image/png') throw new Error('kitty: only image/png passes through; decode it and use kittyRaster')
  const keys = ['a=T', 'f=100', `c=${place.cols}`, `r=${place.rows}`, 'q=2', cursorKey(opts?.moveCursor)]
  return transmit(keys, Buffer.from(pic.bytes).toString('base64'))
}

export function kittyRaster(raster: Raster, place: Placement, opts?: { moveCursor?: boolean }): string {
  const keys = ['a=T', 'f=32', `s=${raster.width}`, `v=${raster.height}`, `c=${place.cols}`, `r=${place.rows}`, 'q=2', cursorKey(opts?.moveCursor)]
  return transmit(keys, Buffer.from(raster.data).toString('base64'))
}
