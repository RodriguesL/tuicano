// The data folder (spec §4.7) and the rule for secrets across the two hosts
// (spec §4.4): both decide whether the app and the terminal mean the same thing,
// so both are pinned here.
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nodeHost } from '../src/host/node'
import { defaultDataDir, resolveDataDir } from '../src/tuicano/paths'

describe('the data folder', () => {
  it('defaults to the app\'s own folder, so the terminal and the window are one team', () => {
    const dir = defaultDataDir()
    expect(dir.endsWith(join('', 'Tucano'))).toBe(true)
    expect(dir.startsWith(homedir()) || process.platform === 'win32').toBe(true)
    expect(resolveDataDir([], {})).toBe(dir)
  })

  it('takes an explicit folder from --data, in either spelling', () => {
    expect(resolveDataDir(['--data', './scratch'], {})).toBe(resolve('./scratch'))
    expect(resolveDataDir(['--data=/tmp/here'], {})).toBe('/tmp/here')
    expect(resolveDataDir(['cli', 'snapshot', '--data', '/tmp/x'], {})).toBe('/tmp/x')
  })

  it('lets the flag win over the environment, and the environment win over the default', () => {
    const env = { TUCANO_DATA: '/tmp/from-env' }
    expect(resolveDataDir([], env)).toBe('/tmp/from-env')
    expect(resolveDataDir(['--data', '/tmp/from-flag'], env)).toBe('/tmp/from-flag')
  })
})

describe('the secrets rule across the two hosts', () => {
  const cipher = nodeHost().cipher()

  it('reads what this host sealed', async () => {
    expect(await cipher.decrypt(await cipher.encrypt('sk-test'))).toBe('sk-test')
  })

  it('refuses a secret the app sealed with the system keychain, instead of reading it as a password', async () => {
    // What Electron's safeStorage leaves in SQLite: base64, no marker of ours.
    await expect(cipher.decrypt('v10+YWJjZGVm')).rejects.toThrow(/safeStorage|keychain/i)
  })
})
