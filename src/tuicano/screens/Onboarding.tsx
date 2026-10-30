// Onboarding (spec §3.4 row 12, phase P3): the first-run introduction the window
// walks, one step at a time — who you are, the harnesses agents run on (a real
// test reply), the models for routing and memory, and your context; finishing sets
// `onboarding.done`, which lets the core create the Tuca. Every step uses
// `overlay.prompt`/`overlay.sheet` + `Form`, and `b` goes back a step.
import { useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { store } from '../store'
import { L } from '../../shared/lang'
import { useOverlay, type ScreenProps } from '../overlays/api'
import { useTheme } from '../theme/context'
import { Hint } from '../ui/kit'
import { Form } from '../ui/form'
import { ENGINES, ENGINE_IDS, MODELS, customModel, startsPicked, type EngineId } from '../../shared/types'

const STEPS = ['name', 'engines', 'models', 'context', 'done'] as const
type Step = (typeof STEPS)[number]
// The window's own words for each step (Onboarding.tsx); the same here. Built when
// used, not in a module constant (the language isn't known at module load).
const title = (step: Step): string => {
  if (step === 'name') return L('Como os agentes devem te chamar?', 'What should the agents call you?')
  if (step === 'engines') return L('Quais harnesses seus agentes vão usar?', 'Which harnesses will your agents use?')
  if (step === 'models') return L('Quem decide e quem lembra.', 'Who decides and who remembers.')
  if (step === 'context') return L('Conta um pouco sobre você.', 'Tell us a bit about yourself.')
  return L('Pronto', 'Ready')
}

function ModelsForm({ router, memory, onSave, onCancel }: { router: string; memory: string; onSave: (r: string, m: string) => void; onCancel: () => void }): ReactNode {
  const [r, setR] = useState(router)
  const [m, setM] = useState(memory)
  return (
    <Form
      fields={[
        { id: 'router', label: L('Modelo do router', 'Router model'), kind: 'text', value: r, hint: L('lê um canal e escolhe quem responde', 'reads a channel and picks who replies'), onChange: setR },
        { id: 'memory', label: L('Modelo da memória', 'Memory model'), kind: 'text', value: m, hint: L('resume e extrai memórias', 'summarizes and extracts memories'), onChange: setM }
      ]}
      onSubmit={() => onSave(r, m)}
      onCancel={onCancel}
    />
  )
}

function ContextForm({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }): ReactNode {
  const [text, setText] = useState(value)
  return <Form fields={[{ id: 'context', label: L('Contexto', 'Context'), kind: 'lines', value: text, hint: L('entra no prompt de todo agente', 'goes into every agent’s prompt'), onChange: setText }]} onSubmit={() => onSave(text)} onCancel={onCancel} />
}

const keys = (at: number, here: Step): [string, string][] => {
  const out: [string, string][] = [['Enter', 'continue']]
  if (at > 0) out.push(['b', 'back'])
  if (here === 'engines') out.push(['l', 'log in'], ['t', 'test'])
  return out
}

export function Onboarding({ state, active }: ScreenProps): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const settings = state.settings
  const [step, setStep] = useState(0)
  const [name, setName] = useState(settings.workspaceName)
  const [router, setRouter] = useState(settings.routerModel)
  const [memory, setMemory] = useState(settings.memoryModel)
  const [context, setContext] = useState(settings.context)
  const [manual, setManual] = useState<string | null>(null)
  const [tested, setTested] = useState<{ ok: boolean; message: string } | null>(null)

  const ready = ENGINE_IDS.filter((e) => settings.engines[e].loggedIn)
  const picked = (e: EngineId): boolean => (settings.harnesses ? settings.harnesses.includes(e) : startsPicked(settings.engines[e]))
  const modelFor = (e: EngineId): string => MODELS.find((m) => m.engine === e)?.id ?? customModel(e, '')
  // A gateway or a provider names its own models, so the router and memory must be set.
  const needsModel = ready.some((e) => settings.engines[e].route === 'gateway' || settings.engines[e].route === 'providers')
  const at = Math.min(step, STEPS.length - 1)
  const here = STEPS[at]!

  const finish = (): void => {
    store.updateSettings({ onboarding: { done: true } })
    void store.ensureTuca()
  }

  const login = (): void => {
    const e = ENGINE_IDS.find((x) => settings.engines[x].installed && !settings.engines[x].loggedIn) ?? ENGINE_IDS[0]!
    void store.loginEngine(e).then(
      (r) => {
        if (r.opened) overlay.note(L(`Entrando no ${ENGINES[e].label} num terminal…`, `Signing in to ${ENGINES[e].label} in a terminal…`))
        else {
          setManual(r.command)
          overlay.note(r.command)
        }
      },
      (err: unknown) => overlay.note(err instanceof Error ? err.message : String(err))
    )
  }
  const test = (): void => {
    const e = ready[0] ?? ENGINE_IDS[0]!
    void store.testEngine(modelFor(e)).then(
      (r) => {
        setTested(r)
        overlay.note(r.ok ? L(`Funcionando. ${r.message}`, `Working. ${r.message}`) : r.message)
      },
      (err: unknown) => overlay.note(err instanceof Error ? err.message : String(err))
    )
  }

  const primary = (): void => {
    if (here === 'name') {
      return overlay.prompt({
        title: L('Seu nome', 'Your name'),
        label: L('Nome', 'Name'),
        value: name,
        onSubmit: (v) => {
          setName(v)
          store.updateSettings({ workspaceName: v })
          setStep(1)
        }
      })
    }
    if (here === 'engines') return ready.length ? setStep(2) : overlay.note(L('Entre num harness primeiro.', 'Sign in to a harness first.'))
    if (here === 'models') {
      if (!ready.length) return setStep(3)
      return overlay.sheet({
        title: L('Modelos', 'Models'),
        render: (close) => (
          <ModelsForm
            router={router}
            memory={memory}
            onSave={(r, m) => {
              setRouter(r)
              setMemory(m)
              store.updateSettings({ routerModel: r, memoryModel: m })
              close()
              setStep(3)
            }}
            onCancel={close}
          />
        )
      })
    }
    if (here === 'context') {
      return overlay.sheet({
        title: L('Contexto', 'Context'),
        render: (close) => (
          <ContextForm
            value={context}
            onSave={(v) => {
              setContext(v)
              store.updateSettings({ context: v })
              close()
              setStep(4)
            }}
            onCancel={close}
          />
        )
      })
    }
    return finish()
  }

  useInput(
    (input, key) => {
      if (key.escape || input === 'b') return setStep((s) => Math.max(0, s - 1))
      if (input === 'l') return login()
      if (input === 't') return test()
      if (key.return) return primary()
    },
    { isActive: active }
  )

  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{L(`Bem-vindo ao Tucano · passo ${at + 1} de ${STEPS.length}`, `Welcome to Tucano · step ${at + 1} of ${STEPS.length}`)}</Text>
      <Text color={t.text}>{title(here)}</Text>

      {here === 'name' ? <Text color={t.faint}>{L(`Os agentes vão te chamar de "${name || 'você'}". Enter para definir seu nome.`, `The agents will call you "${name || 'you'}". Enter to set your name.`)}</Text> : null}

      {here === 'engines' ? (
        <Box flexDirection="column">
          {ENGINE_IDS.map((e) => (
            <Text key={e} color={settings.engines[e].loggedIn ? t.ok : t.dim}>
              {`  ${picked(e) ? '▸ ' : '  '}${ENGINES[e].label.padEnd(14)}${settings.engines[e].loggedIn ? L('conectado', 'signed in') : settings.engines[e].installed ? L('não conectado', 'not signed in') : L('não instalado', 'not installed')}`}
            </Text>
          ))}
          <Text color={t.faint}>{ready.length ? L('Enter quando terminar.', 'Enter when you are done.') : L('l entra; t manda uma resposta de teste quando um estiver pronto.', 'l signs you in; t sends a test reply once one is ready.')}</Text>
          {manual ? <Text color={t.waiting}>{L(`cole no seu terminal: ${manual}`, `paste in your terminal: ${manual}`)}</Text> : null}
          {tested ? <Text color={tested.ok ? t.ok : t.danger}>{L(`teste: ${tested.ok ? 'funcionando. ' : ''}${tested.message}`, `test: ${tested.ok ? 'working. ' : ''}${tested.message}`)}</Text> : null}
        </Box>
      ) : null}

      {here === 'models' ? (
        <Box flexDirection="column">
          <Text color={t.text}>{L(`  Router: ${router || '(não definido)'}`, `  Router: ${router || '(unset)'}`)}</Text>
          <Text color={t.text}>{L(`  Memória: ${memory || '(não definida)'}`, `  Memory: ${memory || '(unset)'}`)}</Text>
          <Text color={t.faint}>{needsModel ? L('Um gateway ou provedor nomeia os próprios modelos: os dois são obrigatórios.', 'A gateway or provider names its own models: both are required.') : L('Enter para escolher, ou para continuar.', 'Enter to pick, or to continue.')}</Text>
        </Box>
      ) : null}

      {here === 'context' ? <Text color={t.faint}>{context ? context.split('\n')[0] : L('Todo agente lê isso. Enter para escrever.', 'Every agent reads this. Enter to write it.')}</Text> : null}

      {here === 'done' ? <Text color={t.text}>{L('O Tucano vai criar seu primeiro agente (o Tuca) agora. Enter para terminar.', 'Tucano will make your first agent (the Tuca) now. Enter to finish.')}</Text> : null}

      {active ? <Hint keys={keys(at, here)} /> : null}
    </Box>
  )
}
