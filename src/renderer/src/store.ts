// The GUI's binding of the application layer: the core over rpc.ts, and the few
// window-level hooks this renderer has (spec §1). Everything else — state, the
// event reduce, selectors, actions — comes from src/app/store.ts, which also
// drives TUIcano.
import { useRef, useSyncExternalStore } from 'react'
import { createStore, shallowEqual, type State } from '../../app/store'
import { call, connect } from './rpc'

export * from '../../shared/types'
export type { View, Dialog, Panel, State } from '../../app/store'
export {
  agentById,
  modelById,
  pendingApprovals,
  computerOf,
  browserOf,
  pendingMemories,
  conversationTitle,
  conversationMessages,
  channelList,
  unreadTotal,
  slug,
  shallowEqual,
  applyEvent
} from '../../app/store'

const store = createStore({
  call,
  connect: (onEvent) => connect(onEvent),
  onNavigate: (cb) => window.tucano.onNavigate(cb),
  viewing: (id) => window.tucano.viewing(id),
  pickFolder: () => window.tucano.pickFolder()
})

// Every action the components, App.tsx and main.tsx reach for, straight off the
// one store instance; the names and signatures are unchanged from before.
export const {
  getState,
  start,
  navigate,
  updateSettings,
  refreshEngines,
  loginEngine,
  saveAgent,
  newAgentDraft,
  newChannel,
  createChannel,
  ensureTuca,
  createFromDraft,
  openTuca,
  settleDraft,
  openDm,
  setGrant,
  updateTool,
  addConnector,
  removeConnector,
  reconnectConnector,
  authorizeConnector,
  harnessMcps,
  importHarnessMcp,
  renameChannel,
  archiveAgent,
  setTopic,
  setChannelMembers,
  deleteConversation,
  markRead,
  sendMessage,
  stopRun,
  retryRun,
  continueRun,
  decideApproval,
  addMemory,
  editMemory,
  confirmMemory,
  decideMemory,
  forgetMemory,
  purgeMemory,
  editSummary,
  summarizeNow,
  patchAgent,
  openPanel,
  openDialog,
  setTab,
  computerAction,
  stopService,
  browserAction,
  openExternal,
  saveRoutine,
  setJevKey,
  engineModels,
  testEngine,
  saveSkill,
  localSkills,
  linkSkill,
  decideSkill,
  restoreSkill,
  archiveSkill,
  removeSkill,
  skillVersions,
  checkTrigger,
  setTelegramToken,
  unpairTelegram,
  setGithubToken,
  exportTeam,
  importTeam,
  backupNow,
  openBackups,
  loadReport,
  loadUsage,
  removeRoutine,
  runRoutine,
  dmWith,
  lendFolder,
  folderAction
} = store

// Selectors may build new arrays (filter/map); the snapshot is cached and kept
// referentially stable while the result is shallow-equal, so React doesn't loop.
export function useStore<T>(select: (s: State) => T): T {
  const cache = useRef<{ state: State; select: (s: State) => T; value: T } | null>(null)
  const getSnapshot = (): T => {
    const state = store.getState()
    const c = cache.current
    if (c && c.state === state && c.select === select) return c.value
    const next = select(state)
    const value = c && shallowEqual(c.value, next) ? c.value : next
    cache.current = { state, select, value }
    return value
  }
  return useSyncExternalStore(store.subscribe, getSnapshot)
}
