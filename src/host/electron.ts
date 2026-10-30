// The app's host: an Electron utility process whose parent port already answers
// every request, plus the keychain cipher that only the main process can use.
import { randomUUID } from 'node:crypto'
import type { Cipher } from '../core/secrets'
import type { ClientPort, Host, HostReply } from './types'

type Reply = { type: 'secret-result'; id: string; data?: string; error?: string }

// Connector credentials are sealed by the OS keychain in the main process, over
// the same parent port: { type: 'secret', id, op, data } in, a secret-result out.
function mainCipher(port: Electron.ParentPort): Cipher {
  const pending = new Map<string, { resolve: (v: string) => void; reject: (e: Error) => void }>()
  port.on('message', (e) => {
    const r = e.data as Reply | undefined
    if (r?.type !== 'secret-result') return
    const p = pending.get(r.id)
    if (!p) return
    pending.delete(r.id)
    if (r.error !== undefined) p.reject(new Error(r.error))
    else p.resolve(r.data ?? '')
  })
  const ask = (op: 'encrypt' | 'decrypt', data: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const id = randomUUID()
      pending.set(id, { resolve, reject })
      port.postMessage({ type: 'secret', id, op, data })
    })
  return { encrypt: (s) => ask('encrypt', s), decrypt: (s) => ask('decrypt', s) }
}

export function electronHost(parentPort: Electron.ParentPort = process.parentPort): Host {
  return {
    request: (msg) => parentPort.postMessage(msg),
    onMessage: (cb) => parentPort.on('message', (e) => cb(e.data as HostReply)),
    onPort: (cb) =>
      parentPort.on('message', (e) => {
        const p = e.ports[0]
        if (p) cb(p as ClientPort)
      }),
    cipher: () => mainCipher(parentPort)
  }
}
