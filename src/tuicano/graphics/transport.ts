// The render boundary's graphics transport (spec §3): from a picture the core
// produced to the escape sequence that draws it, with the text fallback always
// available. Swappable on purpose — a multiplexer may strip image protocols
// entirely, and the client has to stay usable when it does, so `--graphics=none`
// turns this into a transport that only ever answers `fallback()`.
//
// Pure: everything a protocol needs is decided here, and the bytes come out of
// the encoders, which are tested byte by byte.
import type { Protocol } from './types'
import { L } from '../../shared/lang'
import { fit } from './fit'
import { iterm2Image } from './iterm2'
import { kittyImage, kittyRaster } from './kitty'
import { decode, resize, type Raster } from './raster'
import { sixelImage } from './sixel'
import type { Cell, Picture, Placement } from './types'

export type Mime = 'image/png' | 'image/jpeg'

export interface Prepared {
  protocol: Protocol
  // Whether this transport can draw a picture at all: false is the text-only
  // transport, and the caller must show `fallback()` instead.
  canDrawImages: boolean
  width: number
  height: number
  // The escape sequence for this many cells of this size, or null when the
  // protocol is 'none' — which is when the caller draws the fallback line.
  escape(cell: Cell, area: { cols: number; rows: number }): { text: string; placement: Placement } | null
  // What the text shows instead of the image, when there is no graphics protocol.
  fallback(): string
}

export function prepare(bytes: Uint8Array, mime: Mime, protocol: Protocol): Prepared {
  const raster: Raster = decode(bytes, mime)
  const picture: Picture = { bytes, mime, width: raster.width, height: raster.height }
  return {
    protocol,
    canDrawImages: protocol !== 'none',
    width: raster.width,
    height: raster.height,
    fallback: () => L(`[imagem ${raster.width}x${raster.height}, ${protocolLabel(protocol)} — modo texto]`, `[image ${raster.width}x${raster.height}, ${protocolLabel(protocol)} — text mode]`),
    escape(cell, area) {
      if (protocol === 'none') return null
      const placement = fit({ width: raster.width, height: raster.height }, cell, area)
      // kitty and iTerm2 are told how many cells to take and scale the picture
      // themselves; sixel has no cell concept, so the pixels are resized here.
      if (protocol === 'kitty') {
        const text =
          picture.mime === 'image/png'
            ? kittyImage(picture, placement)
            : kittyRaster(resize(raster, placement.pxW, placement.pxH), placement)
        return { text, placement }
      }
      if (protocol === 'iterm2') return { text: iterm2Image(picture, placement), placement }
      return { text: sixelImage(resize(raster, placement.pxW, placement.pxH), placement), placement }
    }
  }
}

export function protocolLabel(protocol: Protocol): string {
  return protocol === 'none' ? 'text' : protocol
}

// The live frames of an agent's browser arrive as a data URL on the event
// (`BrowserView.frame`, spec §2.1).
export function pictureOfDataUrl(url: string): { bytes: Uint8Array; mime: Mime } | null {
  const m = /^data:(image\/(?:png|jpeg));base64,(.*)$/s.exec(url)
  if (!m) return null
  return { bytes: new Uint8Array(Buffer.from(m[2]!, 'base64')), mime: m[1] as Mime }
}

// Artifacts are files on disk; the GUI serves them over `tucano://`, which is
// Electron's protocol handler, so TUIcano reads them where they live.
export function mimeOfName(name: string): Mime | undefined {
  const ext = name.toLowerCase().replace(/^.*\./, '')
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  return undefined
}
