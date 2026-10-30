// What the terminal client learned before it drew anything (spec §1.4, §2.2):
// where the data lives, which graphics protocol this terminal speaks, and the
// size of one cell. index.ts fills it once, before Ink takes the terminal over.
import type { Cell, Protocol } from './graphics/types'

export interface Runtime {
  dataDir: string
  protocol: Protocol
  cell: Cell
  version: string
}

export const runtime: Runtime = {
  dataDir: '',
  protocol: 'none',
  cell: { cols: 80, rows: 24, pxW: 8, pxH: 16 },
  version: '0.0.0'
}
