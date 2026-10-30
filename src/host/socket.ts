// A local socket transport for the core (spec §4): newline-delimited JSON over a
// Unix domain socket (a named pipe on Windows), so any number of clients attach
// to ONE core — the TUI in several panes, one-shot CLI calls from keybinds, and
// in principle a headless Electron app.
//
// Never a TCP port. A socket that can approve agent actions and run their tools
// is a local privilege boundary, so the file is user-only (0600) and every
// connection has to present the token the daemon wrote next to it. Be honest
// about the ceiling: a same-user process can read that token, and nothing local
// can stop it — the 0600 socket and the token keep out *other* users, and the
// token also survives a data dir whose permissions were loosened by a umask or
// a shared /tmp.
import { randomBytes } from 'node:crypto'
import { chmodSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { connect, createServer, type Server, type Socket } from 'node:net'
import { join } from 'node:path'
import { once } from 'node:events'
import type { ClientPort } from './types'

export const socketPath = (dataDir: string): string =>
  process.platform === 'win32' ? `\\\\.\\pipe\\tucano-${dataDir.replace(/[^a-zA-Z0-9]/g, '-')}` : join(dataDir, 'tuicano.sock')

export const tokenPath = (dataDir: string): string => join(dataDir, 'tuicano.token')

// One line per message, both directions: the wire in src/shared/rpc.ts does not
// change, only how it is carried.
const line = (msg: unknown): string => `${JSON.stringify(msg)}\n`

function portOf(sock: Socket): ClientPort {
  const messages: ((e: { data: unknown }) => void)[] = []
  const closes: (() => void)[] = []
  let buffer = ''
  sock.setEncoding('utf8')
  sock.on('data', (chunk: string) => {
    buffer += chunk
    for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
      const text = buffer.slice(0, at)
      buffer = buffer.slice(at + 1)
      if (!text.trim()) continue
      let msg: unknown
      try {
        msg = JSON.parse(text)
      } catch {
        continue // a broken line is the sender's problem, not the client's
      }
      for (const h of messages) h({ data: msg })
    }
  })
  sock.on('close', () => {
    for (const h of closes) h()
  })
  sock.on('error', () => sock.destroy())
  return {
    postMessage: (msg) => {
      if (!sock.destroyed) sock.write(line(msg))
    },
    on: (event: 'message' | 'close', cb: ((e: { data: unknown }) => void) | (() => void)) => {
      if (event === 'close') closes.push(cb as () => void)
      else messages.push(cb as (e: { data: unknown }) => void)
    },
    start: () => {}
  }
}

export interface SocketServer {
  path: string
  close(): void
}

// The daemon side: the socket, the token, and a port per client handed to the
// core's door. The token line must arrive before anything else.
export function serveClients(dataDir: string, onClient: (port: ClientPort) => void): SocketServer {
  const path = socketPath(dataDir)
  const token = randomBytes(32).toString('hex')
  writeFileSync(tokenPath(dataDir), token, { mode: 0o600 })
  // A token file that already existed keeps its old mode: make it user-only.
  try {
    chmodSync(tokenPath(dataDir), 0o600)
  } catch {
    // Windows: nothing to do, and the socket's own permissions are all there is.
  }
  rmSync(path, { force: true }) // a socket left behind by a daemon that was killed
  const server: Server = createServer((sock) => {
    let authed = false
    let buffer = ''
    sock.setEncoding('utf8')
    sock.on('data', (chunk: string) => {
      if (authed) return // from here on the port owns the stream
      buffer += chunk
      const at = buffer.indexOf('\n')
      if (at < 0) return
      const first = buffer.slice(0, at)
      buffer = buffer.slice(at + 1)
      let ok = false
      try {
        ok = (JSON.parse(first) as { token?: string }).token === token
      } catch {
        ok = false
      }
      if (!ok) return void sock.destroy()
      authed = true
      sock.removeAllListeners('data')
      const port = portOf(sock)
      onClient(port)
      // Whatever arrived on the same read as the token is the client's first
      // request, and it must not be lost.
      if (buffer) sock.emit('data', buffer)
    })
    sock.on('error', () => sock.destroy())
  })
  server.listen(path, () => {
    try {
      chmodSync(path, 0o600)
    } catch {
      // Windows named pipes have no mode; the token is what is left.
    }
  })
  server.on('error', (e) => console.error('[socket]', e.message))
  return {
    path,
    close: () => {
      server.close()
      rmSync(path, { force: true })
    }
  }
}

// The client side: whatever the renderer is, it gets a ClientPort and speaks the
// core's wire through it.
export async function connectClient(dataDir: string): Promise<ClientPort> {
  const token = readFileSync(tokenPath(dataDir), 'utf8').trim()
  const sock = connect(socketPath(dataDir))
  await once(sock, 'connect')
  sock.write(line({ token }))
  return portOf(sock)
}
