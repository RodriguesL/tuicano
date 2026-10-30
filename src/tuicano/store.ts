// The store the terminal renders from (spec §1.4): the application layer's one
// instance — the same reduce, selectors and actions the GUI uses — plus the
// subscription Ink needs.
import { useSyncExternalStore } from 'react'
import { createStore, type State } from '../app/store'
import { client } from './client'

export const store = createStore(client)

export { agentById, browserOf, channelList, conversationMessages, conversationTitle, pendingApprovals, unreadTotal } from '../app/store'
export type { State, View } from '../app/store'

// A streaming reply sends `delta` several times a second, and Ink redraws its
// whole frame on every commit. Notifications are coalesced to ~30 fps: the
// snapshot is read when the frame is drawn, so nothing is lost, only batched.
const FRAME_MS = 33
const listeners = new Set<() => void>()
let drawnAt = 0
let timer: NodeJS.Timeout | undefined

const draw = (): void => {
  drawnAt = Date.now()
  for (const l of listeners) l()
}

store.subscribe(() => {
  const wait = FRAME_MS - (Date.now() - drawnAt)
  if (wait <= 0) return draw()
  timer ??= setTimeout(() => {
    timer = undefined
    draw()
  }, wait)
})

export const useAppState = (): State =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    store.getState
  )
