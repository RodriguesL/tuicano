// The pure-Node host, for TUIcano: one process, one data dir, no Electron. The
// core runs here as a plain module, so nothing can open a browser or screenshot.
import { spawn } from 'node:child_process'
import { MessageChannel, type MessagePort } from 'node:worker_threads'
import { setLang } from '../shared/lang'
import { plainCipher } from '../core/secrets'
import type { ClientPort, Host, HostReply, HostRequest } from './types'

// The OS opener, per platform: only the desktop can open a URL or a folder, and
// it may not be there at all.
function opener(): { bin: string; args: string[] } {
  if (process.platform === 'darwin') return { bin: 'open', args: [] }
  if (process.platform === 'win32') return { bin: process.env['ComSpec'] ?? 'cmd.exe', args: ['/c', 'start', ''] }
  return { bin: 'xdg-open', args: [] }
}

export function nodeHost(opts?: { onPort?: (cb: (port: ClientPort) => void) => void; onRequest?: (msg: HostRequest) => boolean }): Host {
  // Kept for the interface; nothing here pushes a message of its own (see below).
  let subscriber: ((msg: HostReply) => void) | undefined
  const open = (target: string): void => {
    const { bin, args } = opener()
    // Detached and silent: a missing opener is not the core's problem.
    try {
      spawn(bin, [...args, target], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref()
    } catch {
      // swallowed on purpose
    }
  }
  return {
    request: (msg) => {
      if (opts?.onRequest?.(msg)) return
      switch (msg.type) {
        case 'open':
          return open(msg.url)
        case 'open_path':
          return open(msg.path)
        // A bell: the terminal's own way of asking for attention.
        case 'notify':
          return void process.stderr.write('\x07')
        case 'lang':
          return setLang(msg.lang)
        // login_item, busy, screenshot and browser have no pure-Node answer; dropped.
        default:
          return
      }
    },
    // The host has no machine news of its own, so this never fires: askScreenshot
    // and askBrowser reject on their timeout instead of hanging forever.
    onMessage: (cb) => {
      subscriber = cb
    },
    // The core opens its client door through the host; hand that door to whoever
    // supplied the host, so they can feed it ports (we have none of our own).
    onPort: (cb) => opts?.onPort?.(cb),
    // ponytail: no OS keychain without Electron, so connector secrets are stored
    // unencrypted in the TUI host; swap in a keyring-backed cipher when it lands.
    cipher: () => plainCipher
  }
}

// node's MessagePort calls 'message' listeners with the value itself, not with
// { data } as Electron's MessagePortMain does. This wrapper is the only place
// that difference lives.
function wrap(port: MessagePort): ClientPort {
  return {
    postMessage: (msg) => port.postMessage(msg),
    on: (event: 'message' | 'close', cb: ((e: { data: unknown }) => void) | (() => void)) => {
      if (event === 'close') return port.on('close', cb as () => void)
      port.on('message', (value: unknown) => (cb as (e: { data: unknown }) => void)({ data: value }))
    },
    start: () => port.start()
  }
}

// A port pair for a client the host runs in its own process (TUIcano): the caller
// keeps one end and hands the other to the core through the door the host's
// onPort was given (nodeHost forwards it to opts.onPort).
export function localPortPair(host: Host): [ClientPort, ClientPort] {
  const { port1, port2 } = new MessageChannel()
  void host
  return [wrap(port1), wrap(port2)]
}
