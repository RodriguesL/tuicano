// The conversation screen, end to end (spec §3.3 #1, P1): the message text, the
// author, the receipt line, the artifacts, the approval card — and the keys that
// reach the store. The state is built from real CoreEvents through the same reduce
// the client runs, so these are the shapes the core actually sends.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Conversation } from '../src/tuicano/screens/Conversation'
import { store } from '../src/tuicano/store'
import { agent, approval, artifact, channel, KEY, memory, message, mount, routine, stateOf } from './helpers/screen'
import type { CoreEvent } from '../src/shared/rpc'

const receipt = { model: 'sonnet', inputTokens: 1000, cacheReadTokens: 200, outputTokens: 50, ms: 1500, apiCostUsd: 0.002 }

// m2 is a finished reply carrying everything a reply can carry; m3 asks a question
// and proposes an agent; m4 works, m5 is paused at the budget, m6 waits on the gate.
const events = (): CoreEvent[] => [
  { type: 'agent', agent: agent({ id: 'a1', name: 'Lia' }) },
  { type: 'conversation', conversation: channel({ id: 'c1', name: 'geral', members: ['a1'] }) },
  { type: 'message', message: message({ id: 'm1', conversationId: 'c1', author: { kind: 'me' }, text: 'ola tudo bem', at: 1 }) },
  {
    type: 'message',
    message: message({
      id: 'm2',
      conversationId: 'c1',
      author: { kind: 'agent', id: 'a1' },
      text: 'fiz o relatorio',
      at: 2,
      run: {
        status: 'done',
        steps: [
          { id: 's1', label: 'ler o repositorio', status: 'done', ms: 120 },
          { id: 's2', label: 'rodar os testes', status: 'error', ms: 500, note: 'falhou o teste' }
        ],
        receipt,
        artifactIds: ['ar1'],
        memoryIds: ['me1'],
        routineIds: ['r1'],
        services: ['web']
      }
    })
  },
  {
    type: 'message',
    message: message({
      id: 'm3',
      conversationId: 'c1',
      author: { kind: 'agent', id: 'a1' },
      text: 'preciso de uma decisao',
      at: 3,
      run: { status: 'waiting_input', steps: [], question: 'qual a capital?', agentDraft: { name: 'Bia', role: 'Pesquisa', color: 'rose', instructions: 'pesquisa fontes', modelId: 'sonnet', effort: 'low', web: true, grants: {} } }
    })
  },
  { type: 'message', message: message({ id: 'm4', conversationId: 'c1', author: { kind: 'agent', id: 'a1' }, text: 'trabalhando', at: 4, run: { status: 'working', steps: [] } }) },
  { type: 'message', message: message({ id: 'm5', conversationId: 'c1', author: { kind: 'agent', id: 'a1' }, text: 'pausei', at: 5, run: { status: 'paused', steps: [], budget: 12_345 } }) },
  { type: 'message', message: message({ id: 'm6', conversationId: 'c1', author: { kind: 'agent', id: 'a1' }, text: 'preciso de acesso', at: 6, run: { status: 'waiting_approval', steps: [], approvalId: 'ap1' } }) },
  { type: 'artifact', artifact: artifact({ id: 'ar1', kind: 'markdown', name: 'notas.md', title: 'Notas', source: 'https://example.com/notas', size: 2048 }) },
  { type: 'memory', memory: memory({ id: 'me1', state: 'pending', text: 'Prefere respostas curtas' }) },
  { type: 'routine', routine: routine({ id: 'r1', name: 'Resumo do dia' }) },
  { type: 'approval', approval: approval({ id: 'ap1', messageId: 'm6', connectorName: 'Tasks', tool: 'delete_task' }) }
]

const render = (): ReturnType<typeof mount> => {
  const state = stateOf(...events())
  return mount(() => <Conversation state={state} active id="c1" onImage={() => {}} />)
}

// Ink flushes an arrow key on a timer (the escape-sequence timeout), so a press
// only lands after a tick — and each key needs its own.
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 25))
const go = async (m: ReturnType<typeof mount>, n: number): Promise<void> => {
  for (let i = 0; i < n; i++) {
    m.press(KEY.down)
    await tick()
  }
}

afterEach(() => vi.restoreAllMocks())

describe('the conversation screen', () => {
  it('shows the message, the author, the receipt line, the artifacts and what the reply left behind', () => {
    const m = render()
    const frame = m.frame()
    expect(frame).toContain('fiz o relatorio')
    expect(frame).toContain('Lia')
    expect(frame).toContain('sonnet')
    expect(frame).toContain('50 out')
    expect(frame).toContain('notas.md')
    expect(frame).toContain('Prefere respostas curtas')
    expect(frame).toContain('Resumo do dia')
    expect(frame).toContain('service: web')
    expect(frame).toContain('qual a capital?')
    expect(frame).toContain('Bia')
    m.unmount()
  })

  it('shows the approval card when the selected reply is waiting on the gate', async () => {
    const m = render()
    await go(m, 5) // m6
    expect(m.frame()).toContain('approval · Tasks · delete_task')
    m.unmount()
  })

  it('e expands the selected reply steps, showing the status and the note', async () => {
    const m = render()
    await go(m, 1) // m2
    expect(m.frame()).not.toContain('falhou o teste')
    m.press('e')
    await tick()
    const frame = m.frame()
    expect(frame).toContain('falhou o teste')
    expect(frame).toContain('rodar os testes')
    expect(frame).toContain('500 ms')
    m.unmount()
  })

  it('t opens the receipt sheet for the selected reply', async () => {
    const m = render()
    await go(m, 1) // m2
    m.press('t')
    await tick()
    expect(m.overlay.calls.some((c) => c.kind === 'sheet' && c.title === 'Receipt')).toBe(true)
    m.unmount()
  })

  it('a opens the artifact panel for the selected reply', async () => {
    const m = render()
    await go(m, 1) // m2
    m.press('a')
    await tick()
    const panel = m.overlay.calls.find((c) => c.kind === 'panel')
    expect(panel?.value).toEqual({ kind: 'artifact', id: 'ar1' })
    m.unmount()
  })

  it('Enter on a reply that started a service opens the service panel', async () => {
    const m = render()
    await go(m, 1) // m2
    m.press(KEY.enter)
    await tick()
    const panel = m.overlay.calls.find((c) => c.kind === 'panel')
    expect(panel?.value).toEqual({ kind: 'service', agentId: 'a1', name: 'web' })
    m.unmount()
  })

  it('y keeps and x discards a pending memory this reply proposed', async () => {
    const decide = vi.spyOn(store, 'decideMemory').mockImplementation(() => {})
    const m = render()
    await go(m, 1) // m2
    m.press('y')
    await tick()
    expect(decide).toHaveBeenCalledWith('me1', true)
    m.press('x')
    await tick()
    expect(decide).toHaveBeenCalledWith('me1', false)
    m.unmount()
  })

  it('f forgets a memory with a reason prompt', async () => {
    const forget = vi.spyOn(store, 'forgetMemory').mockImplementation(() => {})
    const m = render()
    await go(m, 1) // m2
    m.press('f')
    await tick()
    const prompt = m.overlay.calls.find((c) => c.kind === 'prompt')
    expect(prompt).toBeTruthy()
    ;(prompt!.value as { onSubmit: (s: string) => void }).onSubmit('ja nao vale')
    expect(forget).toHaveBeenCalledWith('me1', 'ja nao vale')
    m.unmount()
  })

  it('c creates the agent the Tuca proposed and follows it to its DM', async () => {
    const create = vi.spyOn(store, 'createFromDraft').mockResolvedValue({ agentId: 'a9', conversationId: 'd9' })
    const m = render()
    await go(m, 2) // m3
    m.press('c')
    await vi.waitFor(() => expect(create).toHaveBeenCalledWith('m3'))
    m.unmount()
  })

  it('d dismisses the draft and E opens it in the builder screen', async () => {
    const settle = vi.spyOn(store, 'settleDraft').mockImplementation(() => {})
    const navigate = vi.spyOn(store, 'navigate').mockImplementation(() => {})
    const m = render()
    await go(m, 2) // m3
    m.press('d')
    await tick()
    expect(settle).toHaveBeenCalledWith('m3')
    m.press('E')
    await tick()
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'new-agent', fromMessage: 'm3' }))
    m.unmount()
  })

  it('s, r and C reach stop, retry and continue', async () => {
    const stop = vi.spyOn(store, 'stopRun').mockImplementation(() => {})
    const retry = vi.spyOn(store, 'retryRun').mockImplementation(() => {})
    const cont = vi.spyOn(store, 'continueRun').mockImplementation(() => {})
    const m = render()
    await go(m, 3) // m4, working
    m.press('s')
    await tick()
    expect(stop).toHaveBeenCalledWith('m4')
    await go(m, 1) // m5, paused
    m.press('C')
    await tick()
    expect(cont).toHaveBeenCalledWith('m5')
    m.unmount()

    const m2 = render()
    await go(m2, 1) // m2
    m2.press('r')
    await tick()
    expect(retry).toHaveBeenCalledWith('m2')
    m2.unmount()
  })
})
