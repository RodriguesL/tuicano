// Choosing a theme (spec §2.7). Every palette is data, so the picker can draw a
// real swatch of each candidate with the candidate's own colours — a preview that
// does not require switching to it — and Enter writes the choice to the config.
import { Box, Text, useInput } from 'ink'
import { useState, type ReactNode } from 'react'
import { THEMES } from '../theme'
import { useTheme } from '../theme/context'
import { CURSOR } from '../ui/kit'

const swatch = (hex: string): ReactNode => (
  <Text key={hex} color={hex}>
    {'██'}
  </Text>
)

export function ThemePicker({ current, onPick, onClose }: { current?: string; onPick: (name: string) => void; onClose: () => void }): ReactNode {
  const t = useTheme()
  const [at, setAt] = useState(Math.max(0, THEMES.findIndex((x) => x.name === current)))
  useInput((input, key) => {
    if (key.escape || input === 'q') return onClose()
    if (key.upArrow) return setAt((i) => Math.max(0, i - 1))
    if (key.downArrow) return setAt((i) => Math.min(THEMES.length - 1, i + 1))
    if (key.return) return onPick(THEMES[at]!.name)
  })
  return (
    <Box flexDirection="column">
      <Text color={t.dim}>
        ↑↓ moves · Enter picks · Esc closes. The choice is kept in <Text color={t.text}>tuicano.config.json</Text> next to your data.
      </Text>
      {THEMES.map((th, i) => {
        const selected = i === at
        return (
          <Text key={th.name} inverse={selected}>
            {`${selected ? `${CURSOR} ` : '  '}${th.name.padEnd(22)}`}
            <Text color={th.kind === 'light' ? th.dim : th.faint}>{`${th.kind.padEnd(6)}`}</Text>
            {[th.accent, th.accentAlt, th.me, th.routine, th.working, th.done, th.danger, th.agent.teal, th.agent.rose].map(swatch)}
            <Text color={th.dim}>{`  ${th.name === current ? 'in use' : th.origin}`}</Text>
          </Text>
        )
      })}
    </Box>
  )
}
