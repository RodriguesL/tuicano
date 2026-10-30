// What a renderer gives the application layer: the core's API, and the few
// host-level things only a renderer has (spec §1). The GUI wires these to
// rpc.ts and the preload bridge; TUIcano wires them to its own socket and keys.
import type { CoreEvent, Method, Params, Result } from '../shared/rpc'

export interface AppClient {
  call<M extends Method>(method: M, ...params: Params<M> extends undefined ? [] : [Params<M>]): Promise<Result<M>>
  // Resolves once the core is connected; its events flow to onEvent from then on.
  connect(onEvent: (e: CoreEvent) => void): Promise<void>
  // A notification the person clicked, or the conversation to open on launch.
  onNavigate(cb: (conversationId: string) => void): void
  // The conversation on screen, so the host can stay quiet about it.
  viewing(conversationId: string | null): void
  // A folder picker; undefined when the renderer has none (TUIcano: typed path).
  pickFolder?(): Promise<string | null>
}
