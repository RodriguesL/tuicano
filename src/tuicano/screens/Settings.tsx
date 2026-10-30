// Settings (spec §3.1 #18/#19/#20/#44/#45/#46/#56/#57/#58/#59/#60/#61/#64, §3.3
// row 12): the whole page the window draws, as scannable sections. Every field is
// a row you act on with Enter, and each change goes through `store.updateSettings`
// — no Save button. Destructive changes ask with `overlay.confirm`, single values
// with `overlay.prompt`, the model lists with a sheet. The GUI is the reference
// (src/renderer/src/components/Pages.tsx SettingsPage and Harness.tsx).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { useEffect, useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { store } from '../store'
import { L } from '../../shared/lang'
import { useOverlay, type ScreenProps } from '../overlays/api'
import { useTheme } from '../theme/context'
import { Hint, List, type Row } from '../ui/kit'
import { Form } from '../ui/form'
import { tokens } from '../../shared/format'
import { ENGINES, ENGINE_IDS, MODELS, RUN_BUDGET_PCT, RUN_STALL_MINUTES, customModel, modelInfo, startsPicked, type EngineId, type EngineStatus, type Settings as SettingsData } from '../../shared/types'
import { runtime } from '../runtime'

interface Item {
  id: string
  label: string
  value?: string
  hint?: string
  /** A harness row: `l`/`t`/`m` act on it, Enter toggles it. */
  engine?: EngineId
  run?: () => void | Promise<void>
}

const TTL = [1, 24, 168]
const LEARNING: SettingsData['memoryLearning'][] = ['approve', 'auto', 'off']

// A model list: the app's own (MODELS), what each harness offers (engineModels),
// or another name typed at the prompt — the same picker the window shows.
function ModelSheet({ engines, value, onPick }: { engines: EngineId[]; value: string; onPick: (v: string) => void }): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const [fetched, setFetched] = useState<string[]>([])
  const [error, setError] = useState<string | undefined>()
  const [cursor, setCursor] = useState(0)
  useEffect(() => {
    let live = true
    Promise.all(engines.map((e) => store.engineModels(e))).then(
      (rs) => {
        if (!live) return
        setFetched(rs.flatMap((r, i) => (r.models ?? []).map((m) => customModel(engines[i]!, m))))
        const err = rs.find((r) => r.error)?.error
        if (err) setError(err)
      },
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e))
    )
    return () => {
      live = false
    }
  }, [engines.join()])

  const options = [
    ...MODELS.filter((m) => engines.includes(m.engine)).map((m) => ({ value: m.id, label: `${ENGINES[m.engine].label} · ${m.label}` })),
    ...fetched.map((v) => ({ value: v, label: v.replace(/^[a-z]+:/, '') })),
    { value: '__custom__', label: L('Outro nome…', 'Other name…') }
  ]
  const at = Math.max(0, Math.min(cursor, options.length - 1))
  const rows: Row[] = options.map((o) => ({ key: o.value, label: o.label, hint: o.value === value ? L('atual', 'current') : undefined }))

  useInput((input, key) => {
    if (key.upArrow) return setCursor(Math.max(0, at - 1))
    if (key.downArrow) return setCursor(Math.min(options.length - 1, at + 1))
    if (key.return) {
      const o = options[at]
      if (!o) return
      if (o.value === '__custom__') {
        overlay.prompt({
          title: L('Nome do modelo', 'Model name'),
          label: L('Nome', 'Name'),
          onSubmit: (v) => {
            onPick(customModel(engines[0]!, v))
            overlay.close()
          }
        })
        return
      }
      onPick(o.value)
      overlay.close()
    }
  })
  return (
    <Box flexDirection="column">
      <List rows={rows} cursor={at} active empty={L('Nenhum modelo a oferecer.', 'No model to offer.')} />
      {error ? <Text color={t.danger}>{error}</Text> : null}
      <Text color={t.faint}>{L('Enter escolhe · Esc fecha · um harness com gateway lista os próprios modelos', 'Enter picks · Esc closes · a harness with a gateway lists its own models')}</Text>
    </Box>
  )
}

function ContextForm({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }): ReactNode {
  const [text, setText] = useState(value)
  return (
    <Form
      fields={[{ id: 'context', label: L('Contexto', 'Context'), kind: 'lines', value: text, hint: L('Entra no prompt de todo agente', 'Goes into every agent’s prompt'), onChange: setText }]}
      onSubmit={() => onSave(text)}
      onCancel={onCancel}
    />
  )
}

const statusLine = (st: EngineStatus): string => {
  const parts: string[] = []
  parts.push(st.installed ? (st.version ? `v${st.version}` : L('instalado', 'installed')) : L('não instalado', 'not installed'))
  parts.push(st.loggedIn ? L(`conectado${st.account ? ` (${st.account})` : ''}`, `signed in${st.account ? ` (${st.account})` : ''}`) : L('não conectado', 'not signed in'))
  if (st.route) parts.push(st.route + (st.gateway ? `: ${st.gateway}` : ''))
  if (st.off) parts.push(L('desligado', 'off'))
  if (st.soon) parts.push(L('em breve', 'soon'))
  return parts.join(' · ')
}

export function Settings({ state, active }: ScreenProps): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const settings = state.settings
  const [cursor, setCursor] = useState(0)
  const [manual, setManual] = useState<Record<string, string>>({})
  const [tested, setTested] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [models, setModels] = useState<Record<string, string>>({})

  const ready = ENGINE_IDS.filter((e) => settings.engines[e].loggedIn)
  const picked = (e: EngineId): boolean => (settings.harnesses ? settings.harnesses.includes(e) : startsPicked(settings.engines[e]))
  const modelFor = (e: EngineId): string => models[e] ?? MODELS.find((m) => m.engine === e)?.id ?? customModel(e, '')

  const login = (e: EngineId): void => {
    void store.loginEngine(e).then(
      (r) => {
        if (r.opened) overlay.note(L(`Entrando no ${ENGINES[e].label} num terminal…`, `Signing in to ${ENGINES[e].label} in a terminal…`))
        else {
          setManual((m) => ({ ...m, [e]: r.command }))
          overlay.note(r.command)
        }
      },
      (err: unknown) => overlay.note(err instanceof Error ? err.message : String(err))
    )
  }
  const test = (e: EngineId): void => {
    const model = modelFor(e)
    void store.testEngine(model).then(
      (r) => {
        setTested((s) => ({ ...s, [e]: r }))
        overlay.note(r.ok ? L(`Funcionando. ${r.message}`, `Working. ${r.message}`) : r.message)
      },
      (err: unknown) => overlay.note(err instanceof Error ? err.message : String(err))
    )
  }
  const pickModel = (e: EngineId): void =>
    overlay.sheet({ title: L(`modelo de ${ENGINES[e].label}`, `${ENGINES[e].label} model`), render: () => <ModelSheet engines={[e]} value={modelFor(e)} onPick={(v) => setModels((s) => ({ ...s, [e]: v }))} /> })

  const saveToken = (title: string, label: string, save: (v: string | null) => Promise<void>, done: string): void =>
    overlay.prompt({
      title,
      label,
      mask: true,
      onSubmit: async (v) => {
        await save(v)
        overlay.note(done)
      }
    })

  const items: Item[] = [
    {
      id: 'name',
      label: L('Nome', 'Name'),
      value: settings.workspaceName || L('(vazio)', '(empty)'),
      run: () => overlay.prompt({ title: L('Nome do workspace', 'Workspace name'), label: L('Nome', 'Name'), value: settings.workspaceName, onSubmit: (v) => store.updateSettings({ workspaceName: v }) })
    },
    {
      id: 'context',
      label: L('Contexto', 'Context'),
      value: settings.context ? `${settings.context.split('\n')[0]!.slice(0, 40)}…` : L('(vazio)', '(empty)'),
      hint: L('todo agente lê', 'every agent reads it'),
      run: () =>
        overlay.sheet({
          title: L('Contexto', 'Context'),
          render: (close) => <ContextForm value={settings.context} onSave={(v) => { store.updateSettings({ context: v }); close() }} onCancel={close} />
        })
    },
    { id: 'lang', label: L('Idioma', 'Language'), value: settings.language, hint: L('Enter alterna pt | en', 'Enter switches pt | en'), run: () => store.updateSettings({ language: settings.language === 'pt' ? 'en' : 'pt' }) },
    { id: 'theme', label: L('Tema', 'Theme'), value: settings.theme, hint: L('Ctrl+T abre o seletor', 'Ctrl+T opens the picker'), run: () => overlay.themes() },

    ...ENGINE_IDS.map<Item>((e) => ({ id: `engine:${e}`, engine: e, label: ENGINES[e].label, value: statusLine(settings.engines[e]), hint: settings.engines[e].path, run: () => toggleHarness(e) })),

    {
      id: 'router',
      label: L('Modelo do router', 'Router model'),
      value: settings.routerModel,
      hint: L('escolhe quem responde nos canais', 'picks who replies in channels'),
      run: () => (ready.length ? overlay.sheet({ title: L('Modelo do router', 'Router model'), render: () => <ModelSheet engines={ready} value={settings.routerModel} onPick={(v) => store.updateSettings({ routerModel: v })} /> }) : overlay.note(L('Nenhum harness pronto ainda.', 'No harness ready yet.')))
    },
    {
      id: 'memoryModel',
      label: L('Modelo da memória', 'Memory model'),
      value: settings.memoryModel,
      hint: L('resume e extrai memórias', 'summarizes and extracts memories'),
      run: () => (ready.length ? overlay.sheet({ title: L('Modelo da memória', 'Memory model'), render: () => <ModelSheet engines={ready} value={settings.memoryModel} onPick={(v) => store.updateSettings({ memoryModel: v })} /> }) : overlay.note(L('Nenhum harness pronto ainda.', 'No harness ready yet.')))
    },
    { id: 'learning', label: L('O que ele aprende sobre você', 'What it learns about you'), value: settings.memoryLearning, hint: 'approve | auto | off', run: () => store.updateSettings({ memoryLearning: LEARNING[(LEARNING.indexOf(settings.memoryLearning) + 1) % LEARNING.length]! }) },
    { id: 'limit', label: L('Limite padrão por agente', 'Default limit per agent'), value: L(`${tokens(settings.defaultLimit)} / mês`, `${tokens(settings.defaultLimit)} / month`), run: () => overlay.prompt({ title: L('Limite padrão (milhões de tokens/mês)', 'Default limit (millions of tokens/month)'), label: L('Milhões', 'Millions'), value: String(settings.defaultLimit / 1_000_000), onSubmit: (v) => store.updateSettings({ defaultLimit: Math.max(0, Math.round(Number(v) * 1_000_000)) }) }) },
    { id: 'budget', label: L('Teto por resposta', 'Ceiling per reply'), value: L(`${settings.runBudgetPct ?? RUN_BUDGET_PCT}% do mês`, `${settings.runBudgetPct ?? RUN_BUDGET_PCT}% of the month`), run: () => overlay.prompt({ title: L('Teto por resposta (% do limite do mês)', 'Ceiling per reply (% of the monthly limit)'), label: L('Porcento', 'Percent'), value: String(settings.runBudgetPct ?? RUN_BUDGET_PCT), onSubmit: (v) => store.updateSettings({ runBudgetPct: Math.min(100, Math.max(1, Math.round(Number(v)))) }) }) },
    { id: 'stall', label: L('Travado depois de', 'Stalled after'), value: L(`${settings.runStallMinutes ?? RUN_STALL_MINUTES} min`, `${settings.runStallMinutes ?? RUN_STALL_MINUTES} min`), run: () => overlay.prompt({ title: L('Travado depois de (minutos sem sinal)', 'Stalled after (minutes without a sign)'), label: L('Minutos', 'Minutes'), value: String(settings.runStallMinutes ?? RUN_STALL_MINUTES), onSubmit: (v) => store.updateSettings({ runStallMinutes: Math.max(5, Math.round(Number(v))) }) }) },
    { id: 'ttl', label: L('Expiração de aprovações', 'Approvals expire after'), value: `${settings.approvalTtlHours} h`, hint: L('Enter cicla 1 | 24 | 168', 'Enter cycles 1 | 24 | 168'), run: () => store.updateSettings({ approvalTtlHours: TTL[(TTL.indexOf(settings.approvalTtlHours) + 1) % TTL.length]! }) },

    { id: 'quiet', label: L('Horário de silêncio', 'Quiet hours'), value: settings.quietHours ? `${settings.quietHours.from}–${settings.quietHours.to}` : L('desligado', 'off'), run: () => store.updateSettings({ quietHours: settings.quietHours ? null : { from: '22:00', to: '07:00' } }) },
    ...(settings.quietHours
      ? [
          { id: 'quietFrom', label: L('Silêncio a partir de', 'Quiet from'), value: settings.quietHours.from, run: () => overlay.prompt({ title: L('Horário de silêncio — de', 'Quiet hours — from'), label: 'HH:MM', value: settings.quietHours!.from, onSubmit: (v) => store.updateSettings({ quietHours: { ...settings.quietHours!, from: v } }) }) },
          { id: 'quietTo', label: L('Silêncio até', 'Quiet to'), value: settings.quietHours.to, run: () => overlay.prompt({ title: L('Horário de silêncio — até', 'Quiet hours — to'), label: 'HH:MM', value: settings.quietHours!.to, onSubmit: (v) => store.updateSettings({ quietHours: { ...settings.quietHours!, to: v } }) }) }
        ]
      : []),
    {
      id: 'paused',
      label: L('Pausar tudo', 'Pause everything'),
      value: settings.paused ? L('pausado', 'paused') : L('desligado', 'off'),
      hint: L('para todo agente e rotina', 'stops every agent and routine'),
      run: () =>
        overlay.confirm({
          title: settings.paused ? L('Retomar tudo?', 'Resume everything?') : L('Pausar tudo?', 'Pause everything?'),
          detail: settings.paused ? L('Os agentes e as rotinas voltam a rodar.', 'Agents and routines start again.') : L('Nenhum agente começa a trabalhar e nenhuma rotina roda.', 'No agent starts working and no routine runs.'),
          yes: settings.paused ? L('retomar', 'resume') : L('pausar', 'pause'),
          onYes: () => store.updateSettings({ paused: !settings.paused })
        })
    },

    { id: 'jev', label: L('Chave do TypeSafe (Jev)', 'TypeSafe (Jev) key'), value: settings.jevKey ? L('salva', 'saved') : L('não definida', 'not set'), hint: L('j define', 'j sets it'), run: () => saveToken(L('Chave do TypeSafe', 'TypeSafe key'), L('Chave', 'Key'), (v) => store.setJevKey(v), L('chave salva', 'key saved')) },
    { id: 'telegram', label: 'Telegram', value: settings.telegram?.chat ? `${settings.telegram.bot} → ${settings.telegram.chat}` : settings.telegram?.bot ? L('esperando o pareamento', 'waiting for pairing') : L('desligado', 'off'), hint: L('p define o token, P despareia', 'p sets the token, P unpairs'), run: () => saveToken(L('Token do bot do Telegram', 'Telegram bot token'), L('Token', 'Token'), (v) => store.setTelegramToken(v), L('token salvo', 'token saved')) },
    { id: 'github', label: 'GitHub', value: settings.github?.user ? L(`como ${settings.github.user}`, `as ${settings.github.user}`) : settings.github?.error ?? L('não definido', 'not set'), hint: L('g define o token', 'g sets the token'), run: () => saveToken(L('Token do GitHub', 'GitHub token'), L('Token', 'Token'), (v) => store.setGithubToken(v), L('token salvo', 'token saved')) },

    { id: 'export', label: L('Exportar time', 'Export team'), value: L('escreve um .md e imprime o caminho', 'writes a .md and prints the path'), hint: 'e', run: () => exportTeam() },
    { id: 'import', label: L('Importar time', 'Import team'), value: L('de um caminho de arquivo digitado', 'from a typed file path'), hint: 'I', run: () => importTeam() },
    { id: 'backup', label: L('Fazer backup agora', 'Back up now'), value: L('uma cópia de tudo', 'a copy of everything'), hint: 'b', run: () => backup() },
    { id: 'openBackups', label: L('Abrir a pasta de backups', 'Open the backups folder'), hint: 'B', run: () => store.openBackups() },

    { id: 'version', label: L('Versão', 'Version'), value: runtime.version, hint: 'TUIcano' }
  ]

  const sections: { title: string; ids: string[] }[] = [
    { title: 'Workspace', ids: ['name', 'context', 'lang', 'theme'] },
    { title: 'Harnesses', ids: ENGINE_IDS.map((e) => `engine:${e}`) },
    { title: L('Modelos e limites', 'Models and limits'), ids: ['router', 'memoryModel', 'learning', 'limit', 'budget', 'stall', 'ttl'] },
    { title: L('Tempo e pausa', 'Time and pause'), ids: ['quiet', ...(settings.quietHours ? ['quietFrom', 'quietTo'] : []), 'paused'] },
    { title: 'Tokens', ids: ['jev', 'telegram', 'github'] },
    { title: L('Time e backup', 'Team and backup'), ids: ['export', 'import', 'backup', 'openBackups'] },
    { title: L('Sobre', 'About'), ids: ['version'] }
  ]
  const flat = sections.flatMap((s) => s.ids.map((id) => items.find((i) => i.id === id)!))
  const at = Math.max(0, Math.min(cursor, flat.length - 1))
  const current = flat[at]
  const harness = current?.engine ?? ENGINE_IDS[0]!

  function toggleHarness(e: EngineId): void {
    const now = ENGINE_IDS.filter(picked)
    store.updateSettings({ harnesses: now.includes(e) ? now.filter((x) => x !== e) : [...now, e] })
  }
  function exportTeam(): void {
    void store.exportTeam().then(
      (md) => {
        const path = join(runtime.dataDir, `tucano-team-${new Date().toISOString().slice(0, 10)}.md`)
        writeFileSync(path, md)
        overlay.note(path)
      },
      (err: unknown) => overlay.note(err instanceof Error ? err.message : String(err))
    )
  }
  function importTeam(): void {
    overlay.prompt({
      title: L('Importar time', 'Import team'),
      label: L('Caminho do arquivo', 'File path'),
      onSubmit: async (path) => {
        await store.importTeam(readFileSync(path, 'utf8'))
        overlay.note(L('time importado', 'team imported'))
      }
    })
  }
  function backup(): void {
    void store.backupNow().then(
      (path) => overlay.note(L(`Backup: ${path}`, `Backup: ${path}`)),
      (err: unknown) => overlay.note(err instanceof Error ? err.message : String(err))
    )
  }

  useInput(
    (input, key) => {
      if (key.upArrow) return setCursor(Math.max(0, at - 1))
      if (key.downArrow) return setCursor(Math.min(flat.length - 1, at + 1))
      if (key.return) return void current?.run?.()
      if (input === 'l') return login(harness)
      if (input === 'r') return store.refreshEngines()
      if (input === 't') return test(harness)
      if (input === 'm') return pickModel(harness)
      if (input === 'j') return saveToken(L('Chave do TypeSafe', 'TypeSafe key'), L('Chave', 'Key'), (v) => store.setJevKey(v), L('chave salva', 'key saved'))
      if (input === 'p') return saveToken(L('Token do bot do Telegram', 'Telegram bot token'), L('Token', 'Token'), (v) => store.setTelegramToken(v), L('token salvo', 'token saved'))
      if (input === 'P') return overlay.confirm({ title: L('Desparear o Telegram?', 'Unpair Telegram?'), detail: L('O bot para de alcançar esta máquina.', 'The bot stops reaching this machine.'), yes: L('desparear', 'unpair'), onYes: () => store.unpairTelegram() })
      if (input === 'g') return saveToken(L('Token do GitHub', 'GitHub token'), L('Token', 'Token'), (v) => store.setGithubToken(v), L('token salvo', 'token saved'))
      if (input === 'e') return exportTeam()
      if (input === 'I') return importTeam()
      if (input === 'b') return backup()
      if (input === 'B') return store.openBackups()
    },
    { isActive: active }
  )

  let index = 0
  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{L('Configurações', 'Settings')}</Text>
      {sections.map((s) => {
        const start = index
        const rows: Row[] = s.ids.map((id) => {
          const it = items.find((i) => i.id === id)!
          return { key: id, label: it.label, hint: it.value ? `${it.value}${it.hint ? `  ·  ${it.hint}` : ''}` : it.hint }
        })
        index += rows.length
        const inSection = at >= start && at < start + rows.length
        return (
          <Box key={s.title} flexDirection="column" marginTop={1}>
            <Text bold color={t.heading}>{s.title}</Text>
            <List rows={rows} cursor={at - start} active={active && inSection} />
            {s.title === 'Harnesses'
              ? ENGINE_IDS.map((e) => (
                  <Box key={`extra:${e}`} flexDirection="column">
                    {manual[e] ? <Text color={t.waiting}>{L(`    cole no seu terminal: ${manual[e]}`, `    paste in your terminal: ${manual[e]}`)}</Text> : null}
                    {tested[e] ? <Text color={tested[e]!.ok ? t.ok : t.danger}>{L(`    teste: ${tested[e]!.ok ? 'funcionando. ' : ''}${tested[e]!.message}`, `    test: ${tested[e]!.ok ? 'working. ' : ''}${tested[e]!.message}`)}</Text> : null}
                    {models[e] ? <Text color={t.faint}>{L(`    modelo: ${modelInfo(models[e]!)?.label ?? models[e]}`, `    model: ${modelInfo(models[e]!)?.label ?? models[e]}`)}</Text> : null}
                    {settings.engines[e].off ? <Text color={t.faint}>{L('    desligado: nenhum agente roda nele', '    off: no agent runs on it')}</Text> : null}
                    {settings.engines[e].soon ? <Text color={t.faint}>{L('    em breve: agentes nele estão chegando', '    soon: agents on it are coming')}</Text> : null}
                  </Box>
                ))
              : null}
          </Box>
        )
      })}
      {active ? <Hint keys={[['↑ ↓', 'rows'], ['Enter', 'act'], ['l', 'log in'], ['r', 'refresh'], ['t', 'test'], ['j p g', 'keys'], ['e I b B', 'team/backups']]} /> : null}
    </Box>
  )
}
