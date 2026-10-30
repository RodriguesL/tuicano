// Numbers, durations and dates, written the same way by both renderers (spec §3):
// a token count that reads "1,2 mi" in the window has to read "1,2 mi" in the
// terminal, or the parity contract is only about menus. Pure — no React, no DOM —
// so the GUI's components/ui.tsx re-exports these and TUIcano imports them.
import { L, lang, locale } from './lang'

export const usd = (v: number): string =>
  v < 0.01 && v > 0 ? `US$ ${v.toLocaleString(locale(), { minimumFractionDigits: 4, maximumFractionDigits: 4 })}` : `US$ ${v.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const tokens = (n: number): string =>
  n >= 1_000_000
    ? n >= 1_000_000_000
      ? `${(n / 1_000_000_000).toLocaleString(locale(), { maximumFractionDigits: 2 })}${L(' bi', 'B')}`
      : `${(n / 1_000_000).toLocaleString(locale(), { maximumFractionDigits: 2 })}${L(' mi', 'M')}`
    : n >= 1000
      ? `${(n / 1000).toLocaleString(locale(), { maximumFractionDigits: n >= 100_000 ? 0 : 1 })}k`
      : String(n)

export function duration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)} min ${s % 60}s`
}

// Monday 00:00 of the week `t` is in, and the Monday `n` weeks away.
export const startOfWeek = (t: number): number => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}
export const shiftWeek = (week: number, n: number): number => {
  const d = new Date(week)
  d.setDate(d.getDate() + 7 * n)
  return d.getTime()
}
// "26 de out a 1 de novembro", "19 a 25 de outubro"; "Oct 26 – Nov 1", "October 19 – 25"
export function weekRange(week: number): string {
  const last = new Date(shiftWeek(week, 1) - 86_400_000)
  const first = new Date(week)
  const f = (d: Date, o: Intl.DateTimeFormatOptions): string => d.toLocaleDateString(locale(), o).replace('.', '')
  const sameMonth = first.getMonth() === last.getMonth()
  if (lang() === 'en') return sameMonth ? `${f(first, { month: 'long', day: 'numeric' })} – ${f(last, { day: 'numeric' })}` : `${f(first, { month: 'short', day: 'numeric' })} – ${f(last, { month: 'short', day: 'numeric' })}`
  return `${f(first, { day: 'numeric' })}${!sameMonth ? ` de ${f(first, { month: 'short' })}` : ''} a ${f(last, { day: 'numeric', month: 'long' })}`
}

// "agora", "há 5 min", "ontem", "há 3 dias"; older than a month, the date.
export function ago(at: number, now = Date.now()): string {
  const min = Math.round((now - at) / 60_000)
  if (min < 1) return L('agora', 'just now')
  if (min < 60) return L(`há ${min} min`, `${min} min ago`)
  const h = Math.round(min / 60)
  if (h < 24) return L(`há ${h} h`, `${h} h ago`)
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days <= 1) return L('ontem', 'yesterday')
  if (days < 7) return L(`há ${days} dias`, `${days} days ago`)
  const weeks = Math.round(days / 7)
  if (days < 30) return L(`há ${weeks} semana${weeks > 1 ? 's' : ''}`, `${weeks} week${weeks > 1 ? 's' : ''} ago`)
  return new Date(at).toLocaleDateString(locale(), { day: '2-digit', month: 'short' }).replace('.', '')
}

export function time(at: number): string {
  const d = new Date(at)
  const today = new Date()
  const hm = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return hm
  return `${d.toLocaleDateString(locale(), { day: '2-digit', month: 'short' })} · ${hm}`
}

export const pct = (ok: number, total: number): string => (total ? `${Math.round((ok / total) * 100)}%` : '—')
