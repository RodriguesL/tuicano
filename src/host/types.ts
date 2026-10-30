// What the core asks of the machine it runs on: the same messages the Electron
// main process already answers (spec §2). A host is the app's utility process,
// or the terminal the TUIcano client runs in.
import type { Lang } from '../shared/lang'
import type { BrowserOp, BrowserReply } from '../shared/types'
import type { Cipher } from '../core/secrets'

export type HostRequest =
  | { type: 'open'; url: string }
  | { type: 'open_path'; path: string }
  | { type: 'notify'; title: string; body: string; conversationId?: string; kind?: 'approval' | 'question' | 'done' }
  | { type: 'login_item'; open: boolean }
  | { type: 'busy'; busy: boolean }
  | { type: 'lang'; lang: Lang }
  | { type: 'screenshot'; id: string; url: string; width: number; height: number; fullPage: boolean }
  | { type: 'browser'; id: string; agentId: string; op: BrowserOp; args?: Record<string, unknown> }

export type HostReply =
  | { type: 'secret-result'; id: string; data?: string; error?: string }
  | { type: 'screenshot-result'; id: string; data?: string; error?: string }
  | { type: 'browser-result'; id: string; data?: BrowserReply; error?: string }
  | { type: 'browser-shown'; agentId: string; shown: boolean }
  | { type: 'power'; awake: boolean }

// A client of the core: the app's window, or TUIcano. Electron's MessagePortMain
// and a node MessagePort (wrapped, see node.ts) both fit.
export interface ClientPort {
  postMessage(msg: unknown): void
  on(event: 'message', cb: (e: { data: unknown }) => void): void
  on(event: 'close', cb: () => void): void
  start(): void
}

export interface Host {
  request(msg: HostRequest): void
  onMessage(cb: (msg: HostReply) => void): void
  onPort(cb: (port: ClientPort) => void): void
  cipher(): Cipher
}
