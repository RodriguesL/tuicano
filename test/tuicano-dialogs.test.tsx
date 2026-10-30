// The dialogs (spec §3.3, §3.4 row 5): the six bodies the GUI opens over the app,
// drawn in the terminal's frame. One seeded state, so each body is rendered from the
// same team and the keys can be asserted by what they send to the store.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { agent, channel, dm, KEY, message, mount } from './helpers/screen'
import { store } from '../src/tuicano/store'
import { Dialogs } from '../src/tuicano/overlays/Dialogs'

// State updates from a keypress (and from an awaited store call) land a tick later.
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

beforeAll(() => {
  store.dispatch({ type: 'agent', agent: agent({ id: 'a1', name: 'Lia', handle: 'lia', role: 'Pesquisa' }) })
  store.dispatch({ type: 'agent', agent: agent({ id: 'a2', name: 'Rui', handle: 'rui', role: 'Engenharia' }) })
  store.dispatch({ type: 'agent', agent: agent({ id: 'a3', name: 'Velho', handle: 'velho', role: 'Antigo', archived: true }) })
  store.dispatch({ type: 'conversation', conversation: channel({ id: 'c1', name: 'geral', members: ['a1'], topic: 'notas' }) })
  store.dispatch({ type: 'conversation', conversation: dm({ id: 'd1', name: 'a1', members: ['a1'] }) })
  store.dispatch({ type: 'message', message: message({ id: 'm1', conversationId: 'c1', author: { kind: 'agent', id: 'a1' }, text: 'ola mundo' }) })
  store.dispatch({ type: 'message', message: message({ id: 'm2', conversationId: 'c1', author: { kind: 'me' }, text: 'projeto alpha' }) })
})

afterEach(() => vi.restoreAllMocks())

describe('the members dialog', () => {
  it('lists the non-archived agents and saves the picked set with Enter', async () => {
    const save = vi.spyOn(store, 'setChannelMembers').mockResolvedValue(undefined)
    const close = vi.fn()
    const m = mount(() => <Dialogs dialog={{ kind: 'members', id: 'c1' }} close={close} />)
    const first = m.frame()
    expect(first).toContain('Agents in #geral')
    expect(first).toContain('Lia')
    expect(first).toContain('Rui')
    expect(first).not.toContain('Velho')
    m.press(KEY.down) // the member first, then the rest: down moves to Rui
    await tick()
    m.press(KEY.space) // toggle Rui on
    await tick()
    m.press(KEY.enter)
    await tick()
    expect(save).toHaveBeenCalledWith('c1', ['a1', 'a2'])
    expect(close).toHaveBeenCalled()
    m.unmount()
  })
})

describe('the rename dialog', () => {
  it('shows the core message and stays open when the name is taken', async () => {
    const rename = vi.spyOn(store, 'renameChannel').mockRejectedValue(new Error('Já existe o canal #geral'))
    const close = vi.fn()
    const m = mount(() => <Dialogs dialog={{ kind: 'rename', id: 'c1' }} close={close} />)
    expect(m.frame()).toContain('geral')
    m.press(KEY.enter)
    await tick()
    expect(rename).toHaveBeenCalledWith('c1', 'geral')
    expect(m.frame()).toContain('Já existe o canal #geral')
    expect(close).not.toHaveBeenCalled()
    m.unmount()
  })
})

describe('the topic dialog', () => {
  it('shows the topic and saves it (an empty string clears it)', async () => {
    const setTopic = vi.spyOn(store, 'setTopic').mockResolvedValue(undefined)
    const close = vi.fn()
    const m = mount(() => <Dialogs dialog={{ kind: 'topic', id: 'c1' }} close={close} />)
    expect(m.frame()).toContain('notas')
    m.press(KEY.enter)
    await tick()
    expect(setTopic).toHaveBeenCalledWith('c1', 'notas')
    expect(close).toHaveBeenCalled()
    m.unmount()
  })
})

describe('the archived dialog', () => {
  it('lists the archived agent: Enter unarchives, n opens its page', async () => {
    const back = vi.spyOn(store, 'archiveAgent').mockResolvedValue(undefined)
    const nav = vi.spyOn(store, 'navigate').mockImplementation(() => {})
    const close = vi.fn()
    const m = mount(() => <Dialogs dialog={{ kind: 'archived' }} close={close} />)
    expect(m.frame()).toContain('Velho')
    expect(m.frame()).not.toContain('Lia')
    m.press(KEY.enter)
    await tick()
    expect(back).toHaveBeenCalledWith('a3', false)
    m.press('n')
    await tick()
    expect(nav).toHaveBeenCalledWith({ kind: 'agent', id: 'a3' })
    expect(close).toHaveBeenCalled()
    m.unmount()
  })
})

describe('the new channel dialog', () => {
  it('creates, navigates and opens the members dialog for it', async () => {
    const create = vi.spyOn(store, 'newChannel').mockResolvedValue('c9')
    const nav = vi.spyOn(store, 'navigate').mockImplementation(() => {})
    const close = vi.fn()
    const m = mount(() => <Dialogs dialog={{ kind: 'new-channel' }} close={close} />)
    m.type('pagamentos')
    await tick()
    m.press(KEY.enter)
    await tick()
    expect(create).toHaveBeenCalledWith('pagamentos')
    expect(nav).toHaveBeenCalledWith({ kind: 'conversation', id: 'c9' })
    expect(m.overlay.calls.some((c) => c.kind === 'dialog' && (c.value as { kind: string }).kind === 'members')).toBe(true)
    m.unmount()
  })
})

describe('the search dialog', () => {
  it('filters message text and Enter navigates to its conversation', async () => {
    const nav = vi.spyOn(store, 'navigate').mockImplementation(() => {})
    const close = vi.fn()
    const m = mount(() => <Dialogs dialog={{ kind: 'search' }} close={close} />)
    m.type('alpha')
    await tick()
    const frame = m.frame()
    expect(frame).toContain('Messages')
    expect(frame).toContain('projeto alpha')
    expect(frame).toContain('you in #geral')
    expect(frame).not.toContain('ola mundo')
    m.press(KEY.enter)
    await tick()
    expect(nav).toHaveBeenCalledWith({ kind: 'conversation', id: 'c1' })
    expect(close).toHaveBeenCalled()
    m.unmount()
  })

  it('filters agents and Enter opens their DM', async () => {
    const openDm = vi.spyOn(store, 'openDm').mockResolvedValue(undefined)
    const close = vi.fn()
    const m = mount(() => <Dialogs dialog={{ kind: 'search' }} close={close} />)
    m.type('engenharia') // Rui's role: no conversation matches
    await tick()
    expect(m.frame()).toContain('@rui')
    m.press(KEY.enter)
    await tick()
    expect(openDm).toHaveBeenCalledWith('a2')
    m.unmount()
  })

  it('closes on backspace with an empty field', async () => {
    const close = vi.fn()
    const m = mount(() => <Dialogs dialog={{ kind: 'search' }} close={close} />)
    m.press(KEY.backspace)
    await tick()
    expect(close).toHaveBeenCalled()
    m.unmount()
  })
})
