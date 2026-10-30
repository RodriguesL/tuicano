// The Tuca builder in text (spec §3.3 row 4): the window's Onboarding walks the
// person through the Tuca's questions; here it is the same conversation with a
// prompt for each answer. The proposal card itself lives in the conversation,
// which another screen owns — this one only sends what the person types back.
import { useEffect, useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { conversationMessages, store, type View } from '../store'
import { L } from '../../shared/lang'
import { useOverlay, type ScreenProps } from '../overlays/api'
import { agentColor, useTheme } from '../theme/context'
import { Hint } from '../ui/kit'
import { time } from '../../shared/format'

export function TucaBuilder({ state, active, from }: ScreenProps & { from?: View }): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const [conv, setConv] = useState<{ id?: string; error?: string }>({})
  const tuca = state.agents.find((a) => a.kind === 'tuca')
  const messages = conv.id ? conversationMessages(state, conv.id) : []

  const start = (fresh: boolean): void => {
    setConv({})
    store
      .ensureTuca(undefined, fresh)
      .then((r) => setConv({ id: r.conversationId }))
      .catch((e: unknown) => setConv({ error: e instanceof Error ? e.message : String(e) }))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => start(false), [])

  const leave = (): void => {
    const first = state.conversations.find((c) => c.kind === 'channel')
    if (from) return store.navigate(from)
    if (first) return store.navigate({ kind: 'conversation', id: first.id })
  }

  useInput(
    (input, key) => {
      if (key.escape) return leave()
      if (input === 'n') return start(true)
      if ((input === 'i' || key.return) && conv.id)
        return overlay.prompt({ title: L('Responder ao Tuca', 'Answer the Tuca'), label: L('Sua resposta', 'Your answer'), onSubmit: (text) => (text.trim() && store.sendMessage(conv.id!, text), undefined) })
    },
    { isActive: active }
  )

  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{L('Tuca · novo agente', 'The Tuca · new agent')}</Text>
      <Text color={t.dim}>{L('Ele faz duas ou três perguntas e propõe um agente. Nada é criado sem você.', 'It asks two or three questions and proposes an agent. Nothing is created without you.')}</Text>
      {conv.error ? <Text color={t.danger}>{conv.error}</Text> : null}
      {!conv.id && !conv.error ? <Text color={t.faint}>{L('Chamando o Tuca…', 'Calling the Tuca…')}</Text> : null}
      {messages.map((m) => {
        const who = m.author.kind === 'me' ? L('você', 'you') : m.author.kind === 'agent' ? (tuca?.name ?? 'Tuca') : m.author.kind
        const color = m.author.kind === 'me' ? t.me : tuca ? agentColor(t, tuca.color) : t.accentAlt
        return (
          <Box key={m.id} flexDirection="column" marginTop={1}>
            <Text>
              <Text color={color} bold>
                {who}
              </Text>
              <Text color={t.faint}>{` · ${time(m.at)}`}</Text>
            </Text>
            <Text color={t.text}>{m.text}</Text>
          </Box>
        )
      })}
      {active ? <Hint keys={[['i', 'answer'], ['n', 'new session'], ['Esc', 'close']]} /> : null}
    </Box>
  )
}
