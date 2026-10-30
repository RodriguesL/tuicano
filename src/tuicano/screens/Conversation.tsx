// A conversation in text (spec §3.3): the same messages, steps, receipts and
// approval cards the GUI draws, with the cursor standing in for the mouse.
import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import { pendingApprovals, type State } from '../../app/store'
import { agentById, conversationMessages, conversationTitle } from '../store'
import type { Approval, Message } from '../../shared/types'

const clock = (at: number): string => new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

function Status({ m }: { m: Message }): ReactNode {
  const run = m.run
  if (!run || run.status === 'done') return <Text dimColor>{run?.receipt ? ` · ${run.receipt.model} · ${run.receipt.outputTokens} out` : ''}</Text>
  const label =
    run.status === 'working'
      ? 'working…'
      : run.status === 'waiting_approval'
        ? 'waiting for you'
        : run.status === 'waiting_input'
          ? 'asked you something'
          : run.status === 'paused'
            ? 'paused at the budget'
            : run.status
  return <Text color={run.status === 'working' ? 'yellow' : 'magenta'}>{` · ${label}`}</Text>
}

function ApprovalCard({ approval }: { approval: Approval }): ReactNode {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={approval.highRisk ? 'red' : 'yellow'}>
      <Text bold color={approval.highRisk ? 'red' : 'yellow'}>
        approval{approval.highRisk ? ' · high risk' : ''} · {approval.connectorName} · {approval.tool}
      </Text>
      {approval.why ? <Text>{approval.why}</Text> : null}
      <Text dimColor>{JSON.stringify(approval.args)}</Text>
      <Text>
        y approve{approval.highRisk ? ' (twice)' : ''} · x refuse · Y always
      </Text>
    </Box>
  )
}

export function Conversation({ state, id, cursor, focused }: { state: State; id: string; cursor: number; focused: boolean }): ReactNode {
  const conversation = state.conversations.find((c) => c.id === id)
  const messages = conversationMessages(state, id)
  const approvals = pendingApprovals(state)
  if (!conversation) return <Text dimColor>This conversation is gone.</Text>
  const title = conversation.kind === 'channel' ? `#${conversation.name}` : conversationTitle(state, conversation)
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text bold>
        {title}
        {conversation.topic ? <Text dimColor>{`  ${conversation.topic}`}</Text> : null}
      </Text>
      {messages.map((m, i) => {
        const author = m.author.kind === 'me' ? 'you' : m.author.kind === 'agent' ? (agentById(state, m.author.id)?.name ?? 'agent') : m.author.kind
        const approval = m.run?.approvalId ? approvals.find((a) => a.id === m.run!.approvalId) : undefined
        const artifacts = (m.run?.artifactIds ?? []).map((aid) => state.artifacts.find((a) => a.id === aid)).filter((a) => a !== undefined)
        return (
          <Box key={m.id} flexDirection="column" marginTop={1}>
            <Text inverse={focused && i === cursor}>
              {`${i === cursor ? '>' : ' '} ${author} · ${clock(m.at)}`}
              <Status m={m} />
            </Text>
            <Text>{m.text}</Text>
            {m.run?.steps.length ? <Text dimColor>{`  ${m.run.steps.length} step(s): ${m.run.steps.map((s) => s.label).join(', ').slice(0, 120)}`}</Text> : null}
            {artifacts.map((a) => (
              <Text key={a.id} color="cyan">{`  [${a.kind} ${a.name}] v opens it`}</Text>
            ))}
            {approval ? <ApprovalCard approval={approval} /> : null}
          </Box>
        )
      })}
      {messages.length === 0 ? <Text dimColor>Nothing here yet. Press i to write.</Text> : null}
    </Box>
  )
}
