// Approvals, where a keypress is the product's whole point (spec §3.3, §3.1 #28):
// the same gate as the GUI's card, with `y` twice inside 3 s standing in for the
// 1.5 s hold a high-risk call needs there.
import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import { agentById, pendingApprovals, type State } from '../store'

const clock = (at: number): string => new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

export function Approvals({ state, cursor, armed }: { state: State; cursor: number; armed?: string }): ReactNode {
  const pending = pendingApprovals(state)
  if (!pending.length) return <Text dimColor>Nothing waiting for you.</Text>
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text bold>{`Approvals (${pending.length})`}</Text>
      {pending.map((a, i) => (
        <Box key={a.id} flexDirection="column" marginTop={1} borderStyle="round" borderColor={armed === a.id ? 'red' : a.highRisk ? 'red' : 'yellow'}>
          <Text inverse={i === cursor} bold>
            {`${i === cursor ? '>' : ' '} ${agentById(state, a.agentId)?.name ?? 'agent'} wants ${a.tool} in ${a.connectorName}`}
            {a.highRisk ? ' · HIGH RISK' : ''}
          </Text>
          {a.why ? <Text>{a.why}</Text> : null}
          <Text dimColor>{JSON.stringify(a.args)}</Text>
          <Text dimColor>{`expires ${clock(a.expiresAt)}`}</Text>
          <Text color={armed === a.id ? 'red' : undefined}>
            {armed === a.id ? 'high risk: press y again within 3 s to confirm' : 'y approve · x refuse · Y always allow'}
          </Text>
        </Box>
      ))}
    </Box>
  )
}
