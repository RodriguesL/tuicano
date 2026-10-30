// A conversation in text (spec §3.3): the messages, the steps of each reply, its
// receipt, the artifacts it showed and the approval card that stops it — the same
// state and the same gate as the window, with the cursor standing in for the mouse.
// P1 finishes the screen: steps expand, the receipt opens, the Tuca's draft and the
// in-conversation memory cards act, and a question says how it is answered.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { agentById, browserOf, conversationMessages, conversationTitle, pendingApprovals } from '../store'
import { store } from '../store'
import { slug } from '../../app/store'
import { L } from '../../shared/lang'
import { useOverlay, type ScreenProps } from '../overlays/api'
import { useApprovalGate } from '../useApprovals'
import { useTheme } from '../theme/context'
import { runtime } from '../runtime'
import { ImageOverlay } from '../graphics/viewer'
import { mimeOfName, pictureOfDataUrl, prepare } from '../graphics/transport'
import { duration, time, tokens, usd } from '../../shared/format'
import { Hint, CURSOR, Spinner, Table } from '../ui/kit'
import { ACCESS_REQUEST, countedTokens, modelInfo, type Agent, type AgentDraft, type Artifact, type Memory, type Message, type Run } from '../../shared/types'

export function Conversation({ state, active, id, onImage }: ScreenProps & { id: string; onImage: (n: ReactNode | null) => void }): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const { armed, press } = useApprovalGate()
  const [cursor, setCursor] = useState(0)
  // A sub-cursor over the selected reply's artifacts and memory lines (spec §3.6 G3):
  // ←/→ move it when the reply has more than one of that thing, and the keys that act
  // (`a`, `v`, `y`/`x`, `f`, `c`) act on what it points at instead of the first match.
  const [sub, setSub] = useState(0)
  // The reply whose steps are open, by message id: the toggle survives a re-render
  // and moving the cursor does not collapse what was opened (spec §3.1 #2, the GUI's steps toggle).
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const messages = conversationMessages(state, id)
  const conversation = state.conversations.find((c) => c.id === id)
  const approvals = pendingApprovals(state)
  const at = Math.max(0, Math.min(cursor, messages.length - 1))
  const selected = messages[at]
  const approval = selected?.run?.approvalId ? approvals.find((a) => a.id === selected.run!.approvalId) : undefined

  const artifacts: Artifact[] = (selected?.run?.artifactIds ?? []).map((aid) => state.artifacts.find((x) => x.id === aid)).filter((a): a is Artifact => !!a)
  const memories: Memory[] = (selected?.run?.memoryIds ?? []).map((mid) => state.memories.find((m) => m.id === mid)).filter((m): m is Memory => !!m)
  const draft: AgentDraft | undefined = selected?.run?.agentDraft
  const services = selected?.run?.services ?? []
  const authorAgent = selected?.author.kind === 'agent' ? selected.author.id : undefined
  // What the sub-cursor points at: one index over the selected reply's artifacts and
  // memory lines, clamped to whichever list is longer (a reply rarely has both).
  const subMax = Math.max(artifacts.length, memories.length)
  const subAt = subMax ? Math.max(0, Math.min(sub, subMax - 1)) : 0
  const artifactAt = artifacts.length ? artifacts[Math.min(subAt, artifacts.length - 1)] : undefined
  const memoryAt = memories.length ? memories[Math.min(subAt, memories.length - 1)] : undefined

  // What the picture would be, if this reply has one (spec §2.1): the live frame of
  // the agent's browser, or an image artifact it showed. `target` is the artifact the
  // sub-cursor is on, when it is an image (spec §3.6 G3).
  const picture = (m: Message | undefined, target?: Artifact): ReturnType<typeof prepare> | null => {
    if (!m) return null
    if (target) {
      const mime = mimeOfName(target.name)
      if (mime) {
        try {
          return prepare(new Uint8Array(readFileSync(join(runtime.dataDir, 'artifacts', target.id, target.name))), mime, runtime.protocol)
        } catch {
          return null
        }
      }
    }
    const frame = m.run?.browser && m.author.kind === 'agent' ? browserOf(state, m.author.id)?.frame : undefined
    const fromFrame = frame ? pictureOfDataUrl(frame) : null
    if (fromFrame) return prepare(fromFrame.bytes, fromFrame.mime, runtime.protocol)
    for (const artifactId of m.run?.artifactIds ?? []) {
      const a: Artifact | undefined = state.artifacts.find((x) => x.id === artifactId)
      const mime = a ? mimeOfName(a.name) : undefined
      if (!a || !mime) continue
      try {
        return prepare(new Uint8Array(readFileSync(join(runtime.dataDir, 'artifacts', a.id, a.name))), mime, runtime.protocol)
      } catch {
        return null
      }
    }
    return null
  }

  const openLink = (m: Message | undefined): void => {
    if (!m) return
    const artifact = (m.run?.artifactIds ?? []).map((aid) => state.artifacts.find((x) => x.id === aid)).find((a) => a?.source?.startsWith('http'))
    const url = artifact?.source ?? /https?:\/\/\S+/.exec(m.text)?.[0]
    if (url) store.openExternal(url)
    else overlay.note(L('nenhum link aqui', 'no link here'))
  }

  // A draft is an AgentDraft; the builder screen edits an Agent, so copy the draft's
  // fields onto a fresh one — the same translation the GUI does (Tuca.tsx).
  const draftAgent = (d: AgentDraft): Agent => ({
    ...store.newAgentDraft(),
    name: d.name,
    handle: slug(d.name),
    role: d.role,
    color: d.color,
    instructions: d.instructions,
    modelId: d.modelId,
    effort: d.effort,
    web: d.web,
    grants: d.grants
  })

  // Create the agent the Tuca proposed, then follow it into its new DM (spec §3.1 #16).
  const createDraft = async (messageId: string): Promise<void> => {
    try {
      const { conversationId } = await store.createFromDraft(messageId)
      store.navigate({ kind: 'conversation', id: conversationId })
      overlay.note(L('agente criado', 'agent created'))
    } catch (e) {
      overlay.note(e instanceof Error ? e.message : String(e))
    }
  }

  useInput(
    (input, key) => {
      if (key.upArrow || input === 'k') return (setSub(0), setCursor(Math.max(0, at - 1)))
      if (key.downArrow || input === 'j') return (setSub(0), setCursor(Math.min(messages.length - 1, at + 1)))
      // The sub-cursor: only moves when the selected reply has more than one artifact
      // or memory line (spec §3.6 G3), so a single one needs no extra keypress.
      if (subMax > 1) {
        if (key.leftArrow || input === '[') return setSub((s) => Math.max(0, Math.min(subMax - 1, s - 1)))
        if (key.rightArrow || input === ']') return setSub((s) => Math.min(subMax - 1, s + 1))
      }
      if ((input === 'y' || input === 'Y' || input === 'x') && approval) return press(approval, input)
      if (input === 't') {
        if (!selected?.run) return overlay.note(L('nenhuma resposta aqui', 'no reply here'))
        return overlay.sheet({ title: L('Recibo', 'Receipt'), render: () => <ReceiptSheet run={selected.run!} /> })
      }
      if (!selected?.run) return
      if (input === 'e' && selected.run.steps.length) return setExpandedId((was) => (was === selected.id ? null : selected.id))
      if (input === 's' && selected.run.status === 'working') return store.stopRun(selected.id)
      if (input === 'r') return store.retryRun(selected.id)
      if (input === 'C' && selected.run.status === 'paused') return store.continueRun(selected.id)
      if (input === 'v') {
        const target = artifactAt && mimeOfName(artifactAt.name) ? artifactAt : undefined
        const p = picture(selected, target)
        return p ? onImage(<ImageOverlay prepared={p} cell={runtime.cell} />) : overlay.note(L('esta mensagem não tem imagem', 'this message has no image'))
      }
      if (input === 'o') return openLink(selected)
      // In a DM, the agent's own page — where the window's header takes you.
      if (input === 'A' && conversation?.kind === 'dm') return store.navigate({ kind: 'agent', id: conversation.name })
      if (input === 'S' && conversation) {
        return overlay.sheet({
          title: L(`Resumo de ${conversation.kind === 'channel' ? `#${conversation.name}` : conversationTitle(state, conversation)}`, `Summary of ${conversation.kind === 'channel' ? `#${conversation.name}` : conversationTitle(state, conversation)}`),
          render: () => <Summary state={state} conversationId={id} />
        })
      }
      // `a`: the artifact panel, for the one the sub-cursor is on (spec §3.6 G3).
      if (input === 'a') {
        if (!artifactAt) return overlay.note(L('esta resposta não mostrou artefato', 'this reply showed no artifact'))
        return overlay.panel({ kind: 'artifact', id: artifactAt.id })
      }
      // Enter on a service the reply started opens its panel (spec §3.1 #38).
      if (key.return && services.length && authorAgent) return overlay.panel({ kind: 'service', agentId: authorAgent, name: services[0]! })
      // The Tuca's card (spec §3.1 #16, #17): create, edit first, or dismiss.
      if (draft && !draft.state) {
        if (input === 'c') return void createDraft(selected.id)
        if (input === 'd') {
          store.settleDraft(selected.id)
          return overlay.note(L('rascunho descartado', 'draft dismissed'))
        }
        if (input === 'E') return store.navigate({ kind: 'new-agent', draft: draftAgent(draft), fromMessage: selected.id })
      }
      // Memories this reply touched: the pending one under the sub-cursor takes y/x,
      // an active one takes c (spec §3.6 G3).
      const pending = memoryAt?.state === 'pending' ? memoryAt : undefined
      if ((input === 'y' || input === 'x') && pending) {
        store.decideMemory(pending.id, input === 'y')
        return overlay.note(input === 'y' ? L('memória guardada', 'memory kept') : L('memória descartada', 'memory discarded'))
      }
      if (input === 'c' && memoryAt?.state === 'active') {
        store.confirmMemory(memoryAt.id)
        return overlay.note(L('memória confirmada', 'memory confirmed'))
      }
      if (input === 'f') {
        const m = memoryAt
        if (!m) return
        return overlay.prompt({
          title: L(`Esquecer: ${m.text.slice(0, 40)}`, `Forget: ${m.text.slice(0, 40)}`),
          label: L('Motivo (opcional)', 'Reason (optional)'),
          hint: L('O agente é avisado por quê, e para de contar com isso.', 'The agent is told why, and stops relying on it.'),
          onSubmit: (reason) => {
            store.forgetMemory(m.id, reason.trim() || undefined)
            overlay.note(L('memória esquecida', 'memory forgotten'))
          },
          onCancel: () => overlay.note(undefined)
        })
      }
    },
    { isActive: active }
  )

  if (!conversation) return <Text color={t.faint}>{L('Conversa não encontrada.', 'Conversation not found.')}</Text>
  const title = conversation.kind === 'channel' ? `#${conversation.name}` : conversationTitle(state, conversation)
  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>
        {title}
        {conversation.topic ? <Text color={t.dim}>{`  ${conversation.topic}`}</Text> : null}
      </Text>
      {messages.length === 0 ? <Text color={t.faint}>{L('Nada por aqui ainda. Aperte i para escrever.', 'Nothing here yet. Press i to write.')}</Text> : null}
      {messages.map((m, i) => (
        <MessageView key={m.id} state={state} m={m} sub={subAt} selected={i === at && active} expanded={expandedId === m.id} armed={armed} approval={approval?.id === m.run?.approvalId ? approval : undefined} />
      ))}
      {active ? <Hint keys={[['↑↓', 'message'], ['← →', 'artifact/memory'], ['e', 'steps'], ['t', 'receipt'], ['s', 'stop'], ['r', 'retry'], ['C', 'continue'], ['v', 'image'], ['a', 'artifact'], ['o', 'link'], ['Enter', 'service'], ['c', 'create/confirm'], ['d', 'dismiss'], ['E', 'edit draft'], ['y/x', 'approve/memory'], ['f', 'forget'], ['S', 'summary']]} /> : null}
    </Box>
  )
}

const LABEL = (m: Message, name: string | undefined): { text: string; color: (t: ReturnType<typeof useTheme>) => string } => {
  if (m.author.kind === 'me') return { text: L('eu', 'me'), color: (t) => t.me }
  if (m.author.kind === 'agent') return { text: name ?? L('agente', 'agent'), color: (t) => t.accentAlt }
  if (m.author.kind === 'routine') return { text: L('rotina', 'routine'), color: (t) => t.routine }
  return { text: L('sistema', 'system'), color: (t) => t.system }
}

function MessageView({ state, m, sub, selected, expanded, armed, approval }: { state: ScreenProps['state']; m: Message; sub: number; selected: boolean; expanded: boolean; armed?: string; approval?: { id: string; highRisk: boolean; tool: string; connectorName: string; why: string; args: Record<string, unknown>; state: string; expiresAt: number } }): ReactNode {
  const t = useTheme()
  const agent = m.author.kind === 'agent' ? agentById(state, m.author.id) : undefined
  const label = LABEL(m, agent?.name)
  const run = m.run
  const status = ((): { text: string; color: string } | null => {
    if (!run || run.status === 'done') return null
    const map: Record<string, string> = {
      working: L('trabalhando…', 'working…'),
      waiting_approval: L('esperando você', 'waiting for you'),
      waiting_input: L('perguntou algo', 'asked you something'),
      paused: L('pausado no teto', 'paused at the budget'),
      limit_reached: L('no limite', 'hit the limit'),
      failed: L('falhou', 'failed'),
      interrupted: L('interrompido', 'interrupted'),
      stopped: L('interrompido', 'stopped')
    }
    return { text: map[run.status] ?? run.status, color: run.status === 'failed' ? t.danger : run.status === 'working' ? t.working : t.waiting }
  })()
  const artifacts = (run?.artifactIds ?? []).map((aid) => state.artifacts.find((x) => x.id === aid)).filter((a): a is Artifact => !!a)
  const memories = (run?.memoryIds ?? []).map((mid) => state.memories.find((x) => x.id === mid)).filter((x): x is Memory => !!x)
  const routines = (run?.routineIds ?? []).map((rid) => state.routines.find((x) => x.id === rid)).filter((r) => !!r)
  // The sub-cursor the selected reply is on, clamped per list (spec §3.6 G3).
  const artSub = artifacts.length ? Math.min(sub, artifacts.length - 1) : -1
  const memSub = memories.length ? Math.min(sub, memories.length - 1) : -1
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text inverse={selected}>
        {`${selected ? `${CURSOR} ` : '  '}`}
        <Text color={label.color(t)} bold>
          {label.text}
        </Text>
        <Text color={t.faint}>{` · ${time(m.at)}`}</Text>
        {run?.status === 'working' ? (
          <Text>{' · '}<Spinner busy label={L('trabalhando…', 'working…')} /></Text>
        ) : status ? (
          <Text color={status.color}>{` · ${status.text}`}</Text>
        ) : null}
        {run?.receipt ? (
          <Text color={t.step}>
            {` · ${run.receipt.model} · ${tokens(run.receipt.outputTokens)} ${L('saída', 'out')} · ${duration(run.receipt.ms)}`}
          </Text>
        ) : null}
      </Text>
      <Text color={t.text}>{m.text}</Text>
      {run?.steps.length ? (
        expanded ? (
          <Box flexDirection="column" paddingLeft={4}>
            {run.steps.map((s, i) => (
              <Text key={s.id ?? i} color={s.status === 'error' ? t.danger : s.status === 'running' ? t.working : t.step}>
                {`${s.status === 'done' ? '✓' : s.status === 'error' ? '✗' : '·'} ${s.label} · ${s.status}${s.ms !== undefined ? ` · ${duration(s.ms)}` : ''}`}
                {s.note ? <Text color={t.dim}>{` — ${s.note}`}</Text> : null}
              </Text>
            ))}
          </Box>
        ) : (
          <Text color={t.step}>{L(`    ${run.steps.length} passo(s): ${run.steps.at(-1)?.label ?? ''} · e expande`, `    ${run.steps.length} step(s): ${run.steps.at(-1)?.label ?? ''} · e expands`)}</Text>
        )
      ) : null}
      {run?.question ? (
        <Box flexDirection="column">
          <Text color={t.waiting}>{L(`    perguntou: ${run.question}`, `    asked: ${run.question}`)}</Text>
          {run.status === 'waiting_input' ? <Text color={t.dim}>{L('    responda escrevendo uma mensagem (i)', '    answer by writing a message (i)')}</Text> : null}
        </Box>
      ) : null}
      {artifacts.map((a, i) => (
        <Text key={a.id} color={t.placeholder}>
          {`    ${selected && i === artSub ? `${CURSOR} ` : '  '}[${a.kind} ${a.name}]`} <Text color={t.dim}>{a.kind === 'image' ? 'a opens the panel · v shows it' : 'a opens the panel'}</Text>
        </Text>
      ))}
      {run?.agentDraft ? <DraftCard d={run.agentDraft} /> : null}
      {memories.map((mem, i) => (
        <Text key={mem.id} color={mem.state === 'pending' ? t.waiting : mem.state === 'forgotten' ? t.faint : t.ok}>
          {`    ${selected && i === memSub ? `${CURSOR} ` : '  '}${memoryLabel(mem.state)}: ${mem.text}`}
          {mem.state === 'pending' ? <Text color={t.dim}>{'  · y keep · x discard'}</Text> : null}
        </Text>
      ))}
      {routines.map((r) => (
        <Text key={r.id} color={t.routine}>{L(`    agendada: ${r.name}`, `    scheduled: ${r.name}`)}</Text>
      ))}
      {run?.services?.map((name) => (
        <Text key={name} color={t.dim}>{L(`    serviço: ${name} · Enter abre o painel`, `    service: ${name} · Enter opens the panel`)}</Text>
      ))}
      {run?.status === 'paused' ? <Text color={t.warn}>{L(`    pausado no teto: ${tokens(run.budget ?? 0)} tokens · C continua`, `    paused at the budget: ${tokens(run.budget ?? 0)} tokens · C continues`)}</Text> : null}
      {run?.error ? <Text color={t.danger}>{`    ${run.error}`}</Text> : null}
      {approval ? (
        <Box flexDirection="column" borderStyle="round" borderColor={armed === approval.id || approval.highRisk ? t.danger : t.warn} paddingX={1}>
          <Text bold color={approval.highRisk ? t.danger : t.warn}>
            {`${L('aprovação', 'approval')} · ${approval.connectorName} · ${approval.tool === ACCESS_REQUEST ? L('pedido de acesso', 'access request') : approval.tool}`}
            {approval.highRisk ? L(' · ALTO RISCO', ' · HIGH RISK') : ''}
          </Text>
          {approval.why ? <Text color={t.dim}>{approval.why}</Text> : null}
          <Text color={t.faint}>{JSON.stringify(approval.args)}</Text>
          <Text color={armed === approval.id ? t.danger : t.faint}>
            {armed === approval.id ? 'press again within 3 s to confirm' : 'y approve · x refuse · Y always allow'}
          </Text>
        </Box>
      ) : null}
    </Box>
  )
}

// The GUI labels each memory chip by its state (spec §3.4 #13); the same words here.
const memoryLabel = (state: Memory['state']): string => {
  if (state === 'active') return L('Guardou', 'Kept')
  if (state === 'pending') return L('Quer guardar', 'Wants to keep')
  if (state === 'archived') return L('Guardou (depois atualizada)', 'Kept (later updated)')
  return L('Esquecida', 'Forgotten')
}

// The Tuca proposed an agent with `propor_agente` (spec §3.4 #13): a card with its
// state and the three keys that act on it.
function DraftCard({ d }: { d: AgentDraft }): ReactNode {
  const t = useTheme()
  const state = d.state === 'created' ? L('criado', 'created') : d.state === 'dismissed' ? L('descartado', 'dismissed') : L('proposta', 'proposed')
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={d.state ? t.border : t.accent} paddingX={1} marginTop={0}>
      <Text bold color={t.heading}>
        {`${d.name} · ${d.role || L('agente', 'agent')} `}
        <Text color={t.faint}>{L(`· proposta do Tuca (${state})`, `· proposed by Tuca (${state})`)}</Text>
      </Text>
      {d.instructions ? <Text color={t.dim}>{d.instructions.slice(0, 160)}</Text> : null}
      <Text color={t.faint}>{`${d.modelId} · ${d.effort}${d.web ? L(' · web', ' · web') : ''}`}</Text>
      {d.reason ? <Text color={t.dim}>{d.reason}</Text> : null}
      {!d.state ? <Text color={t.faint}>{'c create · E edit first · d dismiss'}</Text> : null}
    </Box>
  )
}

// The per-turn receipt (spec §9, the GUI's ReceiptLine): what this reply spent. A
// reply that ran several turns (a retry, a continuation) lists one row per turn and
// a total; a single receipt reads exactly as before.
function ReceiptSheet({ run }: { run: Run }): ReactNode {
  const t = useTheme()
  const r = run.receipt
  if (!r) return <Text color={t.faint}>{L('O core ainda não informou um recibo para esta resposta.', 'The core has not reported a receipt for this reply yet.')}</Text>
  const turns = run.receipts && run.receipts.length > 1 ? run.receipts : undefined
  if (turns) {
    const total = turns.reduce((n, x) => n + countedTokens(x), 0)
    const ms = turns.reduce((n, x) => n + x.ms, 0)
    const cost = turns.reduce((n, x) => n + (x.apiCostUsd ?? 0), 0)
    const priced = turns.some((x) => x.apiCostUsd !== undefined)
    const rows: Record<string, string>[] = [
      ...turns.map((turn, i) => ({
        k: `${i + 1} · ${modelInfo(turn.model)?.label ?? turn.model}`,
        v: `${tokens(countedTokens(turn))} · ${duration(turn.ms)}${turn.apiCostUsd !== undefined ? ` · ${usd(turn.apiCostUsd)}` : ''}`
      })),
      { k: L('Total', 'Total'), v: `${tokens(total)} · ${duration(ms)}${priced ? ` · ${usd(cost)}` : ''}` }
    ]
    return (
      <Box flexDirection="column">
        <Table columns={[{ key: 'k', label: L('Turno', 'Turn') }, { key: 'v', label: '' }]} rows={rows} />
        {run.steps.length > 1 ? <Text color={t.faint}>{L(`${run.steps.length} passos · e expande a lista na conversa`, `${run.steps.length} steps · e expands the list in the conversation`)}</Text> : null}
      </Box>
    )
  }
  const rows: Record<string, string>[] = [
    { k: L('Modelo', 'Model'), v: r.model },
    { k: L('Entrada', 'Input'), v: tokens(r.inputTokens - r.cacheReadTokens) },
    { k: L('Do cache', 'Cache read'), v: tokens(r.cacheReadTokens) },
    { k: L('Saída', 'Output'), v: tokens(r.outputTokens) },
    { k: L('Tempo', 'Time'), v: duration(r.ms) },
    { k: L('Custo na API', 'API cost'), v: r.apiCostUsd !== undefined ? usd(r.apiCostUsd) : '—' }
  ]
  return (
    <Box flexDirection="column">
      <Table columns={[{ key: 'k', label: '' }, { key: 'v', label: L('Resposta', 'Reply') }]} rows={rows} />
      {run.steps.length > 1 ? <Text color={t.faint}>{L(`${run.steps.length} passos · e expande a lista na conversa`, `${run.steps.length} steps · e expands the list in the conversation`)}</Text> : null}
    </Box>
  )
}

function Summary({ state, conversationId }: { state: ScreenProps['state']; conversationId: string }): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const conversation = state.conversations.find((c) => c.id === conversationId)
  const [text, setText] = useState(conversation?.summary ?? '')
  return (
    <Box flexDirection="column">
      <Text color={t.dim}>{L('O que esta conversa já cobriu antes das mensagens recentes. Editar muda o que todo agente lê.', 'What this conversation covered before its recent messages. Fixing it changes what every agent reads.')}</Text>
      <Text color={t.text}>{text || <Text color={t.faint}>{L('(ainda não há resumo)', '(no summary yet)')}</Text>}</Text>
      <Text color={t.faint}>
        <Text color={t.dim}>e</Text> edit {' · '}
        <Text color={t.dim}>s</Text> summarize now {' · '}
        <Text color={t.dim}>Esc</Text> close
      </Text>
      <SummaryKeys conversationId={conversationId} text={text} setText={setText} onClose={overlay.close} />
    </Box>
  )
}

function SummaryKeys({ conversationId, text, setText, onClose }: { conversationId: string; text: string; setText: (s: string) => void; onClose: () => void }): ReactNode {
  const overlay = useOverlay()
  useInput(
    (input, key) => {
      if (key.escape) return onClose()
      if (input === 's') {
        store.summarizeNow(conversationId)
        overlay.note(L('resumindo…', 'summarizing…'))
        return
      }
      if (input === 'e') {
        overlay.prompt({
          title: L('Resumo', 'Summary'),
          label: L('Texto', 'Text'),
          value: text,
          onSubmit: (value) => {
            store.editSummary(conversationId, value)
            setText(value)
            overlay.note(L('resumo salvo', 'summary saved'))
          }
        })
      }
    },
    { isActive: true }
  )
  return null
}
