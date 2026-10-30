// Approvals, where a keypress is the product's whole point (spec §3.1 #28): the
// same gate as the window's card, with `y` twice inside 3 s standing in for the
// press-and-hold a high-risk call needs there.
import { useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { agentById, pendingApprovals } from '../store'
import { useApprovalGate } from '../useApprovals'
import { useTheme } from '../theme/context'
import type { ScreenProps } from '../overlays/api'
import { time } from '../../shared/format'
import { Hint } from '../ui/kit'

export function Approvals({ state, active }: ScreenProps): ReactNode {
  const t = useTheme()
  const { armed, press } = useApprovalGate()
  const [cursor, setCursor] = useState(0)
  const pending = pendingApprovals(state)
  const at = Math.max(0, Math.min(cursor, pending.length - 1))
  const approval = pending[at]

  useInput(
    (input, key) => {
      if (key.upArrow || input === 'k') return setCursor(Math.max(0, at - 1))
      if (key.downArrow || input === 'j') return setCursor(Math.min(pending.length - 1, at + 1))
      if (!approval) return
      if (input === 'y' || input === 'Y' || input === 'x') return press(approval, input)
    },
    { isActive: active }
  )

  if (!pending.length) return <Text color={t.faint}>Nothing waiting for you. Agents stop and ask here before anything sensitive runs.</Text>
  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{`Approvals (${pending.length})`}</Text>
      {pending.map((a, i) => {
        const selected = i === at
        const high = armed === a.id
        return (
          <Box key={a.id} flexDirection="column" marginTop={1} borderStyle="round" borderColor={high || a.highRisk ? t.danger : selected ? t.borderFocus : t.border} paddingX={1}>
            <Text inverse={selected && active} bold color={a.highRisk ? t.danger : t.text}>
              {`${selected ? '›' : ' '} ${agentById(state, a.agentId)?.name ?? 'agent'} wants ${a.tool} in ${a.connectorName}`}
              {a.highRisk ? <Text color={t.danger}>{'  · HIGH RISK'}</Text> : null}
            </Text>
            {a.why ? <Text color={t.dim}>{a.why}</Text> : null}
            <Text color={t.faint}>{JSON.stringify(a.args)}</Text>
            <Text color={t.faint}>{`expires ${time(a.expiresAt)}`}</Text>
            {selected ? (
              high ? (
                <Text color={t.danger}>high risk: press the same key again within 3 s to confirm</Text>
              ) : (
                <Hint keys={[['y', 'approve'], ['x', 'refuse'], ['Y', 'always allow']]} />
              )
            ) : null}
          </Box>
        )
      })}
    </Box>
  )
}
