// The two call-and-reply requests (screenshot, browser op) share one shape, so
// both hosts stay small: ask, wait for the matching reply, give up after 60 s.
import { randomUUID } from 'node:crypto'
import { L } from '../shared/lang'
import type { BrowserOp, BrowserReply } from '../shared/types'
import type { Host } from './types'

const TIMEOUT_MS = 60_000

type Pending<T> = { resolve: (v: T) => void; reject: (e: Error) => void }

// One pending map and one subscriber per kind: a subscriber per call would leak
// listeners, and a shared subscriber would let one ask steal another's reply.
const shots = new Map<string, Pending<Buffer>>()
const pages = new Map<string, Pending<BrowserReply>>()
let shotsBound = false
let pagesBound = false

function bindShots(host: Host): void {
  if (shotsBound) return
  shotsBound = true
  host.onMessage((msg) => {
    if (msg.type !== 'screenshot-result') return
    const p = shots.get(msg.id)
    if (!p) return
    shots.delete(msg.id)
    if (msg.error !== undefined) p.reject(new Error(msg.error))
    else p.resolve(Buffer.from(String(msg.data ?? ''), 'base64'))
  })
}

function bindPages(host: Host): void {
  if (pagesBound) return
  pagesBound = true
  host.onMessage((msg) => {
    if (msg.type !== 'browser-result') return
    const p = pages.get(msg.id)
    if (!p) return
    pages.delete(msg.id)
    if (msg.error !== undefined) p.reject(new Error(msg.error))
    else p.resolve(msg.data as BrowserReply)
  })
}

export function askScreenshot(host: Host, opts: { url: string; width: number; height: number; fullPage: boolean }): Promise<Buffer> {
  bindShots(host)
  return new Promise((resolve, reject) => {
    const id = randomUUID()
    shots.set(id, { resolve, reject })
    // A host that never answers is a dead end: fail instead of hanging the caller.
    setTimeout(() => {
      if (shots.delete(id)) reject(new Error(L('a captura não respondeu em 60 s', "the screenshot didn't answer in 60 s")))
    }, TIMEOUT_MS).unref()
    host.request({ type: 'screenshot', id, ...opts })
  })
}

export function askBrowser(host: Host, agentId: string, op: BrowserOp, args?: Record<string, unknown>): Promise<BrowserReply> {
  bindPages(host)
  return new Promise((resolve, reject) => {
    const id = randomUUID()
    pages.set(id, { resolve, reject })
    setTimeout(() => {
      if (pages.delete(id)) reject(new Error(L('o navegador não respondeu em 60 s', "the browser didn't answer in 60 s")))
    }, TIMEOUT_MS).unref()
    host.request({ type: 'browser', id, agentId, op, args })
  })
}
