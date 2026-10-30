// Usage (spec §3.1 #63, §3.3 row 6): the window draws this month as charts; the
// terminal draws the same numbers as tables and bars — totals by agent, by model
// and by harness, the app's own turns, the subscription windows, and where each
// agent will end the month at the current pace. `loadUsage` is async: it lands in
// local state and an error is shown as it comes, never blocking the frame.
import { useEffect, useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { store } from '../store'
import { L, locale } from '../../shared/lang'
import type { ScreenProps } from '../overlays/api'
import { useTheme } from '../theme/context'
import { Bar, Hint, Table, type Column } from '../ui/kit'
import { duration, time, tokens, usd } from '../../shared/format'
import { CACHE_READ_WEIGHT, ENGINES, ENGINE_IDS, isTeam, modelInfo, type Agent, type UsageReport } from '../../shared/types'

const DAY = 86_400_000
const APP = 'app' // the one bucket for the app's own turns: router, memory, the Tuca

type Breakdown = 'agent' | 'model' | 'harness'
const ORDER: Breakdown[] = ['agent', 'model', 'harness']
const label = (b: Breakdown): string => (b === 'agent' ? L('por agente', 'by agent') : b === 'model' ? L('por modelo', 'by model') : L('por harness', 'by harness'))

// Where the current pace leads: the share of the month the agent would close on,
// or the day it would hit the limit (spec §21's projection, in text).
function ends(a: Agent, u: UsageReport): string {
  const elapsed = Math.max(0, (Date.now() - u.monthStart) / DAY)
  if (a.limit > 0 && a.used >= a.limit) return L('no limite', 'at the limit')
  if (elapsed < 2 || a.used <= 0 || a.limit <= 0) return '—'
  const pace = a.used / elapsed
  const projected = pace * u.daysInMonth
  if (projected >= a.limit) {
    const on = new Date(u.monthStart + (a.limit / pace) * DAY)
    return L(`bate no dia ${on.getDate()}`, `hits day ${on.getDate()}`)
  }
  return `${Math.round((projected / a.limit) * 100)}%`
}

export function Usage({ state, active }: ScreenProps): ReactNode {
  const t = useTheme()
  const [report, setReport] = useState<UsageReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [breakdown, setBreakdown] = useState<Breakdown>('agent')
  const [byName, setByName] = useState(false)
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    let live = true
    store.loadUsage().then(
      (r) => live && setReport(r),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e))
    )
    return () => {
      live = false
    }
  }, [])

  const team = state.agents.filter(isTeam)
  const agents = [...team].sort((a, b) => (byName ? a.name.localeCompare(b.name) : b.used - a.used))
  const models = report?.models ?? []
  const harnesses = ENGINE_IDS.map((e) => ({ engine: e, tokens: models.filter((m) => m.engine === e).reduce((n, m) => n + m.tokens, 0) })).filter((h) => h.tokens > 0)

  const cycle = (n: number): void => {
    setCursor(0)
    setBreakdown((b) => ORDER[(ORDER.indexOf(b) + n + ORDER.length) % ORDER.length]!)
  }

  const rows: Record<string, string>[] =
    breakdown === 'agent'
      ? agents.map((a) => ({ name: a.name, used: tokens(a.used), limit: tokens(a.limit), ends: report ? ends(a, report) : '—' }))
      : breakdown === 'model'
        ? models.map((m) => ({ model: modelInfo(m.model)?.label ?? m.model, engine: ENGINES[m.engine]?.label ?? m.engine, tokens: tokens(m.tokens) }))
        : harnesses.map((h) => ({ engine: ENGINES[h.engine].label, tokens: tokens(h.tokens), share: report?.total ? `${Math.round((h.tokens / report.total) * 100)}%` : '—' }))
  const at = Math.max(0, Math.min(cursor, rows.length - 1))

  const columns: Column[] =
    breakdown === 'agent'
      ? [
          { key: 'name', label: L('Agente', 'Agent') },
          { key: 'used', label: L('Usado', 'Used'), right: true },
          { key: 'limit', label: L('Limite', 'Limit'), right: true },
          { key: 'ends', label: L('Fecha o mês', 'Ends the month') }
        ]
      : breakdown === 'model'
        ? [
            { key: 'model', label: L('Modelo', 'Model') },
            { key: 'engine', label: 'Harness' },
            { key: 'tokens', label: 'Tokens', right: true }
          ]
        : [
            { key: 'engine', label: 'Harness' },
            { key: 'tokens', label: 'Tokens', right: true },
            { key: 'share', label: L('Fatia', 'Share'), right: true }
          ]

  useInput(
    (input, key) => {
      if (key.upArrow) return setCursor(Math.max(0, at - 1))
      if (key.downArrow) return setCursor(Math.min(rows.length - 1, at + 1))
      if (key.leftArrow) return cycle(-1)
      if (key.rightArrow || key.tab) return cycle(1)
      if (input === 's') return setByName((v) => !v)
      if (key.return && breakdown === 'agent') {
        const a = agents[at]
        if (a) store.navigate({ kind: 'agent', id: a.id })
      }
    },
    { isActive: active }
  )

  if (error) return <Text color={t.danger}>{L(`O uso não pôde carregar: ${error}`, `Usage could not load: ${error}`)}</Text>
  if (!report) return <Text color={t.faint}>{L('Calculando…', 'Crunching…')}</Text>

  const q = state.settings.quota
  const of = (id: string): number => report.who.find((w) => w.id === id)?.tokens ?? 0
  const tuca = state.agents.find((a) => a.kind === 'tuca')
  const backstage = [
    { key: 'router', name: L('Roteador', 'Router'), what: L('escolhe quem responde nos canais', 'picks who replies in channels'), tokens: of('router') },
    { key: 'memory', name: L('Memória', 'Memory'), what: L('resume conversas e sugere memórias', 'summarizes conversations and suggests memories'), tokens: of('memory') },
    ...(tuca ? [{ key: 'tuca', name: 'Tuca', what: L('monta agentes com você', 'builds agents with you'), tokens: of(tuca.id) }] : [])
  ]
  const month = new Date(report.monthStart).toLocaleDateString(locale(), { month: 'long', year: 'numeric' })

  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{L(`Uso e limites — ${month}`, `Usage and limits — ${month}`)}</Text>
      <Text color={t.text}>
        {L(`${tokens(report.total)} tokens · ${report.replies} respostas · ${report.replies ? duration(report.avgMs) : '—'} em média`, `${tokens(report.total)} tokens · ${report.replies} replies · ${report.replies ? duration(report.avgMs) : '—'} avg`)}
        {report.apiUsd > 0 ? <Text color={t.dim}>{` · API ${usd(report.apiUsd)}`}</Text> : null}
      </Text>
      <Text color={t.faint}>{L(`Contando: um token lido do cache conta ${Math.round(CACHE_READ_WEIGHT * 100)}% (countedTokens), a mesma regra que a janela usa.`, `Counting: a cache-read token counts ${Math.round(CACHE_READ_WEIGHT * 100)}% (countedTokens), the same rule the window uses.`)}</Text>

      <Box marginTop={1}>
        <Text color={t.faint}>{ORDER.map((b, i) => `${i ? '  ' : ''}${b === breakdown ? '▸ ' : '  '}${label(b)}`).join('')}</Text>
        <Text color={t.dim}>{byName ? L('  ·  a→z (s)', '  ·  a→z (s)') : L('  ·  por tokens (s)', '  ·  by tokens (s)')}</Text>
      </Box>
      <Table columns={columns} rows={rows} cursor={at} active={active} />
      {!rows.length ? <Text color={t.faint}>{L('Nada registrado este mês.', 'Nothing recorded this month.')}</Text> : null}

      <Box marginTop={1} flexDirection="column">
        <Text bold color={t.heading}>{L('Limites', 'Limits')}</Text>
        {agents.map((a) => (
          <Text key={a.id}>
            <Text color={t.text}>{`${a.name.padEnd(16)}`}</Text>
            {' '}
            <Bar used={a.used} limit={a.limit} />
            <Text color={t.faint}>{L(`  ${tokens(a.used)} de ${tokens(a.limit)} · ${report ? ends(a, report) : ''}`, `  ${tokens(a.used)} of ${tokens(a.limit)} · ${report ? ends(a, report) : ''}`)}</Text>
          </Text>
        ))}
        {!agents.length ? <Text color={t.faint}>{L('Nenhum agente ainda.', 'No agents yet.')}</Text> : null}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={t.heading}>{L(`Bastidores (${APP}) — o que o próprio app gasta`, `Behind the scenes (${APP}) — what the app itself spends`)}</Text>
        {backstage.map((b) => (
          <Text key={b.key} color={t.dim}>
            {`${b.name.padEnd(10)}`}
            <Text color={t.faint}>{`${b.what}  `}</Text>
            <Text color={t.text}>{tokens(b.tokens)}</Text>
          </Text>
        ))}
      </Box>

      {q && (q.fiveHour || q.sevenDay) ? (
        <Box marginTop={1} flexDirection="column">
          <Text bold color={t.heading}>{L('Sua assinatura do Claude', 'Your Claude subscription')}</Text>
          {q.fiveHour ? (
            <Text>
              {L('Janela de 5 horas  ', '5-hour window  ')}
              <Bar used={Math.round(q.fiveHour.utilization * 100)} limit={100} />
              <Text color={t.faint}>{L(`  zera ${time(q.fiveHour.resetsAt)}`, `  resets ${time(q.fiveHour.resetsAt)}`)}</Text>
            </Text>
          ) : null}
          {q.sevenDay ? (
            <Text>
              {L('Semana         ', 'Week           ')}
              <Bar used={Math.round(q.sevenDay.utilization * 100)} limit={100} />
              <Text color={t.faint}>{L(`  zera ${time(q.sevenDay.resetsAt)}`, `  resets ${time(q.sevenDay.resetsAt)}`)}</Text>
            </Text>
          ) : null}
        </Box>
      ) : null}

      {active ? <Hint keys={[['↑ ↓', 'rows'], ['← →', 'breakdown'], ['s', 'sort'], ['Enter', 'open the agent']]} /> : null}
    </Box>
  )
}
