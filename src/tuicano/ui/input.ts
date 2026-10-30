// Editing a line of text, as pure functions (spec §2.8). Every form in the client
// is a string being edited by a terminal keyboard, and the interesting cases are
// all at the edges: backspace at the start, an arrow past the end, a paste that
// lands in the middle. Pure, so those are tested instead of typed by hand.
export interface Edit {
  value: string
  at: number // the caret, between 0 and value.length
}

export const edit = (value = '', at = value.length): Edit => ({ value, at: Math.max(0, Math.min(value.length, at)) })

// A control key, however the terminal delivers it: Ink hands Ctrl+T over as the raw
// control character in some terminals and as `t` with `ctrl: true` in others, and a
// binding that only knows one of them silently does nothing (which is exactly how
// the theme picker went missing from the keymap).
export function ctrlKey(input: string, key: { ctrl?: boolean; meta?: boolean }, letter: string): boolean {
  if (!key.ctrl && !key.meta) return false
  const lower = letter.toLowerCase()
  return input === lower || input === letter.toUpperCase() || input === String.fromCharCode(lower.charCodeAt(0) & 31)
}

const clamp = (e: Edit, at: number): Edit => ({ value: e.value, at: Math.max(0, Math.min(e.value.length, at)) })

export const insert = (e: Edit, text: string): Edit => insertAt(e, text, e.at)

export function insertAt(e: Edit, text: string, at: number): Edit {
  const cut = Math.max(0, Math.min(e.value.length, at))
  return { value: e.value.slice(0, cut) + text + e.value.slice(cut), at: cut + text.length }
}

export const backspace = (e: Edit): Edit => (e.at === 0 ? e : insertAt({ ...e, value: e.value.slice(0, e.at - 1) + e.value.slice(e.at) }, '', e.at - 1))

export const del = (e: Edit): Edit => (e.at >= e.value.length ? e : { value: e.value.slice(0, e.at) + e.value.slice(e.at + 1), at: e.at })

export const left = (e: Edit): Edit => clamp(e, e.at - 1)
export const right = (e: Edit): Edit => clamp(e, e.at + 1)
export const home = (e: Edit): Edit => clamp(e, 0)
export const end = (e: Edit): Edit => clamp(e, e.value.length)

// Ctrl+U: the line, from the caret back.
export const killBefore = (e: Edit): Edit => ({ value: e.value.slice(e.at), at: 0 })
// Ctrl+K: the line, from the caret on.
export const killAfter = (e: Edit): Edit => ({ value: e.value.slice(0, e.at), at: e.at })

// A word back, for Ctrl+W: whitespace, then the word.
export function killWord(e: Edit): Edit {
  const head = e.value.slice(0, e.at)
  const kept = head.replace(/(\S+\s*|\s+)$/, '')
  return { value: kept + e.value.slice(e.at), at: kept.length }
}

// The line around the caret, split for a one-line field that scrolls horizontally.
export function window(e: Edit, width: number): { text: string; caret: number } {
  const w = Math.max(1, width)
  const start = e.at <= w ? 0 : e.at - w + 1
  return { text: e.value.slice(start, start + w), caret: e.at - start }
}
