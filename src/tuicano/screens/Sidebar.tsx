// The sidebar, in text (spec §3.4): the same rows the GUI draws, with a cursor
// the keyboard moves. Presentational on purpose — app.tsx owns the cursor and
// the focus, so there is one input handler for the whole client.
import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import type { Row } from '../sidebar'

export function Sidebar({ rows, cursor, focused, width, workspace }: { rows: Row[]; cursor: number; focused: boolean; width: number; workspace: string }): ReactNode {
  return (
    <Box flexDirection="column" width={width} borderStyle="single" borderColor={focused ? 'cyan' : 'gray'}>
      <Text bold>{workspace}</Text>
      {rows.map((r, i) => (
        <Text key={r.key} inverse={focused && i === cursor} dimColor={!focused && i !== cursor}>
          {`${i === cursor ? '>' : ' '} ${r.label}`}
          {r.badge ? ` (${r.badge})` : ''}
        </Text>
      ))}
    </Box>
  )
}
