// The gate under a cursor move (spec §3.1 #28): with two approvals waiting, the key
// must decide the one under the cursor. Ink re-registers a key handler on every
// render, so a handler that reads its row from the render closure can decide the
// *previous* row — which, for an approval, is the one thing this product cannot get
// wrong.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KEY, approval, mount, stateOf } from './helpers/screen'
import { Approvals } from '../src/tuicano/screens/Approvals'
import { store } from '../src/tuicano/store'

const two = () =>
  stateOf(
    { type: 'agent', agent: { id: 'a1', name: 'Lia', handle: 'lia', role: '', color: 'teal', instructions: '', modelId: 'sonnet', effort: 'low', limit: 1, used: 0, grants: {}, memory: 'read', computer: false, archived: false } },
    { type: 'approval', approval: approval({ id: 'first', tool: 'delete_task' }) },
    { type: 'approval', approval: approval({ id: 'second', tool: 'send_email' }) }
  )

afterEach(() => vi.restoreAllMocks())

describe('the approval list', () => {
  it('decides the approval under the cursor, not the one from the last render', async () => {
    const decide = vi.spyOn(store, 'decideApproval').mockImplementation(() => undefined)
    const m = mount(() => <Approvals state={two()} active />)
    await m.press(KEY.down) // move to the second
    await m.press('y')
    expect(decide).toHaveBeenCalledWith('second', 'approved', undefined, false)
    decide.mockRestore()
    m.unmount()
  })

  it('decides the first when the cursor never moved', async () => {
    const decide = vi.spyOn(store, 'decideApproval').mockImplementation(() => undefined)
    const m = mount(() => <Approvals state={two()} active />)
    await m.press('y')
    expect(decide).toHaveBeenCalledWith('first', 'approved', undefined, false)
    decide.mockRestore()
    m.unmount()
  })

  it('arms a high-risk one instead of approving it', async () => {
    const decide = vi.spyOn(store, 'decideApproval').mockImplementation(() => undefined)
    const state = stateOf({ type: 'approval', approval: approval({ id: 'risky', highRisk: true }) })
    const m = mount(() => <Approvals state={state} active />)
    await m.press('y')
    expect(decide).not.toHaveBeenCalled()
    expect(m.frame()).toContain('press the same key again')
    decide.mockRestore()
    m.unmount()
  })
})
