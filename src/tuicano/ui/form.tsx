// The form engine (spec §2.8): one place that knows how a terminal edits text,
// chooses an option and submits, so twenty forms cannot disagree about whether
// arrows change a value or whether Ctrl+S saves.
import { Box, Text, useInput } from 'ink'
import { useRef, useState, type ReactNode } from 'react'
import { L } from '../../shared/lang'
import { useTheme } from '../theme/context'
import { backspace, ctrlKey, del, edit, end, home, insert, killAfter, killBefore, killWord, left, right, window, type Edit } from './input'
import { CURSOR, Field, Segmented } from './kit'

export interface FieldSpec {
  id: string
  label: string
  hint?: string
  kind: 'text' | 'lines' | 'select' | 'toggle' | 'action'
  value: string
  options?: { value: string; label: string }[]
  placeholder?: string
  /** Secrets: shown as bullets, never echoed back. */
  mask?: boolean
  onChange?: (v: string) => void
  onActivate?: () => void | Promise<void>
}

export interface FormProps {
  title?: string
  fields: FieldSpec[]
  onSubmit?: () => void | Promise<void>
  onCancel: () => void
  submitLabel?: string
  /** A message from the core ("that name is taken"), shown above the keys. */
  error?: string
  busy?: boolean
}

export function Form({ title, fields, onSubmit, onCancel, submitLabel = 'Enter', error, busy }: FormProps): ReactNode {
  const t = useTheme()
  const [at, setAt] = useState(0)
  const [cares, setCares] = useState<Record<string, Edit>>({})
  const caret = (f: FieldSpec): Edit => cares[f.id] ?? edit(f.value)

  const setValue = (f: FieldSpec, text: string, next: number): void => {
    setCares((c) => ({ ...c, [f.id]: edit(text, next) }))
    f.onChange?.(text)
  }

  const move = (n: number): void => setAt((i) => Math.max(0, Math.min(fields.length - 1, i + n)))
  const current = fields[Math.min(at, Math.max(0, fields.length - 1))]
  // A ref, so the handler always sees the newest fields without re-registering.
  const latest = useRef({ fields, at, onSubmit, onCancel, cares })
  latest.current = { fields, at, onSubmit, onCancel, cares }

  useInput((input, key) => {
    const f = latest.current.fields[latest.current.at]
    if (!f) return
    const ctrl = key.ctrl || key.meta
    if (key.escape) return onCancel()
    if (ctrlKey(input, key, 's')) return void onSubmit?.()
    if (ctrl && key.return) return void onSubmit?.()
    if (key.tab) return move(key.shift ? -1 : 1)

    if (f.kind === 'select') {
      const opts = f.options ?? []
      const i = Math.max(0, opts.findIndex((o) => o.value === f.value))
      if (key.leftArrow || key.upArrow || input === 'h') return f.onChange?.(opts[(i - 1 + opts.length) % opts.length]?.value ?? f.value)
      if (key.rightArrow || key.downArrow || input === 'l' || input === ' ') return f.onChange?.(opts[(i + 1) % opts.length]?.value ?? f.value)
      if (key.return) return move(1)
      return
    }
    if (f.kind === 'toggle') {
      if (input === ' ' || key.return || key.leftArrow || key.rightArrow) {
        f.onChange?.(f.value === 'on' ? 'off' : 'on')
        return
      }
      return
    }
    if (f.kind === 'action') {
      if (key.return || input === ' ') return void f.onActivate?.()
      if (key.downArrow || input === 'j') return move(1)
      if (key.upArrow || input === 'k') return move(-1)
      return
    }

    // text and lines
    const c = caret(f)
    if (key.return) {
      // In a multi-line field Enter belongs to the text; everywhere else it moves on.
      if (f.kind === 'lines' && !ctrl) return setValue(f, insert(c, '\n').value, insert(c, '\n').at)
      if (latest.current.at === latest.current.fields.length - 1) return void onSubmit?.()
      return move(1)
    }
    if (key.upArrow && f.kind === 'lines') {
      // Up and down walk the wrapped lines, the way a person expects in a block.
      const before = c.value.slice(0, c.at)
      const lineStart = before.lastIndexOf('\n') + 1
      if (lineStart === 0) return move(-1)
      const col = c.at - lineStart
      const prevEnd = lineStart - 1
      const prevStart = c.value.lastIndexOf('\n', prevEnd - 1) + 1
      return setCares((s) => ({ ...s, [f.id]: edit(c.value, Math.min(prevStart + col, prevEnd)) }))
    }
    if (key.downArrow && f.kind === 'lines') {
      const after = c.value.indexOf('\n', c.at)
      if (after < 0) return move(1)
      const lineStart = c.value.lastIndexOf('\n', c.at) + 1
      const col = c.at - lineStart
      const nextStart = after + 1
      const nextEnd = c.value.indexOf('\n', nextStart) < 0 ? c.value.length : c.value.indexOf('\n', nextStart)
      return setCares((s) => ({ ...s, [f.id]: edit(c.value, Math.min(nextStart + col, nextEnd)) }))
    }
    if (key.upArrow) return move(-1)
    if (key.downArrow) return move(1)
    if (key.leftArrow && !ctrl) return setCares((s) => ({ ...s, [f.id]: left(c) }))
    if (key.rightArrow && !ctrl) return setCares((s) => ({ ...s, [f.id]: right(c) }))
    if (key.backspace || key.delete) return setValue(f, (key.delete ? del(c) : backspace(c)).value, (key.delete ? del(c) : backspace(c)).at)
    if (ctrlKey(input, key, 'u')) return setValue(f, killBefore(c).value, killBefore(c).at)
    if (ctrlKey(input, key, 'k') && f.kind === 'lines') return setValue(f, killAfter(c).value, killAfter(c).at)
    if (ctrlKey(input, key, 'w')) return setValue(f, killWord(c).value, killWord(c).at)
    if (ctrlKey(input, key, 'a')) return setCares((s) => ({ ...s, [f.id]: home(c) }))
    if (ctrlKey(input, key, 'e')) return setCares((s) => ({ ...s, [f.id]: end(c) }))
    if (input && !ctrl) {
      const next = insert(c, input)
      return setValue(f, next.value, next.at)
    }
  })

  const line = (f: FieldSpec, focused: boolean): ReactNode => {
    const c = caret(f)
    const text = f.mask ? '•'.repeat(c.value.length) : c.value
    if (f.mask) {
      return (
        <Text color={text ? t.text : t.faint}>
          {text || f.placeholder || ''}
          {focused ? <Text color={t.accent}>▏</Text> : null}
        </Text>
      )
    }
    if (f.kind === 'lines') {
      const lines = text.split('\n')
      const shown = lines.map((l, i) => (
        <Text key={i} color={l ? t.text : t.faint}>
          {l || (i === 0 && !c.value ? f.placeholder ?? '' : '')}
        </Text>
      ))
      return <Box flexDirection="column">{shown}</Box>
    }
    // One line with a horizontal window, so a long value scrolls under the caret.
    const w = window(c, Math.max(20, (process.stdout.columns ?? 80) - 12))
    return (
      <Text color={c.value ? t.text : t.faint}>
        {c.value ? w.text.slice(0, w.caret) : f.placeholder || ''}
        {focused ? <Text color={t.accent}>{c.value.slice(w.caret, w.caret + 1) || '▏'}</Text> : null}
        {focused && c.value.slice(w.caret + 1) ? c.value.slice(w.caret + 1) : ''}
        {!focused && c.value ? w.text.slice(w.caret) : ''}
      </Text>
    )
  }

  return (
    <Box flexDirection="column">
      {title ? <Text bold color={t.heading}>{title}</Text> : null}
      {fields.map((f, i) => (
        <Field key={f.id} label={f.label} hint={f.hint} focused={i === at}>
          {f.kind === 'select' ? (
            <Segmented options={f.options ?? []} value={f.value} onChange={(v) => f.onChange?.(v)} focused={i === at} />
          ) : f.kind === 'toggle' ? (
            <Segmented options={[{ value: 'on', label: L('ligado', 'on') }, { value: 'off', label: L('desligado', 'off') }]} value={f.value} onChange={(v) => f.onChange?.(v)} focused={i === at} />
          ) : f.kind === 'action' ? (
            <Text color={i === at ? t.accent : t.dim} bold={i === at}>{`[ ${f.value} ]`}</Text>
          ) : (
            line(f, i === at)
          )}
        </Field>
      ))}
      {error ? <Text color={t.danger}>{error}</Text> : null}
      <Text color={t.faint}>
        <Text color={t.dim}>{busy ? L('salvando…', 'working…') : L(`${submitLabel} salva`, `${submitLabel} saves`)}</Text>
        {L('  ·  Esc cancela  ·  Tab próximo campo  ·  ↑↓ move  ·  Ctrl+S salva', '  ·  Esc cancels  ·  Tab next field  ·  ↑↓ moves  ·  Ctrl+S saves')}
      </Text>
      {at < fields.length - 1 ? <Text color={t.faint}>{L(`${CURSOR} Enter no último campo salva`, `${CURSOR} Enter on the last field saves`)}</Text> : null}
    </Box>
  )
}
