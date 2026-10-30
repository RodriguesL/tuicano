// The kit's small pieces (spec §2.8): one list, one field, one bar, one table. A
// screen that needs something else should add it here, so twelve screens cannot
// grow twelve ideas of what a selected row looks like.
import { Box, Text, type BoxProps } from 'ink'
import type { ReactNode } from 'react'
import { useTheme } from '../theme/context'

export const CURSOR = '›'

export interface Row {
  key: string
  label: string
  hint?: string
  badge?: number | string
  color?: string
  /** A row that is not a thing you can open: a heading, a separator. */
  heading?: boolean
}

export function List({ rows, cursor, active, empty, indent = 0, width }: { rows: Row[]; cursor: number; active: boolean; empty?: string; indent?: number; width?: number }): ReactNode {
  const t = useTheme()
  if (!rows.length && empty) return <Text color={t.faint}>{empty}</Text>
  return (
    <Box flexDirection="column" width={width}>
      {rows.map((r, i) => {
        const selected = active && i === cursor
        const head = ' '.repeat(indent)
        if (r.heading) return <Text key={r.key} bold color={t.heading}>{`${head}${r.label}`}</Text>
        return (
          <Text key={r.key} color={r.color ?? (selected ? t.text : t.dim)} inverse={selected}>
            {`${head}${selected ? `${CURSOR} ` : '  '}${r.label}`}
            {r.hint ? <Text color={t.faint}>{`  ${r.hint}`}</Text> : null}
            {r.badge ? <Text color={t.accent}>{`  (${r.badge})`}</Text> : null}
          </Text>
        )
      })}
    </Box>
  )
}

export function Field({ label, hint, children, focused }: { label: string; hint?: string; children?: ReactNode; focused?: boolean }): ReactNode {
  const t = useTheme()
  return (
    <Box flexDirection="column">
      <Text color={focused ? t.accent : t.dim} bold={focused}>
        {focused ? `${CURSOR} ` : '  '}
        {label}
      </Text>
      {children ? <Box paddingLeft={4}>{children}</Box> : null}
      {hint ? (
        <Text color={t.faint}>{`    ${hint}`}</Text>
      ) : null}
    </Box>
  )
}

export function Segmented<T extends string>({ options, value, onChange, focused }: { options: { value: T; label: string; hint?: string }[]; value: T; onChange: (v: T) => void; focused?: boolean }): ReactNode {
  const t = useTheme()
  return (
    <Box>
      {options.map((o) => (
        <Text key={o.value} color={o.value === value ? t.onAccent : focused ? t.text : t.dim} backgroundColor={o.value === value ? t.accent : undefined} bold={o.value === value}>
          {` ${o.label} `}
        </Text>
      ))}
      {focused ? <Text color={t.faint}>{'  ← →'}</Text> : null}
    </Box>
  )
}

/** A usage bar, in text: `████░░░░` — the terminal's answer to the app's chart. */
export function Bar({ used, limit, width = 24 }: { used: number; limit: number; width?: number }): ReactNode {
  const t = useTheme()
  const ratio = limit > 0 ? Math.max(0, Math.min(1, used / limit)) : 0
  const full = Math.round(ratio * width)
  const color = ratio >= 1 ? t.danger : ratio >= 0.8 ? t.warn : t.bar
  return (
    <Text>
      <Text color={color}>{'█'.repeat(full)}</Text>
      <Text color={t.barTrack}>{'░'.repeat(Math.max(0, width - full))}</Text>
      <Text color={t.faint}>{`  ${Math.round(ratio * 100)}%`}</Text>
    </Text>
  )
}

export interface Column {
  key: string
  label: string
  width?: number
  /** Right-aligned, for numbers. */
  right?: boolean
  color?: string
}

export function Table({ columns, rows, cursor, active }: { columns: Column[]; rows: Record<string, string>[]; cursor?: number; active?: boolean }): ReactNode {
  const t = useTheme()
  const w = (c: Column): number => c.width ?? Math.max(c.label.length, ...rows.map((r) => (r[c.key] ?? '').length), 1)
  const line = (cells: string[], dim: boolean, selected: boolean): ReactNode => (
    <Text inverse={selected}>
      {cells.map((cell, i) => (
        <Text key={i} color={dim ? t.faint : (columns[i]?.color ?? t.text)}>
          {columns[i]?.right ? cell.padStart(w(columns[i]!)) : cell.padEnd(w(columns[i]!))}
          {i < cells.length - 1 ? '  ' : ''}
        </Text>
      ))}
    </Text>
  )
  return (
    <Box flexDirection="column">
      {line(
        columns.map((c) => c.label),
        true,
        false
      )}
      {line(
        columns.map((c) => '─'.repeat(w(c))),
        true,
        false
      )}
      {rows.map((r, i) => (
        <Box key={i}>{line(columns.map((c) => r[c.key] ?? ''), false, !!active && cursor === i)}</Box>
      ))}
    </Box>
  )
}

/** The working indicator: no dependency, and it stops when it is not busy. */
export function Spinner({ busy, label, frame = 0 }: { busy: boolean; label?: string; frame?: number }): ReactNode {
  const t = useTheme()
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  if (!busy) return label ? <Text color={t.faint}>{label}</Text> : null
  return <Text color={t.working}>{`${frames[frame % frames.length]} ${label ?? ''}`}</Text>
}

export function Hint({ keys }: { keys: [string, string][] }): ReactNode {
  const t = useTheme()
  return (
    <Text color={t.faint}>
      {keys.map(([k, what], i) => (
        <Text key={k}>
          {i ? '  ' : ''}
          <Text color={t.dim}>{k}</Text>
          {` ${what}`}
        </Text>
      ))}
    </Text>
  )
}

/** A titled box: what a screen's sections and overlays are drawn in. */
export function Panel({ title, children, focused, ...rest }: { title?: string; children: ReactNode; focused?: boolean } & BoxProps): ReactNode {
  const t = useTheme()
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={focused ? t.borderFocus : t.border} paddingX={1} {...rest}>
      {title ? <Text bold color={t.heading}>{title}</Text> : null}
      {children}
    </Box>
  )
}
