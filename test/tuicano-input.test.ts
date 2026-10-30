// The editing core (spec §2.8): every form in the client is a string being edited
// by a terminal keyboard, and the cases that matter are the edges. Pure, so they
// are tested rather than typed by hand.
import { describe, expect, it } from 'vitest'
import { backspace, del, edit, end, home, insert, killAfter, killBefore, killWord, left, right, window } from '../src/tuicano/ui/input'

describe('editing a line', () => {
  it('inserts where the caret is, not only at the end', () => {
    const e = edit('abcd', 2)
    expect(insert(e, 'XY')).toEqual({ value: 'abXYcd', at: 4 })
    expect(insert(edit(''), 'hi')).toEqual({ value: 'hi', at: 2 })
  })

  it('backspaces at the start by doing nothing, and inside by joining', () => {
    expect(backspace(edit('abc', 0))).toEqual({ value: 'abc', at: 0 })
    expect(backspace(edit('abc', 2))).toEqual({ value: 'ac', at: 1 })
    expect(backspace(edit('abc', 3))).toEqual({ value: 'ab', at: 2 })
  })

  it('deletes forwards and stops at the end', () => {
    expect(del(edit('abc', 1))).toEqual({ value: 'ac', at: 1 })
    expect(del(edit('abc', 3))).toEqual({ value: 'abc', at: 3 })
    expect(del(edit('abc', 0))).toEqual({ value: 'bc', at: 0 })
  })

  it('moves the caret without running past either end', () => {
    const e = edit('ab', 1)
    expect(left(left(left(e)))).toEqual({ value: 'ab', at: 0 })
    expect(right(right(right(e)))).toEqual({ value: 'ab', at: 2 })
    expect(home(e)).toEqual({ value: 'ab', at: 0 })
    expect(end(e)).toEqual({ value: 'ab', at: 2 })
  })

  it('kills before, after and by word', () => {
    expect(killBefore(edit('hello world', 6))).toEqual({ value: 'world', at: 0 })
    expect(killAfter(edit('hello world', 5))).toEqual({ value: 'hello', at: 5 })
    expect(killWord(edit('keep this here', 14))).toEqual({ value: 'keep this ', at: 10 })
    expect(killWord(edit('trailing ', 9))).toEqual({ value: '', at: 0 })
  })

  it('clamps a caret that a caller made up', () => {
    expect(edit('ab', 99).at).toBe(2)
    expect(edit('ab', -5).at).toBe(0)
  })

  it('windows a long line around the caret, keeping the caret visible', () => {
    const long = edit('x'.repeat(50) + 'END', 53)
    const w = window(long, 10)
    expect(w.text.length).toBeLessThanOrEqual(10)
    expect(w.caret).toBeGreaterThanOrEqual(0)
    expect(w.caret).toBeLessThanOrEqual(10)
    // The window ends at the caret, so what is being typed stays on screen.
    expect(w.text.slice(w.caret - 3, w.caret)).toBe('END'.slice(0, 3))
    expect(window(edit('short', 2), 10)).toEqual({ text: 'short', caret: 2 })
  })
})
