// Routines (spec §3.1 #43, #55, #65, #66; view §3.3 #9): requests for an agent that
// run on their own, at a time or when something happens. The list carries who runs
// it, when, whether it is on, where it posts and when it last ran; the form is the
// GUI's form in text (src/renderer/.../Routines.tsx), and `saveRoutine` throws the
// message the form shows.
import { useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { agentById, store } from '../store'
import { useOverlay, type ScreenProps } from '../overlays/api'
import { useTheme } from '../theme/context'
import { ago } from '../../shared/format'
import { Hint, List, type Row } from '../ui/kit'
import { Form, type FieldSpec } from '../ui/form'
import { isTeam, describeSchedule, validTime, WEBHOOK_PORT, type Routine, type RoutineInput, type Schedule, type Trigger } from '../../shared/types'

const webhookUrl = (token: string): string => `http://127.0.0.1:${WEBHOOK_PORT}/gatilho/${token || '<token>'}`

// Days are entered 1 Mon … 7 Sun (what a person reads); the Schedule stores them
// 0 Sun … 6 Sat, which is what the core (and describeSchedule) speak.
const parseDays = (text: string): number[] => [...new Set(text.split(/[^1-7]+/).filter(Boolean).map(Number))].sort((a, b) => a - b)
const toWeek = (d: number): number => (d === 0 ? 7 : d)

// "Weekdays at 9", or the trigger: what starts it instead of the clock (spec §17).
function when(r: Routine, connectors: { id: string; name: string }[]): string {
  const trigger = r.trigger
  if (!trigger) return describeSchedule(r.schedule)
  if (trigger.kind === 'webhook') return 'when called on this computer'
  const name = connectors.find((c) => c.id === trigger.connectorId)?.name ?? 'a connector'
  return `every ${trigger.everyMinutes} min on new ${name}`
}

interface Draft {
  id?: string
  name: string
  prompt: string
  agentId: string
  conversationId: string
  days: string
  time: string
  once: boolean
  kind: 'schedule' | 'poll' | 'local'
  connectorId: string
  tool: string
  everyMinutes: string
  token: string
  enabled: boolean
}

const blank = (agentId: string, conversationId: string): Draft => ({
  name: '',
  prompt: '',
  agentId,
  conversationId,
  days: '1,2,3,4,5',
  time: '09:00',
  once: false,
  kind: 'schedule',
  connectorId: '',
  tool: '',
  everyMinutes: '5',
  token: '',
  enabled: true
})

const draftFrom = (r: Routine): Draft => ({
  id: r.id,
  name: r.name,
  prompt: r.prompt,
  agentId: r.agentId,
  conversationId: r.conversationId,
  days: [...r.schedule.days].sort().map(toWeek).join(','),
  time: r.schedule.time,
  once: !!r.schedule.once,
  kind: r.trigger ? (r.trigger.kind === 'webhook' ? 'local' : 'poll') : 'schedule',
  connectorId: r.trigger?.kind === 'poll' ? r.trigger.connectorId : '',
  tool: r.trigger?.kind === 'poll' ? r.trigger.tool : '',
  everyMinutes: r.trigger?.kind === 'poll' ? String(r.trigger.everyMinutes) : '5',
  token: r.trigger?.kind === 'webhook' ? r.trigger.token : '',
  enabled: r.enabled
})

export function Routines({ state, active }: ScreenProps): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const [cursor, setCursor] = useState(0)
  const at = Math.max(0, Math.min(cursor, state.routines.length - 1))
  const r = state.routines[at]

  const open = (draft: Draft): void => overlay.sheet({ title: draft.id ? 'Edit routine' : 'New routine', render: (close) => <RoutineSheet state={state} initial={draft} close={close} /> })

  useInput(
    (input, key) => {
      if (key.upArrow || input === 'k') return setCursor(Math.max(0, at - 1))
      if (key.downArrow || input === 'j') return setCursor(Math.min(state.routines.length - 1, at + 1))
      if (input === 'n' || input === 'a') {
        const first = state.agents.filter(isTeam)[0]
        if (first) open(blank(first.id, state.conversations.find((c) => c.kind === 'dm' && c.name === first.id)?.id ?? ''))
        return
      }
      if (!r) return
      if (input === 'e') return open(draftFrom(r))
      if (input === 'd') return overlay.confirm({ title: 'Delete the routine?', detail: r.name, yes: 'delete', onYes: () => store.removeRoutine(r.id) })
      if (input === 'R') return store.runRoutine(r.id)
      // Toggle by saving the routine with `enabled` flipped (spec §3.1 #43).
      if (input === ' ') {
        void store.saveRoutine({ ...r, enabled: !r.enabled }).catch((e: unknown) => overlay.note(e instanceof Error ? e.message : String(e)))
        return
      }
      if (input === 'c') {
        // What the trigger finds now (spec §3.1 #55): shown as it comes, error included.
        if (!r.trigger) return overlay.note('this routine runs on a schedule — nothing to check')
        overlay.note('checking…')
        void store.checkTrigger(r.trigger).then(
          (text) => overlay.note(text || 'nothing new'),
          (e: unknown) => overlay.note(e instanceof Error ? e.message : String(e))
        )
        return
      }
      if (key.return) return store.navigate({ kind: 'conversation', id: r.conversationId })
    },
    { isActive: active }
  )

  const rows: Row[] = state.routines.map((r) => {
    const agent = agentById(state, r.agentId)
    const conv = state.conversations.find((c) => c.id === r.conversationId)
    const where = conv ? (conv.kind === 'channel' ? `#${conv.name}` : `DM ${agentById(state, conv.name)?.name ?? 'agent'}`) : 'a gone conversation'
    return {
      key: r.id,
      label: `${agent?.name ?? 'agent'} · ${r.name}`,
      hint: `${when(r, state.connectors)} · ${r.enabled ? 'on' : 'off'} · ${where} · ${r.lastAt ? `last ${ago(r.lastAt)}` : 'never ran'}`
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{`Routines (${state.routines.length})`}</Text>
      <List rows={rows} cursor={at} active={active} empty="No routines yet. Press n to schedule one." />
      {state.routines.length && state.routines.every((x) => !x.enabled) ? <Text color={t.faint}>every routine is off</Text> : null}
      {active ? <Hint keys={[['n', 'new'], ['e', 'edit'], ['space', 'on/off'], ['R', 'run now'], ['c', 'check trigger'], ['d', 'delete'], ['Enter', 'open']]} /> : null}
    </Box>
  )
}

function RoutineSheet({ state, initial, close }: { state: ScreenProps['state']; initial: Draft; close: () => void }): ReactNode {
  const overlay = useOverlay()
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<Draft>): void => setDraft((d) => ({ ...d, ...patch }))

  const agents = state.agents.filter(isTeam)
  const agent = agents.find((a) => a.id === draft.agentId)
  const channels = state.conversations.filter((c) => c.kind === 'channel' && c.members.includes(draft.agentId))
  const dm = state.conversations.find((c) => c.kind === 'dm' && c.name === draft.agentId)

  const fields: FieldSpec[] = [
    { id: 'name', label: 'Name', kind: 'text', value: draft.name, placeholder: 'Good morning', onChange: (v) => set({ name: v }) },
    { id: 'prompt', label: 'What to do', kind: 'lines', value: draft.prompt, placeholder: 'As you would write it in a message.', onChange: (v) => set({ prompt: v }) },
    {
      id: 'agent',
      label: 'Agent',
      kind: 'select',
      value: draft.agentId,
      options: agents.map((a) => ({ value: a.id, label: a.name })),
      onChange: (v) => set({ agentId: v, conversationId: state.conversations.find((c) => c.kind === 'dm' && c.name === v)?.id ?? '' })
    },
    {
      id: 'where',
      label: 'Where to post',
      kind: 'select',
      value: draft.conversationId || dm?.id || '',
      options: [
        ...(dm ? [{ value: dm.id, label: `DM with ${agent?.name ?? 'the agent'}` }] : []),
        ...channels.map((c) => ({ value: c.id, label: `#${c.name}` }))
      ],
      onChange: (v) => set({ conversationId: v })
    },
    {
      id: 'kind',
      label: 'Trigger',
      kind: 'select',
      value: draft.kind,
      options: [
        { value: 'schedule', label: 'At a time' },
        { value: 'poll', label: 'New connector item' },
        { value: 'local', label: 'Local call' }
      ],
      hint: draft.kind === 'local' ? webhookUrl(draft.token) : undefined,
      onChange: (v) => set({ kind: v as Draft['kind'] })
    }
  ]

  if (draft.kind === 'schedule')
    fields.push(
      { id: 'days', label: 'Days', kind: 'text', value: draft.days, hint: '1 Mon … 7 Sun, e.g. 1,2,3,4,5', onChange: (v) => set({ days: v }) },
      { id: 'time', label: 'Time', kind: 'text', value: draft.time, hint: 'HH:MM', onChange: (v) => set({ time: v }) },
      { id: 'once', label: 'Run once then turn off', kind: 'toggle', value: draft.once ? 'on' : 'off', onChange: (v) => set({ once: v === 'on' }) }
    )
  if (draft.kind === 'poll')
    fields.push(
      { id: 'connector', label: 'Connector', kind: 'select', value: draft.connectorId || state.connectors[0]?.id || '', options: state.connectors.map((c) => ({ value: c.id, label: c.name })), onChange: (v) => set({ connectorId: v }) },
      { id: 'tool', label: 'Read tool', kind: 'text', value: draft.tool, hint: 'e.g. list_issues', onChange: (v) => set({ tool: v }) },
      { id: 'every', label: 'Check every (minutes)', kind: 'text', value: draft.everyMinutes, onChange: (v) => set({ everyMinutes: v }) }
    )
  // The trigger form checks the trigger before saving (spec §3.1 #55): an action
  // field, so no bare key fights the text fields.
  if (draft.kind !== 'schedule')
    fields.push({
      id: 'check',
      label: 'Check the trigger now',
      kind: 'action',
      value: 'Check',
      onActivate: () => {
        const trigger = triggerOf(draft)
        if (!trigger) return
        void store.checkTrigger(trigger).then((text) => overlay.note(text || 'nothing new'), (e: unknown) => overlay.note(e instanceof Error ? e.message : String(e)))
      }
    })

  const save = async (): Promise<void> => {
    if (!draft.name.trim()) return setError('give it a name')
    if (!draft.prompt.trim()) return setError('say what to do')
    if (draft.kind === 'schedule' && !validTime(draft.time)) return setError('the time must be HH:MM')
    setBusy(true)
    setError(undefined)
    try {
      const schedule: Schedule = { days: parseDays(draft.days).map((w) => w % 7), time: draft.time, ...(draft.once ? { once: true } : {}) }
      // An empty choice means the agent's DM, created if it does not exist yet.
      const conversationId = draft.conversationId || (await store.dmWith(draft.agentId))
      const input: RoutineInput = { id: draft.id, name: draft.name, agentId: draft.agentId, conversationId, prompt: draft.prompt, schedule, enabled: draft.enabled, trigger: triggerOf(draft) }
      await store.saveRoutine(input)
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return <Form fields={fields} onSubmit={save} onCancel={close} error={error} busy={busy} submitLabel={draft.id ? 'Save' : 'Create'} />
}

// The trigger the draft describes, or undefined for a plain schedule.
function triggerOf(draft: Draft): Trigger | undefined {
  return draft.kind === 'schedule' ? undefined : draft.kind === 'local' ? { kind: 'webhook', token: draft.token } : { kind: 'poll', connectorId: draft.connectorId, tool: draft.tool, args: {}, everyMinutes: Number(draft.everyMinutes) || 5 }
}
