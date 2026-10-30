// The picture, drawn outside Ink (spec §2.4). Ink writes its whole frame on
// every commit and erases what it did not use, so an image written "inside" a
// layout would be wiped by the next event. Here the component draws nothing:
// it clears the screen and writes the protocol's escape sequence, and it keeps
// doing that, so whatever Ink paints over is drawn again.
import { useEffect, type ReactNode } from 'react'
import { useStdout } from 'ink'
import type { Prepared } from './transport'
import type { Cell } from './types'

const HOME = '\x1b[2J\x1b[H'

export function ImageOverlay({ prepared, cell }: { prepared: Prepared; cell: Cell }): ReactNode {
  const { write } = useStdout()
  useEffect(() => {
    const paint = (): void => {
      const area = { cols: process.stdout.columns ?? 80, rows: Math.max(1, (process.stdout.rows ?? 24) - 1) }
      const drawn = prepared.escape(cell, area)
      write(HOME + (drawn ? drawn.text : `${prepared.fallback()}\r\n`))
    }
    // After the commit that rendered this component, and again shortly: an event
    // arriving while the picture is open repaints Ink's frame, and this puts the
    // picture back on top of it.
    const soon = setTimeout(paint, 10)
    const keep = setInterval(paint, 250)
    return () => {
      clearTimeout(soon)
      clearInterval(keep)
    }
  })
  return null
}
