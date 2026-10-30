// Usage (spec §3.1 #63, §3.3 row 6): the window draws this month as charts; the
// terminal draws the same numbers as tables and bars — totals by agent, by model
// and by harness, the app's own turns, the subscription windows, and where each
// agent will end the month at the current pace. `loadUsage` is async: it lands in
// local state and an error is shown as it comes, never blocking the frame.
import { useEffect, useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { store } from '../store'
import type { ScreenProps } from '../overlays/api'
import { useTheme } from '../theme/context'
import { Bar, Hint, Table, type Column } from '../ui/kit'
import { duration, time, tokens, usd } from '../../shared/format'
import { CACHE_READ_WEIGHT, ENGINES, ENGINE_IDS, isTeam, modelInfo, type Agent, type UsageReport } from '../../shared/types'

const DAY = 86_400_000
const APP = 'app' // the one bucket for the app's own turns: router, memory, the Tuca

type Breakdown = 'agent' | 'model' | 'harness'
const ORDER: Breakdown[] = ['agent', 'model', 'harness']
const LABEL: Record<Breakdown, string> = { agent: 'by agent', model: 'by model', harness: 'by harness' }

// Where the current pace leads: the share of the month the agent would close on,
// or the day it would hit the limit (spec §21's projection, in text).
function ends(a: Agent, u: UsageReport): string {
  const elapsed = Math.max(0, (Date.now() - u.monthStart) / DAY)
  if (a.limit > 0 && a.used >= a.limit) return 'at the limit'
  if (elapsed < 2 || a.used <= 0 || a.limit <= 0) return '—'
  const pace = a.used / elapsed
  const projected = pace * u.daysInMonth
  if (projected >= a.limit) {
    const on = new Date(u.monthStart + (a.limit / pace) * DAY)
    return `hits day ${on.getDate()}`
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
          { key: 'name', label: 'Agent' },
          { key: 'used', label: 'Used', right: true },
          { key: 'limit', label: 'Limit', right: true },
          { key: 'ends', label: 'Ends the month' }
        ]
      : breakdown === 'model'
        ? [
            { key: 'model', label: 'Model' },
            { key: 'engine', label: 'Harness' },
            { key: 'tokens', label: 'Tokens', right: true }
          ]
        : [
            { key: 'engine', label: 'Harness' },
            { key: 'tokens', label: 'Tokens', right: true },
            { key: 'share', label: 'Share', right: true }
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

  if (error) return <Text color={t.danger}>{`Usage could not load: ${error}`}</Text>
  if (!report) return <Text color={t.faint}>Calculating…</Text>

  const q = state.settings.quota
  const of = (id: string): number => report.who.find((w) => w.id === id)?.tokens ?? 0
  const tuca = state.agents.find((a) => a.kind === 'tuca')
  const backstage = [
    { key: 'router', name: 'Router', what: 'picks who replies in channels', tokens: of('router') },
    { key: 'memory', name: 'Memory', what: 'summarizes conversations and suggests memories', tokens: of('memory') },
    ...(tuca ? [{ key: 'tuca', name: 'Tuca', what: 'builds agents with you', tokens: of(tuca.id) }] : [])
  ]
  const month = new Date(report.monthStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{`Usage and limits — ${month}`}</Text>
      <Text color={t.text}>
        {`${tokens(report.total)} tokens · ${report.replies} replies · ${report.replies ? duration(report.avgMs) : '—'} avg`}
        {report.apiUsd > 0 ? <Text color={t.dim}>{` · API ${usd(report.apiUsd)}`}</Text> : null}
      </Text>
      <Text color={t.faint}>{`Counting: a cache-read token counts ${Math.round(CACHE_READ_WEIGHT * 100)}% (countedTokens), the same rule the window uses.`}</Text>

      <Box marginTop={1}>
        <Text color={t.faint}>{ORDER.map((b, i) => `${i ? '  ' : ''}${b === breakdown ? '▸ ' : '  '}${LABEL[b]}`).join('')}</Text>
        <Text color={t.dim}>{byName ? '  ·  a→z (s)' : '  ·  by tokens (s)'}</Text>
      </Box>
      <Table columns={columns} rows={rows} cursor={at} active={active} />
      {!rows.length ? <Text color={t.faint}>Nothing recorded this month.</Text> : null}

      <Box marginTop={1} flexDirection="column">
        <Text bold color={t.heading}>Limits</Text>
        {agents.map((a) => (
          <Text key={a.id}>
            <Text color={t.text}>{`${a.name.padEnd(16)}`}</Text>
            {' '}
            <Bar used={a.used} limit={a.limit} />
            <Text color={t.faint}>{`  ${tokens(a.used)} of ${tokens(a.limit)} · ${report ? ends(a, report) : ''}`}</Text>
          </Text>
        ))}
        {!agents.length ? <Text color={t.faint}>No agents yet.</Text> : null}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={t.heading}>{`Behind the scenes (${APP}) — what the app itself spends`}</Text>
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
          <Text bold color={t.heading}>Your Claude subscription</Text>
          {q.fiveHour ? (
            <Text>
              {`5-hour window  `}
              <Bar used={Math.round(q.fiveHour.utilization * 100)} limit={100} />
              <Text color={t.faint}>{`  resets ${time(q.fiveHour.resetsAt)}`}</Text>
            </Text>
          ) : null}
          {q.sevenDay ? (
            <Text>
              {`Week           `}
              <Bar used={Math.round(q.sevenDay.utilization * 100)} limit={100} />
              <Text color={t.faint}>{`  resets ${time(q.sevenDay.resetsAt)}`}</Text>
            </Text>
          ) : null}
        </Box>
      ) : null}

      {active ? <Hint keys={[['↑ ↓', 'rows'], ['← →', 'breakdown'], ['s', 'sort'], ['Enter', 'open the agent']]} /> : null}
    </Box>
  )
}
