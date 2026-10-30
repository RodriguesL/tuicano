// The host the core asks about the machine it runs on (spec §2). Whoever starts
// the core installs one; the core itself never names Electron or the terminal.
import { plainCipher } from '../core/secrets'
import { electronHost } from './electron'
import type { Host } from './types'

let impl: Host | undefined

export const setHost = (h: Host): void => {
  impl = h
}

// The host installed by whoever started the core. Without one, process.parentPort
// exists only inside an Electron utility process, and that is the entire test;
// otherwise a bare `node` import of the core gets a host that accepts no ports
// and drops every request, so the core still loads.
export function getHost(): Host {
  if (impl) return impl
  if ('parentPort' in process) return (impl = electronHost())
  return (impl = { request: () => {}, onMessage: () => {}, onPort: () => {}, cipher: () => plainCipher })
}
