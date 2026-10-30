// Report (spec §3.1 #62, §3.3 row 11): the week the window shows agent by agent —
// replies ok/total and the rate, what failed and why, the skills and the work that
// ran — one calendar week at a time. ←/→ move the week, `r` reloads, Enter opens
// an agent's week in a sheet. `loadReport` is async and never blocks the frame.
import { useEffect, useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { agentById, store } from '../store'
import { L } from '../../shared/lang'
import { useOverlay, type ScreenProps } from '../overlays/api'
import { useTheme } from '../theme/context'
import { Hint } from '../ui/kit'
import { ago, duration, pct, shiftWeek, startOfWeek, tokens, usd, weekRange } from '../../shared/format'
import type { AgentReport, Problem, Report as ReportData } from '../../shared/types'

// The GUI labels each problem kind the same way (Report.tsx); the same words here.
const problemLabel = (kind: Problem['kind']): string =>
  kind === 'failed'
    ? L('Falhou', 'Failed')
    : kind === 'cut'
      ? L('Foi cortada (loop ou travou)', 'Cut off (a loop, or it stalled)')
      : kind === 'paused'
        ? L('Parou no teto de tokens', 'Stopped at the token ceiling')
        : L('Você recusou uma ação', 'You refused an action')

function AgentLine({ r, name, selected, active }: { r: AgentReport; name: string; selected: boolean; active: boolean }): ReactNode {
  const t = useTheme()
  const tone = pct(r.total.ok, r.total.replies)
  // The week's cost, or a plain word when no engine reported one (spec §9, §21).
  const cost = r.apiUsd !== undefined ? usd(r.apiUsd) : L('custo não informado', 'cost not reported')
  return (
    <Box flexDirection="column">
      <Text inverse={selected && active}>
        {`${selected ? '› ' : '  '}${name.padEnd(16)}`}
        <Text color={t.dim}>{`${r.total.ok}/${r.total.replies} ok  `}</Text>
        <Text color={r.total.replies && r.total.ok / r.total.replies >= 0.9 ? t.ok : r.total.replies && r.total.ok / r.total.replies >= 0.75 ? t.warn : t.danger}>{tone}</Text>
        <Text color={t.faint}>{L(`  ${tokens(r.avgTokens)}/resposta · ${duration(r.avgMs)} em média · ${cost}`, `  ${tokens(r.avgTokens)}/reply · ${duration(r.avgMs)} avg · ${cost}`)}</Text>
        {r.problems.length ? <Text color={t.warn}>{L(`  · ${r.problems.length} problema(s)`, `  · ${r.problems.length} problem(s)`)}</Text> : null}
      </Text>
      {r.proposedSkills && r.proposedSkills.length > 0 ? <Text color={t.dim}>{L(`  Propôs: ${r.proposedSkills.map((s) => s.name).join(', ')}`, `  Proposed: ${r.proposedSkills.map((s) => s.name).join(', ')}`)}</Text> : null}
    </Box>
  )
}

// The six weeks behind this one, as a row of ok/total.
function Weeks({ r }: { r: AgentReport }): ReactNode {
  const t = useTheme()
  return <Text color={t.step}>{r.weeks.map((w) => `${w.rate.ok}/${w.rate.replies}`).join(' · ')}</Text>
}

function WeekSheet({ r, name, report }: { r: AgentReport; name: string; report: ReportData }): ReactNode {
  const t = useTheme()
  const cost = r.apiUsd !== undefined ? usd(r.apiUsd) : L('custo não informado', 'cost not reported')
  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{`${name} — ${weekRange(report.since)}`}</Text>
      <Text color={t.text}>{L(`${r.total.ok}/${r.total.replies} ok (${pct(r.total.ok, r.total.replies)}) · ${tokens(r.avgTokens)} tokens e ${duration(r.avgMs)} em média · ${cost}`, `${r.total.ok}/${r.total.replies} ok (${pct(r.total.ok, r.total.replies)}) · ${tokens(r.avgTokens)} tokens and ${duration(r.avgMs)} on average · ${cost}`)}</Text>
      {r.proposedSkills && r.proposedSkills.length > 0 ? <Text color={t.dim}>{L(`Propôs: ${r.proposedSkills.map((s) => s.name).join(', ')}`, `Proposed: ${r.proposedSkills.map((s) => s.name).join(', ')}`)}</Text> : null}
      <Text color={t.dim}>{L(`falhou ${r.failed} · cortada ${r.cut} · pausada ${r.paused} · aprovações ${r.approvals.asked} pedidas, ${r.approvals.refused} recusadas`, `failed ${r.failed} · cut ${r.cut} · paused ${r.paused} · approvals ${r.approvals.asked} asked, ${r.approvals.refused} refused`)}</Text>
      <Text color={t.faint}>{L('As últimas seis semanas (ok/total):', 'Last six weeks (ok/total):')}</Text>
      <Weeks r={r} />
      {r.problems.length ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={t.heading}>{L('Problemas', 'Problems')}</Text>
          {r.problems.map((p) => (
            <Text key={`${p.kind}-${p.messageId}`} color={p.kind === 'failed' ? t.danger : t.warn}>
              {`${problemLabel(p.kind)}${p.kind === 'refused' && p.detail ? ` — ${p.detail}` : ''}  `}
              <Text color={t.faint}>{`${ago(p.at)}${p.detail && p.kind !== 'refused' ? ` · ${p.detail}` : ''}`}</Text>
            </Text>
          ))}
        </Box>
      ) : (
        <Text color={t.faint}>{L('Nada falhou, travou ou foi recusado.', 'Nothing failed, stalled or was refused.')}</Text>
      )}
      {report.work.some((w) => w.agents.includes(r.agentId)) ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={t.heading}>{L('Trabalho que contou para', 'Work it counted toward')}</Text>
          {report.work
            .filter((w) => w.agents.includes(r.agentId))
            .map((w) => (
              <Text key={w.work} color={t.text}>{L(`${w.work}  ${tokens(w.tokens)} · ${w.replies} respostas`, `${w.work}  ${tokens(w.tokens)} · ${w.replies} replies`)}</Text>
            ))}
        </Box>
      ) : null}
    </Box>
  )
}

export function Report({ state, active }: ScreenProps): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const [week, setWeek] = useState(() => startOfWeek(Date.now()))
  const [report, setReport] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    let live = true
    setReport(null)
    store.loadReport(week).then(
      (r) => live && setReport(r),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e))
    )
    return () => {
      live = false
    }
  }, [week, nonce])

  const thisWeek = week === startOfWeek(Date.now())
  const active_ = report?.agents.filter((a) => a.total.replies > 0).sort((a, b) => b.total.replies - a.total.replies) ?? []
  const at = Math.max(0, Math.min(cursor, active_.length - 1))

  useInput(
    (input, key) => {
      if (key.leftArrow) return (setCursor(0), setWeek((w) => shiftWeek(w, -1)))
      if (key.rightArrow) return (setCursor(0), setWeek((w) => shiftWeek(w, 1)))
      if (input === 't') return (setCursor(0), setWeek(startOfWeek(Date.now())))
      if (input === 'r') return setNonce((n) => n + 1)
      if (key.upArrow) return setCursor(Math.max(0, at - 1))
      if (key.downArrow) return setCursor(Math.min(active_.length - 1, at + 1))
      if (!report) return
      const r = active_[at]
      if (key.return && r) {
        const name = agentById(state, r.agentId)?.name ?? L('agente', 'agent')
        overlay.sheet({ title: `${name} — ${weekRange(report.since)}`, render: () => <WeekSheet r={r} name={name} report={report} /> })
      }
    },
    { isActive: active }
  )

  if (error) return <Text color={t.danger}>{L(`O boletim não pôde carregar: ${error}`, `Report could not load: ${error}`)}</Text>

  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{L(`Boletim — ${weekRange(week)}`, `Report — ${weekRange(week)}`)}</Text>
      {!thisWeek ? <Text color={t.faint}>{L('não é esta semana · t volta para ela', 'not this week · t comes back to it')}</Text> : null}
      {!report ? (
        <Text color={t.faint}>{L('Calculando…', 'Crunching…')}</Text>
      ) : (
        <>
          {(() => {
            const ok = report.agents.reduce((n, a) => n + a.total.ok, 0)
            const all = report.agents.reduce((n, a) => n + a.total.replies, 0)
            const ratio = all ? ok / all : undefined
            const mood = ratio === undefined ? '' : ratio >= 0.9 ? L('Semana boa', 'Good week') : ratio >= 0.75 ? L('Semana razoável', 'Fair week') : L('Semana difícil', 'Rough week')
            return (
              <Text color={t.text}>
                {all === 0 ? (thisWeek ? L('Nenhuma resposta dos agentes ainda nesta semana.', 'No replies from the agents yet this week.') : L('Nenhuma resposta dos agentes nesta semana.', 'No replies from the agents this week.')) : L(`${mood}: ${pct(ok, all)} das ${all} respostas terminaram bem.`, `${mood}: ${pct(ok, all)} of ${all} replies ended well.`)}
              </Text>
            )
          })()}

          <Box marginTop={1} flexDirection="column">
            <Text bold color={t.heading}>{L('Por agente', 'By agent')}</Text>
            {active_.length ? (
              active_.map((r, i) => <AgentLine key={r.agentId} r={r} name={agentById(state, r.agentId)?.name ?? L('agente', 'agent')} selected={i === at} active={active} />)
            ) : (
              <Text color={t.faint}>{L('Nenhum agente respondeu nesta semana.', 'No agent replied this week.')}</Text>
            )}
          </Box>

          {active_[at]?.problems.length ? (
            <Box marginTop={1} flexDirection="column">
              <Text bold color={t.heading}>{L('Problemas', 'Problems')}</Text>
              {active_[at]!.problems.map((p) => (
                <Text key={`${p.kind}-${p.messageId}`} color={p.kind === 'failed' ? t.danger : t.warn}>
                  {`${problemLabel(p.kind)}${p.detail ? ` — ${p.detail}` : ''}  `}
                  <Text color={t.faint}>{ago(p.at)}</Text>
                </Text>
              ))}
            </Box>
          ) : null}

          {report.skills.length ? (
            <Box marginTop={1} flexDirection="column">
              <Text bold color={t.heading}>Skills</Text>
              {report.skills.map((s) => (
                <Text key={s.skillId} color={t.text}>
                  {`${s.name.padEnd(20)}`}
                  <Text color={t.dim}>{L(`${s.reads.ok}/${s.reads.replies} respostas leram`, `${s.reads.ok}/${s.reads.replies} replies read it`)}</Text>
                  {s.before && s.since ? <Text color={t.faint}>{L(`  · antes ${pct(s.before.ok, s.before.replies)} → depois ${pct(s.since.ok, s.since.replies)}`, `  · before ${pct(s.before.ok, s.before.replies)} → after ${pct(s.since.ok, s.since.replies)}`)}</Text> : null}
                </Text>
              ))}
            </Box>
          ) : null}

          {report.work.length ? (
            <Box marginTop={1} flexDirection="column">
              <Text bold color={t.heading}>{L('Por tarefa', 'By task')}</Text>
              {report.work.map((w) => (
                <Text key={w.work} color={t.text}>
                  {`${w.work.padEnd(10)}`}
                  <Text color={t.dim}>{`${w.agents.map((id) => agentById(state, id)?.name ?? id).join(', ')}  `}</Text>
                  {L(`${tokens(w.tokens)} · ${w.replies} respostas  `, `${tokens(w.tokens)} · ${w.replies} replies  `)}
                  <Text color={t.faint}>{ago(w.last)}</Text>
                </Text>
              ))}
            </Box>
          ) : null}
        </>
      )}

      {active ? <Hint keys={[['← →', 'change week'], ['t', 'this week'], ['r', 'reload'], ['↑ ↓', 'agents'], ['Enter', 'open the week']]} /> : null}
    </Box>
  )
}
