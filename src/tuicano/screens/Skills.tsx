// Skills (spec §3.1 #47–54, view §3.3 #10): recipes the agents follow. Agents
// propose, I approve; the detail shows the recipe and its history, where a version
// restores; `i` brings in one from the person's own Claude Code or Codex. The GUI's
// page is the reference (src/renderer/.../Skills.tsx).
import { useEffect, useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { agentById, store } from '../store'
import { L } from '../../shared/lang'
import { useOverlay, type ScreenProps } from '../overlays/api'
import { useTheme } from '../theme/context'
import { ago, time } from '../../shared/format'
import { Hint, List, type Row } from '../ui/kit'
import { Form, type FieldSpec } from '../ui/form'
import { STALE_DAYS, type LocalSkill, type Skill, type SkillInput, type SkillVersion } from '../../shared/types'

type Place = { kind: 'list' } | { kind: 'detail'; id: string } | { kind: 'local' }

const stateLabel = (k: Skill): string => (k.state === 'pending' ? L('esperando você', 'waiting for you') : k.state === 'archived' ? L('arquivada', 'archived') : L('em uso', 'in use'))
// The types expose `isStale` for memories (confirmedAt); a skill has no such helper,
// so the same window is applied to its `updatedAt` (spec §18).
const stale = (k: Skill, now = Date.now()): boolean => k.state === 'active' && now - k.updatedAt > STALE_DAYS * 86_400_000

export function Skills({ state, active }: ScreenProps): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const [cursor, setCursor] = useState(0)
  const [place, setPlace] = useState<Place>({ kind: 'list' })
  const [local, setLocal] = useState<LocalSkill[] | null>(null)

  const skills = state.skills
  const at = Math.max(0, Math.min(cursor, skills.length - 1))
  const s = skills[at]

  const who = (k: Skill): string => (k.agents.length ? k.agents.map((id) => agentById(state, id)?.name ?? L('agente', 'agent')).join(', ') : L('todos os agentes', 'all agents'))

  const findLocal = (): void =>
    void store.localSkills().then(
      (found) => {
        setLocal(found)
        setPlace({ kind: 'local' })
      },
      (e: unknown) => overlay.note(e instanceof Error ? e.message : String(e))
    )

  useInput(
    (input, key) => {
      if (place.kind !== 'list') return // the open detail/local list owns the keys
      if (key.upArrow || input === 'k') return setCursor(Math.max(0, at - 1))
      if (key.downArrow || input === 'j') return setCursor(Math.min(skills.length - 1, at + 1))
      if (input === 'i') return findLocal()
      if (!s) return
      if (key.return) return setPlace({ kind: 'detail', id: s.id })
      if (input === 'y' && s.state === 'pending') return store.decideSkill(s.id, true)
      // `x` refuses a proposal, and otherwise archives/unarchives (spec §3.1 #50/#52).
      if (input === 'x') return s.state === 'pending' ? store.decideSkill(s.id, false) : store.archiveSkill(s.id, s.state !== 'archived')
      if (input === 'e') return overlay.sheet({ title: L(`Editar ${s.name}`, `Edit ${s.name}`), render: (close) => <SkillSheet state={state} skill={s} close={close} /> })
      if (input === 'd') return overlay.confirm({ title: L('Apagar a skill?', 'Delete the skill?'), detail: s.name, yes: L('apagar', 'delete'), onYes: () => store.removeSkill(s.id) })
    },
    { isActive: active }
  )

  if (place.kind === 'detail') {
    const skill = skills.find((k) => k.id === place.id)
    if (skill) return <SkillDetail skill={skill} active={active} close={() => setPlace({ kind: 'list' })} />
    // The skill is gone: fall through to the list.
  }
  if (place.kind === 'local') return <LocalSkills items={local} active={active} close={() => setPlace({ kind: 'list' })} />

  const rows: Row[] = skills.map((k) => ({ key: k.id, label: k.name, hint: `${stateLabel(k)} · ${who(k)}${stale(k) ? L(' · desatualizada', ' · stale') : ''} · ${ago(k.updatedAt)}`, color: k.state === 'archived' ? t.faint : k.state === 'pending' ? t.warn : undefined }))
  const pending = skills.filter((k) => k.state === 'pending').length

  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>
        {`Skills (${skills.length})`}
        {pending ? <Text color={t.warn}>{L(`  · ${pending} esperando você`, `  · ${pending} waiting for you`)}</Text> : null}
      </Text>
      <List rows={rows} cursor={at} active={active} empty={L('Nenhuma skill ainda. Aperte e para escrever uma, ou i para trazer uma do Claude Code ou do Codex.', 'No skills yet. Press e to write one, or i to bring one from Claude Code or Codex.')} />
      {active ? <Hint keys={[['↑↓', 'move'], ['Enter', 'open'], ['y/x', 'approve/refuse'], ['e', 'edit'], ['i', 'bring one in'], ['x', 'archive'], ['d', 'delete']]} /> : null}
    </Box>
  )
}

function SkillDetail({ skill, active, close }: { skill: Skill; active: boolean; close: () => void }): ReactNode {
  const t = useTheme()
  const [versions, setVersions] = useState<SkillVersion[] | null>(null)
  const [cursor, setCursor] = useState(0)
  useEffect(() => {
    let live = true
    void store.skillVersions(skill.id).then(
      (v) => live && setVersions(v),
      () => live && setVersions([])
    )
    return () => {
      live = false
    }
  }, [skill.id, skill.updatedAt])
  const list = versions ?? []
  const at = Math.max(0, Math.min(cursor, list.length - 1))

  useInput(
    (input, key) => {
      if (key.escape) return close()
      if (key.upArrow || input === 'k') return setCursor(Math.max(0, at - 1))
      if (key.downArrow || input === 'j') return setCursor(Math.min(list.length - 1, at + 1))
      const v = list[at]
      if (key.return && v) return store.restoreSkill(skill.id, v.id)
    },
    { isActive: active }
  )

  const rows: Row[] = list.map((v) => ({ key: String(v.id), label: `${time(v.at)} · ${v.by}`, hint: v.name }))
  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{skill.name}</Text>
      <Text color={t.dim}>{skill.description}</Text>
      <Text color={t.text}>{skill.body.trim() || <Text color={t.faint}>{L(`(lida de ${skill.source ?? 'o arquivo'} a cada uso)`, `(read from ${skill.source ?? 'the file'} on every use)`)}</Text>}</Text>
      <Box marginTop={1}>
        <Text bold color={t.heading}>{L('Versões', 'Versions')}</Text>
      </Box>
      {versions === null ? <Text color={t.faint}>{L('carregando…', 'loading…')}</Text> : <List rows={rows} cursor={at} active={active} empty={L('Nenhuma mudança ainda: esta é a primeira versão.', 'No changes yet: this is the first version.')} />}
      {active ? <Hint keys={[['↑↓', 'move'], ['Enter', 'restore'], ['Esc', 'back']]} /> : null}
    </Box>
  )
}

function LocalSkills({ items, active, close }: { items: LocalSkill[] | null; active: boolean; close: () => void }): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const [cursor, setCursor] = useState(0)
  const list = items ?? []
  const at = Math.max(0, Math.min(cursor, list.length - 1))

  useInput(
    (input, key) => {
      if (key.escape) return close()
      if (key.upArrow || input === 'k') return setCursor(Math.max(0, at - 1))
      if (key.downArrow || input === 'j') return setCursor(Math.min(list.length - 1, at + 1))
      const l = list[at]
      if (key.return && l)
        // Linking reads the file every use, so a gone file is the core's message (spec §3.1 #49).
        void store.linkSkill(l.source, []).then(
          () => {
            overlay.note(L(`ligada ${l.name}`, `linked ${l.name}`))
            close()
          },
          (e: unknown) => overlay.note(e instanceof Error ? e.message : String(e))
        )
    },
    { isActive: active }
  )

  const rows: Row[] = list.map((l) => ({ key: l.source, label: l.name, hint: `${l.origin}${l.scripts ? L(' · precisa de computador', ' · needs a computer') : ''}` }))
  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{L('Do Claude Code e do Codex', 'From Claude Code and Codex')}</Text>
      {items === null ? <Text color={t.faint}>{L('procurando…', 'looking…')}</Text> : <List rows={rows} cursor={at} active={active} empty={L('Nenhuma encontrada nesta máquina.', 'None found on this machine.')} />}
      {active ? <Hint keys={[['↑↓', 'move'], ['Enter', 'link for all agents'], ['Esc', 'back']]} /> : null}
    </Box>
  )
}

function SkillSheet({ state, skill, close }: { state: ScreenProps['state']; skill: Skill; close: () => void }): ReactNode {
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(skill.name)
  const [description, setDescription] = useState(skill.description)
  const [body, setBody] = useState(skill.body)
  // Who uses it, by name: empty means every agent (spec §18).
  const [agentsText, setAgentsText] = useState(skill.agents.map((id) => agentById(state, id)?.name ?? id).join(', '))

  const parseAgents = (): string[] =>
    agentsText
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
      .map((token) => state.agents.find((a) => a.name.toLowerCase() === token || a.handle.toLowerCase() === token || a.id === token)?.id)
      .filter((id): id is string => !!id)

  const fields: FieldSpec[] = [
    { id: 'name', label: L('Nome', 'Name'), kind: 'text', value: name, onChange: setName },
    { id: 'description', label: L('Quando usar', 'When to use it'), kind: 'text', value: description, onChange: setDescription },
    { id: 'body', label: L('Receita', 'Recipe'), kind: 'lines', value: body, onChange: setBody },
    { id: 'agents', label: L('Quem usa', 'Who uses it'), kind: 'text', value: agentsText, hint: L('nomes de agentes, separados por vírgula; vazio significa todos os agentes', 'agent names, comma-separated; empty means all agents'), onChange: setAgentsText }
  ]

  const save = async (): Promise<void> => {
    if (!name.trim() || !description.trim() || !body.trim()) return setError(L('nome, quando usar e a receita são obrigatórios', 'name, when to use it and the recipe are required'))
    setBusy(true)
    setError(undefined)
    try {
      const input: SkillInput = { id: skill.id, name: name.trim(), description: description.trim(), body, agents: parseAgents(), ...(skill.source ? { source: skill.source } : {}) }
      await store.saveSkill(input)
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return <Form fields={fields} onSubmit={save} onCancel={close} error={error} busy={busy} submitLabel={L('Salvar', 'Save')} />
}
