// TUIcano's binding of the application layer (spec §1.4): the same AppClient
// shape the GUI's store adapter implements, over a local port pair instead of
// Electron's preload bridge. Events are buffered until the store subscribes, so
// the first `settings` event — which the core emits while starting — is not lost.
import type { AppClient } from '../app/client'
import type { ClientPort } from '../host/types'
import type { CoreEvent, Method, Params, Request, Result, Wire } from '../shared/rpc'

let seq = 0
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
const buffered: CoreEvent[] = []
let sink: ((e: CoreEvent) => void) | undefined
let port: ClientPort | undefined
let viewing: string | null = null

export function attachPort(p: ClientPort): void {
  port = p
  p.on('message', (e) => {
    const data = e.data as Wire | undefined
    if (!data) return
    if ('event' in data) {
      if (sink) sink(data.event)
      else buffered.push(data.event)
      return
    }
    const waiting = pending.get(data.id)
    if (!waiting) return
    pending.delete(data.id)
    if (data.error !== undefined) waiting.reject(new Error(data.error))
    else waiting.resolve(data.result)
  })
  p.start()
}

export const client: AppClient = {
  call<M extends Method>(method: M, ...params: Params<M> extends undefined ? [] : [Params<M>]): Promise<Result<M>> {
    if (!port) return Promise.reject(new Error('the core is not connected'))
    const id = ++seq
    const req: Request = { id, method, params: params[0] }
    return new Promise<Result<M>>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      port!.postMessage(req)
    })
  },
  // The port is already attached by the time the store starts, so this only takes
  // the handler and drains what arrived while the core was booting.
  connect(onEvent: (e: CoreEvent) => void): Promise<void> {
    sink = onEvent
    for (const e of buffered.splice(0)) onEvent(e)
    return Promise.resolve()
  },
  // Nothing can click a notification in a terminal.
  onNavigate: () => {},
  // The core asks this to stay quiet about the conversation already on screen.
  viewing: (id) => {
    viewing = id
  },
  // No folder picker: lendFolder takes a typed path instead (spec §2.5).
}

export const viewingNow = (): string | null => viewing
