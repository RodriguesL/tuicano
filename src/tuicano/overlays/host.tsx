// The overlay host (spec §2.8): the frame, the Esc key, the confirmation and the
// one-line prompt every screen shares. Screens hand it content; it never knows
// what the content means.
import { Box, Text, useInput, useWindowSize } from 'ink'
import { useState, type ReactNode } from 'react'
import { useTheme } from '../theme/context'
import { Form } from '../ui/form'
import type { Overlay, Prompt } from './api'
import { Dialogs } from './Dialogs'
import { Panels } from './Panels'
import { ThemePicker } from './ThemePicker'

export function OverlayHost({ overlay, onClose, theme, onTheme }: { overlay: Overlay; onClose: () => void; theme?: string; onTheme?: (name: string) => void }): ReactNode {
  const t = useTheme()
  const { columns } = useWindowSize()
  const width = Number.isFinite(columns) ? Math.max(30, Math.min(110, columns - 6)) : 80
  // The frame owns Esc for everything it draws: a sheet, a dialog and a panel are
  // the host's frames, and each of them being responsible for its own escape is how
  // one of them ends up not closable (which is exactly what happened once).
  useInput(
    (_input, key) => {
      if (key.escape) onClose()
    },
    { isActive: overlay.kind === 'sheet' || overlay.kind === 'dialog' || overlay.kind === 'panel' || overlay.kind === 'themes' }
  )
  const title = overlay.kind === 'prompt' ? overlay.prompt.title : overlay.kind === 'confirm' ? overlay.title : overlay.kind === 'sheet' ? overlay.title : ''
  return (
    <Box flexDirection="column" borderStyle="double" borderColor={t.borderFocus} paddingX={1} width={width} alignSelf="center">
      {title ? <Text bold color={t.heading}>{title}</Text> : null}
      {overlay.kind === 'prompt' ? <PromptOverlay prompt={overlay.prompt} onClose={onClose} /> : null}
      {overlay.kind === 'confirm' ? <ConfirmOverlay overlay={overlay} onClose={onClose} /> : null}
      {overlay.kind === 'sheet' ? overlay.render(onClose) : null}
      {overlay.kind === 'dialog' ? <Dialogs dialog={overlay.dialog} close={onClose} /> : null}
      {overlay.kind === 'panel' ? <Panels panel={overlay.panel} close={onClose} /> : null}
      {overlay.kind === 'themes' ? <ThemePicker current={theme} onPick={(name) => { onTheme?.(name); onClose() }} onClose={onClose} /> : null}
    </Box>
  )
}

function PromptOverlay({ prompt, onClose }: { prompt: Prompt; onClose: () => void }): ReactNode {
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [value, setValue] = useState(prompt.value ?? '')
  return (
    <Form
      fields={[
        {
          id: 'value',
          label: prompt.label ?? 'Value',
          hint: prompt.hint,
          kind: 'text',
          value,
          placeholder: prompt.placeholder,
          mask: prompt.mask,
          onChange: setValue
        }
      ]}
      error={error}
      busy={busy}
      submitLabel="Enter"
      onCancel={() => {
        prompt.onCancel?.()
        onClose()
      }}
      onSubmit={async () => {
        setBusy(true)
        setError(undefined)
        try {
          await prompt.onSubmit(value)
          onClose()
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
          setBusy(false)
        }
      }}
    />
  )
}

function ConfirmOverlay({ overlay, onClose }: { overlay: Extract<Overlay, { kind: 'confirm' }>; onClose: () => void }): ReactNode {
  const t = useTheme()
  const [busy, setBusy] = useState(false)
  useInput((input, key) => {
    if (key.escape || input === 'n') return onClose()
    if (input === 'y' || key.return) {
      setBusy(true)
      void Promise.resolve(overlay.onYes()).finally(onClose)
    }
  })
  return (
    <Box flexDirection="column">
      <Text color={t.text}>{overlay.title}</Text>
      {overlay.detail ? <Text color={t.dim}>{overlay.detail}</Text> : null}
      <Text color={t.faint}>
        <Text color={t.danger}>{'y'}</Text> {busy ? 'working…' : overlay.yes} {'  ·  '}
        <Text color={t.dim}>n</Text> cancel
      </Text>
    </Box>
  )
}
