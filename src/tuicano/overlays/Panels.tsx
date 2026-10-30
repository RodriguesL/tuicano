// The side panel of the GUI (spec §3.3): an artifact an agent showed, the services
// on its computer, and its browser. Same state (`openPanel`) as the window; the
// panel is drawn inside the host's frame (spec §2.8), so this file only fills the
// body and owns the keys that act on what it shows. Images go through the graphics
// path (§2.4): `prepare` decides, the ImageOverlay draws outside Ink.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useMemo, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { agentById, browserOf, useAppState } from '../store'
import { store } from '../store'
import { computerOf } from '../../app/store'
import { L, locale } from '../../shared/lang'
import { useOverlay } from '../overlays/api'
import { useTheme } from '../theme/context'
import { runtime } from '../runtime'
import { ImageOverlay } from '../graphics/viewer'
import { mimeOfName, pictureOfDataUrl, prepare, type Mime, type Prepared } from '../graphics/transport'
import { Hint, CURSOR } from '../ui/kit'
import type { Panel } from '../../app/store'
import type { Artifact } from '../../shared/types'

const TEXT_KINDS = new Set<Artifact['kind']>(['markdown', 'csv', 'text', 'html'])

// Same formatting the GUI uses (Panel.tsx `bytes`), so a size reads the same in both.
const bytes = (n: number): string => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`)

// The artifact's bytes, from where they live (spec §3.1 #2, TUIcano reads the file
// straight from the data folder; the core's `artifactText` stays for the GUI).
const readBytes = (a: Artifact): { bytes: Uint8Array; mime: Mime } | null => {
  const mime = mimeOfName(a.name)
  if (!mime) return null
  try {
    return { bytes: new Uint8Array(readFileSync(join(runtime.dataDir, 'artifacts', a.id, a.name))), mime }
  } catch {
    return null
  }
}

const readText = (a: Artifact): string | null => {
  try {
    return readFileSync(join(runtime.dataDir, 'artifacts', a.id, a.name), 'utf8').slice(0, 2_000_000)
  } catch {
    return null
  }
}

export function Panels({ panel, close }: { panel: Panel; close: () => void }): ReactNode {
  const state = useAppState()
  if (panel.kind === 'artifact') return <ArtifactPanel artifact={state.artifacts.find((a) => a.id === panel.id)} />
  if (panel.kind === 'service') return <ServicePanel agentId={panel.agentId} name={panel.name} />
  return <BrowserPanel agentId={panel.agentId} />
}

function ArtifactPanel({ artifact }: { artifact: Artifact | undefined }): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const a = artifact
  const isUrl = /^https?:\/\//.test(a?.source ?? '')
  const prepared: Prepared | null = useMemo(() => {
    if (!a) return null
    const b = readBytes(a)
    return b ? prepare(b.bytes, b.mime, runtime.protocol) : null
  }, [a?.id])
  const text = useMemo(() => (a && TEXT_KINDS.has(a.kind) ? readText(a) : null), [a?.id, a?.kind])

  useInput((input) => {
    if (input !== 'o' || !a) return
    if (isUrl) store.openExternal(a.source)
    else overlay.note(L('nada para abrir externamente — isto é um arquivo dentro do computador', 'nothing to open externally — this is a file inside the computer'))
  })

  if (!a) return <Text color={t.faint}>{L('Arquivo não encontrado.', 'File not found.')}</Text>
  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{a.title}</Text>
      <Text color={t.dim}>{`${a.kind} · ${a.name} · ${bytes(a.size)}`}</Text>
      <Text color={t.faint}>{L(`origem: ${a.source}`, `source: ${a.source}`)}</Text>
      {a.kind === 'image' ? (
        prepared?.canDrawImages ? (
          // Drawn outside Ink, full screen; Esc (the host) closes the panel (§2.4).
          <ImageOverlay prepared={prepared} cell={runtime.cell} />
        ) : (
          <Text color={t.placeholder}>{prepared ? prepared.fallback() : L('[imagem — não deu para ler o arquivo]', '[image — could not read the file]')}</Text>
        )
      ) : TEXT_KINDS.has(a.kind) ? (
        <Text color={t.text}>{text !== null ? text.slice(0, 4_000) : L('(não deu para abrir o arquivo)', '(could not open the file)')}</Text>
      ) : (
        <Text color={t.dim}>
          {a.kind === 'video' ? L('Um vídeo não tem prévia no terminal.', 'A video has no terminal preview.') : a.kind === 'pdf' ? L('Um PDF abre no leitor do sistema.', 'A PDF opens in the system reader.') : L('Sem prévia para este tipo de arquivo.', 'No preview for this kind of file.')}
          {isUrl ? L(' o abre externamente.', ' o opens it externally.') : ''}
        </Text>
      )}
      <Hint keys={isUrl ? [['o', 'open externally'], ['Esc', 'close']] : [['Esc', 'close']]} />
    </Box>
  )
}

function ServicePanel({ agentId, name }: { agentId: string; name: string }): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const state = useAppState()
  const services = computerOf(state, agentId)?.services ?? []
  const selected = services.find((s) => s.name === name)

  useInput((input) => {
    if (input === 's' && selected) {
      store.stopService(agentId, selected.name)
      overlay.note(L(`parando ${selected.name}`, `stopping ${selected.name}`))
      return
    }
    if (input === 'o' && selected?.url) {
      store.openExternal(selected.url)
      return
    }
    if (input === 'o') overlay.note(L('este serviço não tem URL para abrir', 'this service has no URL to open'))
  })

  if (!services.length) return <Text color={t.faint}>{L('O computador deste agente não está rodando nenhum serviço.', 'This agent\'s computer is not running any service.')}</Text>
  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{L(`Serviços de ${agentById(state, agentId)?.name ?? L('agente', 'agent')}`, `Services of ${agentById(state, agentId)?.name ?? 'agent'}`)}</Text>
      {services.map((s) => (
        <Text key={s.name} color={s.name === name ? t.text : t.dim} inverse={s.name === name}>
          {`${s.name === name ? `${CURSOR} ` : '  '}${s.name} · ${s.running ? L('no ar', 'running') : L('parado', 'stopped')} · ${L('porta', 'port')} ${s.port}`}
          {s.url ? <Text color={t.faint}>{`  ${s.url}`}</Text> : null}
        </Text>
      ))}
      <Hint keys={[['s', 'stop'], ['o', 'open'], ['Esc', 'close']]} />
    </Box>
  )
}

const logClock = (at: number): string => new Date(at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function BrowserPanel({ agentId }: { agentId: string }): ReactNode {
  const t = useTheme()
  const overlay = useOverlay()
  const state = useAppState()
  const view = browserOf(state, agentId)
  const name = agentById(state, agentId)?.name ?? L('agente', 'agent')
  const frame = view?.frame
  const prepared: Prepared | null = useMemo(() => {
    const pic = frame ? pictureOfDataUrl(frame) : null
    return pic ? prepare(pic.bytes, pic.mime, runtime.protocol) : null
  }, [frame])

  useInput((input) => {
    if (input === 's') {
      store.browserAction(agentId, 'show')
      return
    }
    if (input === 'h') {
      store.browserAction(agentId, 'hide')
      return
    }
    if (input === 'X') {
      // Clearing wipes the browser's logins, so it asks first (spec §3.1 #39).
      return overlay.confirm({
        title: L(`Limpar o navegador de ${name}?`, `Clear ${name}'s browser?`),
        detail: L('Isto apaga os logins e o histórico dele; ele vai ter que entrar de novo.', 'This deletes its logins and history; it will have to sign in again.'),
        yes: L('limpar', 'clear'),
        onYes: () => store.browserAction(agentId, 'clear')
      })
    }
  })

  if (!view) return <Text color={t.faint}>{L(`${name} não tem navegador aberto.`, `${name} has no browser open.`)}</Text>
  return (
    <Box flexDirection="column">
      <Text bold color={t.heading}>{view.title || view.url || L(`navegador de ${name}`, `${name}'s browser`)}</Text>
      <Text color={t.dim}>{`${view.url} · ${view.shown ? L('você está no controle', 'you are in control') : L('o agente está dirigindo', 'the agent is driving')}`}</Text>
      {view.doing ? <Text color={t.working}>{L(`agora: ${view.doing.label} ${view.doing.detail}`, `now: ${view.doing.label} ${view.doing.detail}`)}</Text> : null}
      {view.log.length || view.doing ? <Text color={t.faint}>{L('o que ele fez (mais antigo primeiro):', 'what it did (oldest first):')}</Text> : null}
      {view.log.map((l, i) => (
        <Text key={`${l.at}-${i}`} color={t.dim}>{`  ${logClock(l.at)}  ${l.label} ${l.detail}`}</Text>
      ))}
      {!view.log.length && !view.doing ? <Text color={t.faint}>{L('Nada ainda.', 'Nothing yet.')}</Text> : null}
      {frame ? (
        prepared?.canDrawImages ? (
          // The live frame, outside Ink and full screen (§2.4); Esc closes the panel.
          <ImageOverlay prepared={prepared} cell={runtime.cell} />
        ) : (
          <Text color={t.placeholder}>{prepared ? prepared.fallback() : L('[quadro ao vivo — não deu para ler]', '[live frame — could not read it]')}</Text>
        )
      ) : (
        <Text color={t.faint}>{L('Nenhuma página sendo desenhada agora.', 'No page is drawn right now.')}</Text>
      )}
      <Hint keys={[['s', 'take over'], ['h', 'hide'], ['X', 'clear logins'], ['Esc', 'close']]} />
    </Box>
  )
}
