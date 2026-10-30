// The screens the parity matrix schedules for a later phase (spec §5). The
// abstraction already carries them — the state is right there — so the honest
// thing is to say which phase draws it and show what is already loaded.
import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import type { State, View } from '../store'

const PHASE: Record<View['kind'], string> = {
  conversation: 'P0',
  approvals: 'P0',
  agent: 'P2',
  'new-agent': 'P2',
  tuca: 'P1',
  usage: 'P2',
  connectors: 'P2',
  memory: 'P2',
  routines: 'P2',
  skills: 'P2',
  report: 'P2',
  settings: 'P3'
}

const TITLE: Record<View['kind'], string> = {
  conversation: 'Conversation',
  approvals: 'Approvals',
  agent: 'Agent',
  'new-agent': 'New agent',
  tuca: 'The Tuca',
  usage: 'Usage',
  connectors: 'Connectors',
  memory: 'Memory',
  routines: 'Routines',
  skills: 'Skills',
  report: 'Report',
  settings: 'Settings'
}

export function Placeholder({ kind, state }: { kind: View['kind']; state: State }): ReactNode {
  const loaded = [
    `${state.agents.length} agents`,
    `${state.conversations.length} conversations`,
    `${state.messages.length} messages`,
    `${state.connectors.length} connectors`,
    `${state.memories.length} memories`,
    `${state.routines.length} routines`,
    `${state.skills.length} skills`,
    `${state.artifacts.length} artifacts`
  ]
  return (
    <Box flexDirection="column">
      <Text bold>{TITLE[kind]}</Text>
      <Text dimColor>{`This screen lands in phase ${PHASE[kind]} (docs/spec-tuicano.md §5). The state is already here:`}</Text>
      <Text>{loaded.join(' · ')}</Text>
    </Box>
  )
}
