// The opening banner (spec §2.5, §3.4 row 15): the terminal's answer to the window's
// animated splash — one line, drawn once with Ink's <Static>, so it scrolls away and
// never redraws. It carries the three things a person needs before anything works:
// the app's name as this fork brands it, the version, the workspace, and where the
// data folder is — the answer when the terminal and the window disagree about the team.
import { Static, Box, Text } from 'ink'
import type { ReactNode } from 'react'
import { useAppState } from '../store'
import { runtime } from '../runtime'
import { useTheme } from '../theme/context'

export function Banner(): ReactNode {
  const t = useTheme()
  const state = useAppState()
  const workspace = state.settings.workspaceName || 'workspace'
  return (
    <Static items={['banner']}>
      {() => (
        // Ink's Static renders a list: the element it is handed is a list item, so it
        // carries a key (without it React warns on every frame).
        <Box key="banner" flexDirection="column">
          <Text>
            <Text bold color={t.accent}>
              {'TUIcano'}
            </Text>
            <Text color={t.faint}>{`  ${runtime.version}`}</Text>
            <Text color={t.dim}>{`  ·  ${workspace}`}</Text>
          </Text>
          <Text color={t.faint}>{`data · ${runtime.dataDir || '(not set)'}`}</Text>
        </Box>
      )}
    </Static>
  )
}
