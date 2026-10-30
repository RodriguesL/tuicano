// Fitting a picture into a grid (spec §3). A cell is not square — 8x16 is 1:2 —
// and forgetting that is the classic stretched-image bug, so the fit works in
// pixels and only then turns the result into cells.
import type { Cell, Placement } from './types'

export function fit(top: { width: number; height: number }, cell: Cell, area: { cols: number; rows: number }): Placement {
  const cols = Math.max(1, area.cols)
  const rows = Math.max(1, area.rows)
  const cw = Math.max(1, cell.pxW)
  const ch = Math.max(1, cell.pxH)
  const w = Math.max(1, top.width)
  const h = Math.max(1, top.height)

  // Scale down to the area, never up: scale <= 1 keeps the source's own pixels.
  const scale = Math.min(1, (cols * cw) / w, (rows * ch) / h)
  const nCols = Math.min(cols, Math.max(1, Math.ceil((w * scale) / cw)))
  const nRows = Math.min(rows, Math.max(1, Math.ceil((h * scale) / ch)))
  // Encode at the pixels those cells cover, still capped at the source size.
  const pxW = Math.min(w, Math.max(1, Math.round(nCols * cw)))
  const pxH = Math.min(h, Math.max(1, Math.round(nRows * ch)))
  return { cols: nCols, rows: nRows, pxW, pxH }
}
