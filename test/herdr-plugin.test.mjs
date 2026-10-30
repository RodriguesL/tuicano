// The herdr bridge's pure parts (docs/spec-tuicano.md §5, P6). The bridge itself is a
// one-shot process, so what can be tested without herdr is its reading of the world:
// the context herdr hands it, the links it routes, and which conversation an action
// means. Written as ESM so it can import the bridge's module directly.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { agentOf, clientPath, contextOf, graphics, linkOf, planConversation, readState, writeState } from '../herdr-plugin/bin/bridge.mjs'

const dirs = []
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'bridge-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

// A context shaped like the one herdr hands a pane, with the fields nested the way a
// real one is, so the reader is exercised rather than a flat fixture.
const CTX = {
  HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify({
    workspace: { workspace_id: 'w7', label: 'tuicano' },
    tab: { tab_id: 'w7:t1' },
    focused_pane: { pane_id: 'w7:p2', cwd: '/Users/x/proj', foreground_cwd: '/Users/x/proj', agent: 'opencode' },
    worktree: { path: '/Users/x/proj-worktree' },
    selection: { selected_text: 'why does this test fail' },
    clicked_url: 'tucano://artifact/0f6f0f18-0a1f-4a1e-9a4f-2a4a2b3c4d5e/shot.png'
  }),
  HERDR_TAB_ID: 'w7:t1',
  HERDR_PANE_ID: 'w7:p2'
}

describe('the context herdr hands the bridge', () => {
  it('reads the fields it needs out of a nested context', () => {
    const ctx = contextOf(CTX)
    expect(ctx.text).toBe('why does this test fail')
    expect(ctx.url).toBe('tucano://artifact/0f6f0f18-0a1f-4a1e-9a4f-2a4a2b3c4d5e/shot.png')
    expect(ctx.cwd).toBe('/Users/x/proj')
    expect(ctx.agent).toBe('opencode')
    expect(ctx.tabId).toBe('w7:t1')
    expect(ctx.paneId).toBe('w7:p2')
    expect(ctx.raw.workspace.label).toBe('tuicano')
  })

  it('survives a context it cannot parse, and falls back to the injected ids', () => {
    const ctx = contextOf({ HERDR_PLUGIN_CONTEXT_JSON: 'not json', HERDR_TAB_ID: 'w1:t1', HERDR_PANE_ID: 'w1:p3' })
    expect(ctx.text).toBeUndefined()
    expect(ctx.url).toBeUndefined()
    expect(ctx.tabId).toBe('w1:t1')
    expect(ctx.paneId).toBe('w1:p3')
    expect(ctx.raw).toEqual({})
  })

  it('reads an empty context without inventing anything', () => {
    const ctx = contextOf({})
    expect(ctx.text).toBeUndefined()
    expect(ctx.cwd).toBeUndefined()
  })
})

describe('the links it routes', () => {
  it('takes an artifact URL, with and without a file name', () => {
    const id = '0f6f0f18-0a1f-4a1e-9a4f-2a4a2b3c4d5e'
    expect(linkOf(`tucano://artifact/${id}/shot.png`)).toEqual({ kind: 'artifact', id, name: 'shot.png' })
    expect(linkOf(`tucano://artifact/${id}`)).toEqual({ kind: 'artifact', id, name: '' })
    expect(linkOf(`tucano://artifact/${id}/a%20b.png`)).toEqual({ kind: 'artifact', id, name: 'a b.png' })
  })

  it('takes an agent URL, and refuses anything else', () => {
    expect(linkOf('tucano://agent/a1')).toEqual({ kind: 'agent', id: 'a1' })
    expect(linkOf('https://example.com')).toBeUndefined()
    expect(linkOf('@lia')).toBeUndefined()
    expect(linkOf(undefined)).toBeUndefined()
    // Only URLs reach a link handler, which is why a mention is not one.
    expect(linkOf('tucano://artifact/not-a-uuid/x.png')).toBeUndefined()
  })
})

const snap = {
  agents: [
    { id: 'a1', handle: 'lia', name: 'Lia' },
    { id: 'a2', handle: 'theo', name: 'Theo' }
  ],
  conversations: [
    { id: 'c1', kind: 'channel', name: 'engenharia' },
    { id: 'c2', kind: 'dm', name: 'a1' }
  ]
}

describe('which conversation an action means', () => {
  it('takes an id or a channel name when it is asked for one', () => {
    expect(planConversation(snap, 'c2', {}).id).toBe('c2')
    expect(planConversation(snap, '#engenharia', {}).id).toBe('c1')
    expect(planConversation(snap, 'engenharia', {}).id).toBe('c1')
  })

  it('prefers the last one it opened, then the first channel', () => {
    expect(planConversation(snap, undefined, { lastConversation: { id: 'c2' } }).id).toBe('c2')
    expect(planConversation(snap, undefined, {}).id).toBe('c1')
    expect(planConversation(snap, undefined, { lastConversation: { id: 'gone' } }).id).toBe('c1')
  })

  it('says nothing when there is nowhere to go', () => {
    expect(planConversation({ conversations: [], agents: [] }, undefined, {})).toBeUndefined()
  })

  it('finds an agent by handle, name or id, however it is written', () => {
    expect(agentOf(snap, 'lia').id).toBe('a1')
    expect(agentOf(snap, '@Theo').id).toBe('a2')
    expect(agentOf(snap, 'Lia').id).toBe('a1')
    expect(agentOf(snap, 'a2').id).toBe('a2')
    expect(agentOf(snap, undefined)).toBeUndefined()
    expect(agentOf(snap, 'nobody')).toBeUndefined()
  })
})

describe('the settings a pane runs with', () => {
  it('asks for kitty unless it is told otherwise, because a herdr pane cannot be asked', () => {
    expect(graphics({})).toBe('kitty')
    expect(graphics({ TUICANO_GRAPHICS: 'none' })).toBe('none')
    expect(graphics({ TUICANO_GRAPHICS: 'sixel' })).toBe('sixel')
  })

  it('drives the checkout build, or an installed client when told to', () => {
    expect(clientPath({ TUICANO_BIN: '/usr/local/bin/tuicano' })).toBe('/usr/local/bin/tuicano')
    const found = clientPath({})
    expect(found === 'tuicano' || found.endsWith(join('out', 'tuicano', 'index.js'))).toBe(true)
  })
})

describe('the state it keeps', () => {
  it('starts empty, keeps what it is given, and survives a corrupt file', () => {
    const env = { HERDR_PLUGIN_STATE_DIR: tmp() }
    expect(readState(env)).toEqual({ lastConversation: undefined, lends: [], panes: {} })
    writeState({ lastConversation: { id: 'c1', name: '#engenharia' }, lends: [{ tabId: 'w1:t1', agentId: 'a1', path: '/x', name: 'x' }], panes: {} }, env)
    expect(readState(env).lends[0].path).toBe('/x')
    writeState({}, env)
    expect(readState(env).lends).toEqual([])
  })
})
