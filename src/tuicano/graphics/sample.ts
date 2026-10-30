// A tiny PNG, made here (spec §2.4). `--graphics-info` prints it through the
// detected protocol so a person can confirm with their own eyes that the bytes
// the tests pin down actually draw something in their terminal.
import { deflateSync } from 'node:zlib'

const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// The usual table-less CRC32 (PNG puts one at the end of every chunk).
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) {
    c ^= b
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const head = new Uint8Array(4 + data.length)
  for (let i = 0; i < 4; i++) head[i] = type.charCodeAt(i)
  head.set(data, 4)
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(head, 4)
  view.setUint32(8 + data.length, crc32(head))
  return out
}

// A checkerboard: two colours a terminal can tell apart at any size, which is
// what makes a stretched or mis-sized image obvious.
export function samplePng(size = 32, a = [0xff, 0x8a, 0x1f] as const, b = [0x12, 0x11, 0x10] as const): Uint8Array {
  const raw = new Uint8Array(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3)
    raw[row] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const on = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0
      const c = on ? a : b
      raw.set(c, row + 1 + x * 3)
    }
  }
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, size)
  view.setUint32(4, size)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: RGB
  const parts = [SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', new Uint8Array(deflateSync(raw))), chunk('IEND', new Uint8Array(0))]
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
