import { describe, expect, it } from 'vitest'
import { iterm2Image } from '../src/tuicano/graphics/iterm2'
import type { Picture } from '../src/tuicano/graphics/types'

const place = { cols: 3, rows: 2, pxW: 24, pxH: 32 }

describe('iterm2Image', () => {
  it('exact OSC 1337 frame for a PNG', () => {
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])
    const pic: Picture = { bytes, mime: 'image/png', width: 1, height: 1 }
    const name = Buffer.from('tucano.png').toString('base64')
    expect(iterm2Image(pic, place)).toBe(`\x1b]1337;File=name=${name};size=4;inline=1;width=3;height=2;preserveAspectRatio=1:${Buffer.from(bytes).toString('base64')}\x07`)
  })

  it('passes JPEG bytes through unchanged and takes a custom name', () => {
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
    const pic: Picture = { bytes, mime: 'image/jpeg', width: 1, height: 1 }
    const out = iterm2Image(pic, place, { name: 'shot.jpg' })
    expect(out).toContain(`name=${Buffer.from('shot.jpg').toString('base64')};size=${bytes.length};`)
    expect(out.endsWith('\x07')).toBe(true)
    const b64 = out.slice(out.lastIndexOf(':') + 1, -1)
    expect(Buffer.from(b64, 'base64').equals(Buffer.from(bytes))).toBe(true)
  })
})
