// The banner (spec §2.5, §3.4 row 15): one line, drawn once, saying who this client
// is, which version, whose workspace, and where the data folder is.
import { describe, expect, it } from 'vitest'
import { mount } from './helpers/screen'
import { store } from '../src/tuicano/store'
import { runtime } from '../src/tuicano/runtime'
import { Banner } from '../src/tuicano/screens/Banner'

describe('the opening banner', () => {
  it('shows the name, the version, the workspace and the data folder', () => {
    runtime.version = '9.9.9'
    runtime.dataDir = '/tmp/tucano-data'
    store.dispatch({ type: 'settings', settings: { ...store.getState().settings, workspaceName: 'Time Alpha' } })
    const m = mount(() => <Banner />)
    const frame = m.first() || m.frame()
    expect(frame).toContain('TUIcano')
    expect(frame).toContain('9.9.9')
    expect(frame).toContain('Time Alpha')
    expect(frame).toContain('/tmp/tucano-data')
    m.unmount()
  })
})
