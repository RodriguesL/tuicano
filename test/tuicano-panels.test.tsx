// The side panels (spec §3.3: artifact, service, browser; P1 for artifact/service,
// P4 for the browser). The component reads the shared state, so the tests fill the
// real store with the same CoreEvents the client reduces, then mount it.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Panels } from '../src/tuicano/overlays/Panels'
import { store } from '../src/tuicano/store'
import { artifact, mount } from './helpers/screen'

afterEach(() => vi.restoreAllMocks())

describe('the artifact panel', () => {
  it('shows the name, kind, size and source of a text artifact', () => {
    store.dispatch({ type: 'artifact', artifact: artifact({ id: 'pa', kind: 'markdown', name: 'notas.md', title: 'Notas', source: 'https://example.com/notas', size: 2048 }) })
    const m = mount(() => <Panels panel={{ kind: 'artifact', id: 'pa' }} close={() => {}} />)
    const frame = m.frame()
    expect(frame).toContain('Notas')
    expect(frame).toContain('markdown')
    expect(frame).toContain('notas.md')
    expect(frame).toContain('2 KB')
    expect(frame).toContain('https://example.com/notas')
    m.unmount()
  })

  it('says so when the file is not in the state', () => {
    const m = mount(() => <Panels panel={{ kind: 'artifact', id: 'missing' }} close={() => {}} />)
    expect(m.frame()).toContain('File not found.')
    m.unmount()
  })
})

describe('the service panel', () => {
  it('lists the agent services with port and state', () => {
    store.dispatch({
      type: 'computer',
      computer: { agentId: 'a-svc', state: 'running', folder: '/work', services: [{ name: 'web', command: 'npm run dev', port: 3000, url: 'http://127.0.0.1:3000', running: true, startedAt: 0 }] }
    })
    const m = mount(() => <Panels panel={{ kind: 'service', agentId: 'a-svc', name: 'web' }} close={() => {}} />)
    const frame = m.frame()
    expect(frame).toContain('web')
    expect(frame).toContain('3000')
    expect(frame).toContain('running')
    m.unmount()
  })

  it('s stops the selected service', () => {
    const stop = vi.spyOn(store, 'stopService').mockImplementation(() => {})
    store.dispatch({
      type: 'computer',
      computer: { agentId: 'a-svc2', state: 'running', folder: '/work', services: [{ name: 'api', command: 'node server.js', port: 4000, running: true, startedAt: 0 }] }
    })
    const m = mount(() => <Panels panel={{ kind: 'service', agentId: 'a-svc2', name: 'api' }} close={() => {}} />)
    m.press('s')
    expect(stop).toHaveBeenCalledWith('a-svc2', 'api')
    m.unmount()
  })
})

describe('the browser panel', () => {
  it('shows the page and the action log, oldest first', () => {
    store.dispatch({
      type: 'browser',
      view: { agentId: 'a-br', url: 'https://example.com', title: 'Example', shown: false, log: [{ label: 'Opened', detail: 'https://example.com', at: 0 }, { label: 'Clicked', detail: 'Search', at: 1 }], at: 2 }
    })
    const m = mount(() => <Panels panel={{ kind: 'browser', agentId: 'a-br' }} close={() => {}} />)
    const frame = m.frame()
    expect(frame).toContain('Example')
    expect(frame).toContain('https://example.com')
    expect(frame.indexOf('Opened')).toBeLessThan(frame.indexOf('Clicked'))
    m.unmount()
  })

  it('asks before clearing the browser logins, then clears', () => {
    const action = vi.spyOn(store, 'browserAction').mockImplementation(() => {})
    store.dispatch({ type: 'browser', view: { agentId: 'a-br2', url: 'https://example.org', title: 'Org', shown: true, log: [], at: 0 } })
    const m = mount(() => <Panels panel={{ kind: 'browser', agentId: 'a-br2' }} close={() => {}} />)
    m.press('X')
    const confirm = m.overlay.calls.find((c) => c.kind === 'confirm')
    expect(confirm).toBeTruthy()
    expect(action).not.toHaveBeenCalled()
    ;(confirm!.value as { onYes: () => void }).onYes()
    expect(action).toHaveBeenCalledWith('a-br2', 'clear')
    m.unmount()
  })

  it('s takes over and h hands the browser back', () => {
    const action = vi.spyOn(store, 'browserAction').mockImplementation(() => {})
    store.dispatch({ type: 'browser', view: { agentId: 'a-br3', url: 'https://example.net', title: 'Net', shown: false, log: [], at: 0 } })
    const m = mount(() => <Panels panel={{ kind: 'browser', agentId: 'a-br3' }} close={() => {}} />)
    m.press('s')
    expect(action).toHaveBeenCalledWith('a-br3', 'show')
    m.press('h')
    expect(action).toHaveBeenCalledWith('a-br3', 'hide')
    m.unmount()
  })
})
