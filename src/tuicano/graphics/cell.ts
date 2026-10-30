// The terminal's pixel geometry (spec §3): a reply to CSI 14 t, or TIOCGWINSZ.
// Both are needed because many terminals answer neither (ws_xpixel stays 0), and
// the cell is then a documented guess.
import type { Cell } from './types'

// ESC [ 4 ; height ; width t — the reply to CSI 14 t. Noise is allowed: it
// arrives in a buffer with whatever else the terminal sent.
const WINDOW_SIZE_RE = /\x1b\[4;(\d+);(\d+)t/g

export function parseWindowSizeReport(s: string): { widthPx: number; heightPx: number } | null {
  for (const m of s.matchAll(WINDOW_SIZE_RE)) {
    const heightPx = Number(m[1])
    const widthPx = Number(m[2])
    if (widthPx > 0 && heightPx > 0) return { widthPx, heightPx }
  }
  return null
}

// struct winsize { uint16 rows, cols, xpixel, ypixel } — little-endian.
export function parseWinsize(buf: Uint8Array): { cols: number; rows: number; pxW: number; pxH: number } {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  return { rows: dv.getUint16(0, true), cols: dv.getUint16(2, true), pxW: dv.getUint16(4, true), pxH: dv.getUint16(6, true) }
}

// Most terminals leave ws_xpixel/ws_ypixel at 0; 8x16 is the classic cell.
const DEFAULT_PX_W = 8
const DEFAULT_PX_H = 16

export function cellSize(w: { cols: number; rows: number; pxW: number; pxH: number }): Cell {
  const cols = Math.max(1, Math.floor(w.cols))
  const rows = Math.max(1, Math.floor(w.rows))
  const hasPixels = w.pxW > 0 && w.pxH > 0
  const pxW = hasPixels ? Math.max(1, w.pxW / cols) : DEFAULT_PX_W
  const pxH = hasPixels ? Math.max(1, w.pxH / rows) : DEFAULT_PX_H
  return { cols, rows, pxW, pxH }
}
