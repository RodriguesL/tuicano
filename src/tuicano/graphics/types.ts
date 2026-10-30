// What the terminal can show, and how (spec §3). The encoders are pure: bytes
// in, escape sequences out, so they are tested without a terminal.
//
// Owned by the spec, not by any one encoder: both the protocol encoders and the
// raster decoders import from here, and neither changes it.

// A picture the core produced: a live frame of an agent's browser (JPEG), a
// screenshot of its computer (PNG), an image it showed in a conversation.
export interface Picture {
  bytes: Uint8Array
  mime: 'image/png' | 'image/jpeg'
  width: number // pixels, as the core reported them
  height: number
}

// Decoded pixels: 8 bits per channel, RGBA, row-major, top to bottom. Sixel
// needs these, and so does the kitty protocol when the picture is a JPEG —
// it takes a PNG as it is, and nothing else.
export interface Raster {
  data: Uint8Array
  width: number
  height: number
}

// What the terminal promises to draw. 'none' is text only: the fallback.
export type Protocol = 'kitty' | 'iterm2' | 'sixel' | 'none'

// The terminal's grid and the size of one cell in pixels, which is what sizing
// an image to that grid needs (CSI 14 t, or TIOCGWINSZ's ws_xpixel/ws_ypixel).
export interface Cell {
  cols: number
  rows: number
  pxW: number
  pxH: number
}

// Where a picture goes: the cells it takes, and the pixels to encode it at.
export interface Placement {
  cols: number
  rows: number
  pxW: number
  pxH: number
}
