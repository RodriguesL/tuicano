// The application layer: state, the event reduce, selectors and actions, shared
// by every renderer — the Electron GUI (src/renderer) and the terminal client
// (TUIcano). Nothing here touches React or `window`; those live behind AppClient
// (spec §1), so the same store drives both.
import { L, setLang } from '../shared/lang'
import type { CoreEvent } from '../shared/rpc'
import {
  MODELS,
  modelInfo,
  type EngineId,
  type Agent,
  type Approval,
  type Artifact,
  type BrowserView,
  type ComputerInfo,
  type Connector,
  type ConnectorInput,
  type ConnectorTool,
  type HarnessMcp,
  type Conversation,
  type GrantLevel,
  type LocalSkill,
  type Memory,
  type MemoryScope,
  type Message,
  type Model,
  type Routine,
  type RoutineInput,
  type Settings,
  type Skill,
  type SkillInput,
  type SkillVersion,
  type Report,
  type UsageReport,
  type Trigger,
  type ImageUpload,
  type Os
} from '../shared/types'
import type { AppClient } from './client'

export * from '../shared/types'

export type View =
  | { kind: 'conversation'; id: string; message?: string } // `message`: scroll to it and flash it
  | { kind: 'agent'; id: string }
  | { kind: 'new-agent'; draft?: Agent; fromMessage?: string } // a draft from a Tuca card, to edit before creating
  | { kind: 'tuca'; from?: View } // the builder screen: a new agent with the Tuca; closing goes back to `from`
  | { kind: 'approvals' }
  | { kind: 'usage' }
  | { kind: 'connectors' }
  | { kind: 'memory' }
  | { kind: 'routines' }
  | { kind: 'skills' }
  | { kind: 'report' }
  | { kind: 'settings' }

export interface State {
  ready: boolean
  view: View | null
  me: { name: string; initials: string }
  settings: Settings
  models: Model[]
  agents: Agent[]
  connectors: Connector[]
  conversations: Conversation[]
  messages: Message[]
  approvals: Approval[]
  memories: Memory[]
  artifacts: Artifact[]
  computers: ComputerInfo[]
  browsers: BrowserView[]
  routines: Routine[]
  skills: Skill[]
  platform: Os
  packaged: boolean
  panel: Panel | null // the side panel next to a conversation
  dialog: Dialog | null // a small window: a channel's members, name or topic; archived agents; new channel; search
  tabs: Record<string, string> // the open tab of each page with tabs, kept while the app is open
  demoServer?: { command: string; args: string[] }
}

export type Dialog = { kind: 'members' | 'rename' | 'topic'; id: string } | { kind: 'archived' | 'new-channel' | 'search' }

export type Panel = { kind: 'artifact'; id: string } | { kind: 'service'; agentId: string; name: string } | { kind: 'browser'; agentId: string }

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || 'EU'

// One state per store instance, so a second renderer in the same process (tests,
// TUIcano and the GUI together) doesn't share the first one's fields.
const initialState = (): State => ({
  ready: false,
  view: null,
  me: { name: 'Eu', initials: 'EU' },
  settings: {
    workspaceName: '',
    context: '',
    engines: { claude: { installed: false, loggedIn: false }, codex: { installed: false, loggedIn: false }, opencode: { installed: false, loggedIn: false }, pi: { installed: false, loggedIn: false } },
    routerModel: 'haiku',
    memoryModel: 'haiku',
    memoryLearning: 'approve',
    defaultLimit: 2_000_000,
    approvalTtlHours: 24,
    theme: 'system',
    language: 'pt'
  },
  models: MODELS,
  agents: [],
  connectors: [],
  conversations: [],
  messages: [],
  approvals: [],
  memories: [],
  artifacts: [],
  computers: [],
  browsers: [],
  routines: [],
  skills: [],
  platform: 'mac',
  packaged: false,
  panel: null,
  dialog: null,
  tabs: {}
})

// ---------- store plumbing ----------

// Exported for the React adapter's useStore: selectors may build new arrays
// (filter/map); its snapshot cache keeps them referentially stable while the
// result is shallow-equal, so React doesn't loop.
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]

// ---------- core sync ----------

function withSettings(s: State, settings: Settings): State {
  setLang(settings.language)
  const name = settings.workspaceName || L('Eu', 'Me')
  return { ...s, settings, me: { name, initials: initials(name) } }
}

// A pure function of state, so any renderer can run the same reduce: the adapter
// wires it to the core's events and to its own subscriber list (spec §1).
export function applyEvent(s: State, e: CoreEvent): State {
  switch (e.type) {
    case 'message': {
      const known = s.messages.some((m) => m.id === e.message.id)
      const viewing = s.view?.kind === 'conversation' && s.view.id === e.message.conversationId
      const conversations =
        !known && !viewing && (e.message.author.kind === 'agent' || e.message.author.kind === 'routine')
          ? s.conversations.map((c) => (c.id === e.message.conversationId ? { ...c, unread: (c.unread ?? 0) + 1 } : c))
          : s.conversations
      return { ...s, conversations, messages: upsert(s.messages, e.message) }
    }
    case 'delta':
      return { ...s, messages: s.messages.map((m) => (m.id === e.id ? { ...m, text: m.text + e.text } : m)) }
    case 'agent':
      return { ...s, agents: upsert(s.agents, e.agent) }
    case 'conversation': {
      const prev = s.conversations.find((c) => c.id === e.conversation.id)
      return { ...s, conversations: upsert(s.conversations, { ...e.conversation, unread: prev?.unread }) }
    }
    case 'settings':
      return withSettings(s, e.settings)
    case 'connector':
      return { ...s, connectors: upsert(s.connectors, e.connector) }
    case 'connector_removed':
      return { ...s, connectors: s.connectors.filter((c) => c.id !== e.id) }
    case 'approval':
      return { ...s, approvals: upsert(s.approvals, e.approval) }
    case 'memory':
      return { ...s, memories: upsert(s.memories, e.memory) }
    case 'memory_removed':
      return { ...s, memories: s.memories.filter((m) => m.id !== e.id) }
    case 'artifact':
      return { ...s, artifacts: upsert(s.artifacts, e.artifact) }
    case 'computer': {
      const others = s.computers.filter((c) => c.agentId !== e.computer.agentId)
      return { ...s, computers: [...others, e.computer] }
    }
    case 'browser': {
      const others = s.browsers.filter((b) => b.agentId !== e.view.agentId)
      return { ...s, browsers: [...others, e.view] }
    }
    case 'routine':
      return { ...s, routines: upsert(s.routines, e.routine) }
    case 'conversation_removed': {
      const left = s.conversations.filter((c) => c.id !== e.id)
      const here = s.view?.kind === 'conversation' && s.view.id === e.id
      const first = left.find((c) => c.kind === 'channel') ?? left[0]
      return {
        ...s,
        conversations: left,
        messages: s.messages.filter((m) => m.conversationId !== e.id),
        view: here ? (first ? { kind: 'conversation', id: first.id } : { kind: 'new-agent' }) : s.view,
        panel: here ? null : s.panel
      }
    }
    case 'routine_removed':
      return { ...s, routines: s.routines.filter((r) => r.id !== e.id) }
    case 'skill':
      return { ...s, skills: upsert(s.skills, e.skill).sort((a, b) => a.name.localeCompare(b.name)) }
    case 'skill_removed':
      return { ...s, skills: s.skills.filter((k) => k.id !== e.id) }
  }
}

// ---------- selectors ----------

export const agentById = (s: State, id: string): Agent | undefined => s.agents.find((a) => a.id === id)
// Listed models, and the names a company gateway gives ("claude:lumen-claude-opus").
export const modelById = (s: State, id: string): Model | undefined => s.models.find((m) => m.id === id) ?? modelInfo(id)
export const pendingApprovals = (s: State): Approval[] => s.approvals.filter((a) => a.state === 'pending')
export const computerOf = (s: State, agentId: string): ComputerInfo | undefined => s.computers.find((c) => c.agentId === agentId)
export const browserOf = (s: State, agentId: string): BrowserView | undefined => s.browsers.find((b) => b.agentId === agentId)
export const pendingMemories = (s: State): Memory[] => s.memories.filter((m) => m.state === 'pending')

export function conversationTitle(s: State, c: Conversation): string {
  if (c.kind === 'channel') return c.name
  return agentById(s, c.name)?.name ?? L('Agente', 'Agent')
}

// That conversation's messages, in the order the store holds them.
export const conversationMessages = (s: State, conversationId: string): Message[] => s.messages.filter((m) => m.conversationId === conversationId)

// The sidebar's order: channels by name, then DMs by their title, archived
// agents' DMs left out. Shared by the GUI and TUIcano.
export const channelList = (s: State): Conversation[] => {
  const channels = s.conversations.filter((c) => c.kind === 'channel').sort((a, b) => a.name.localeCompare(b.name))
  const dms = s.conversations
    .filter((c) => c.kind === 'dm' && !agentById(s, c.name)?.archived)
    .sort((a, b) => conversationTitle(s, a).localeCompare(conversationTitle(s, b)))
  return [...channels, ...dms]
}

// The sum of `unread` over conversations.
export const unreadTotal = (s: State): number => s.conversations.reduce((n, c) => n + (c.unread ?? 0), 0)

// A @handle from a name: "Lúcia M." → "luciam". Pure, so it lives here for both renderers.
export const slug = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32)

// ---------- actions ----------

export function createStore(client: AppClient) {
  const listeners = new Set<() => void>()
  let state: State = initialState()

  function set(update: (s: State) => State): void {
    state = update(state)
    listeners.forEach((l) => l())
  }

  const subscribe = (l: () => void): (() => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }

  const getState = (): State => state
  const dispatch = (event: CoreEvent): void => set((s) => applyEvent(s, event))

  const navigate = (view: View): void =>
    set((s) => ({
      ...s,
      view,
      panel: s.view?.kind === view.kind && JSON.stringify(s.view) === JSON.stringify(view) ? s.panel : null,
      conversations:
        view.kind === 'conversation' ? s.conversations.map((c) => (c.id === view.id ? { ...c, unread: 0 } : c)) : s.conversations
    }))

  function updateSettings(patch: Partial<Omit<Settings, 'engines'>>): void {
    set((s) => withSettings(s, { ...s.settings, ...patch })) // optimistic, so typing stays instant
    void client.call('updateSettings', { patch })
  }

  const refreshEngines = (): void => void client.call('refreshEngines')
  const loginEngine = (engine: keyof Settings['engines']): Promise<{ opened: boolean; command: string }> => client.call('loginEngine', { engine })

  function saveAgent(agent: Agent, channelIds: string[]): Promise<void> {
    return client.call('saveAgent', { agent, channelIds })
  }

  function newAgentDraft(): Agent {
    return {
      id: crypto.randomUUID(),
      name: '',
      handle: '',
      role: '',
      color: 'teal',
      instructions: '',
      modelId: 'sonnet',
      effort: 'medium',
      limit: state.settings.defaultLimit,
      used: 0,
      grants: {},
      memory: 'auto',
      computer: false,
      archived: false
    }
  }

  // Creates a channel and stays where it is (the caller decides where to go).
  const newChannel = (name: string): Promise<string> => client.call('createChannel', { name })

  // A new channel opens with the window to pick who's in it.
  async function createChannel(name: string): Promise<void> {
    const id = await client.call('createChannel', { name })
    navigate({ kind: 'conversation', id })
    set((s) => ({ ...s, dialog: { kind: 'members', id } }))
  }

  // The Tuca and his DM, made if missing.
  const ensureTuca = (modelId?: string, fresh = false): Promise<{ agentId: string; conversationId: string }> => client.call('ensureTuca', { modelId, fresh })
  // The agent a Tuca card proposed, created with a DM of its own.
  const createFromDraft = (messageId: string): Promise<{ agentId: string; conversationId: string }> => client.call('createFromDraft', { messageId })
  // The builder screen, in place of the app; closing it comes back here.
  const openTuca = (): void => navigate({ kind: 'tuca', from: state.view?.kind === 'tuca' ? state.view.from : (state.view ?? undefined) })
  const settleDraft = (messageId: string, agentId?: string): void => void client.call('settleDraft', { messageId, agentId })

  async function openDm(agentId: string): Promise<void> {
    const id = await client.call('openDm', { agentId })
    navigate({ kind: 'conversation', id })
  }

  function setGrant(agentId: string, connectorId: string, level: GrantLevel): void {
    const agent = agentById(state, agentId)
    if (agent) patchAgent(agentId, { grants: { ...agent.grants, [connectorId]: level } })
  }

  const updateTool = (connectorId: string, name: string, patch: Partial<Pick<ConnectorTool, 'cls' | 'enabled' | 'highRisk'>>): void =>
    void client.call('updateTool', { connectorId, name, patch })

  const addConnector = (input: ConnectorInput): Promise<string> => client.call('addConnector', { input })
  const removeConnector = (id: string): void => void client.call('removeConnector', { id })
  const reconnectConnector = (id: string): void => void client.call('reconnectConnector', { id })
  const authorizeConnector = (id: string): void => void client.call('authorizeConnector', { id })
  const harnessMcps = (): Promise<HarnessMcp[]> => client.call('harnessMcps')
  const importHarnessMcp = (key: string): Promise<string> => client.call('importHarnessMcp', { key })

  const renameChannel = (id: string, name: string): Promise<void> => client.call('renameChannel', { id, name })
  const archiveAgent = (id: string, archived: boolean): Promise<void> => client.call('archiveAgent', { id, archived })
  const setTopic = (id: string, topic: string): Promise<void> => client.call('setTopic', { id, topic })
  const setChannelMembers = (id: string, agentIds: string[]): Promise<void> => client.call('setChannelMembers', { id, agentIds })
  const deleteConversation = (id: string): Promise<void> => client.call('deleteConversation', { id })
  const markRead = (id: string): void => set((s) => ({ ...s, conversations: s.conversations.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) }))

  const sendMessage = (conversationId: string, text: string, images: ImageUpload[] = []): void => {
    if (text.trim() || images.length) void client.call('sendMessage', { conversationId, text, ...(images.length ? { images } : {}) })
  }

  const stopRun = (messageId: string): void => void client.call('stopRun', { messageId })
  const retryRun = (messageId: string): void => void client.call('retryRun', { messageId })
  const continueRun = (messageId: string): void => void client.call('continueRun', { messageId })

  const decideApproval = (id: string, decision: 'approved' | 'refused', reason?: string, always?: boolean): void =>
    void client.call('decideApproval', { id, decision, reason, always })

  const addMemory = (scope: MemoryScope, text: string): void => void client.call('addMemory', { scope, text })
  const editMemory = (id: string, text: string): void => void client.call('editMemory', { id, text })
  const confirmMemory = (id: string): void => void client.call('confirmMemory', { id })
  const decideMemory = (id: string, accept: boolean): void => void client.call('decideMemory', { id, accept })
  const forgetMemory = (id: string, reason?: string): void => void client.call('forgetMemory', { id, reason })
  const purgeMemory = (id: string): void => void client.call('purgeMemory', { id })
  const editSummary = (conversationId: string, text: string): void => void client.call('editSummary', { conversationId, text })
  const summarizeNow = (conversationId: string): void => void client.call('summarizeNow', { conversationId })

  // Saves one field of a stored agent without touching the rest of its page.
  function patchAgent(agentId: string, patch: Partial<Agent>): void {
    const agent = agentById(state, agentId)
    if (!agent) return
    const channelIds = state.conversations.filter((c) => c.kind === 'channel' && c.members.includes(agentId)).map((c) => c.id)
    void saveAgent({ ...agent, ...patch }, channelIds)
  }

  const openPanel = (panel: Panel | null): void => set((s) => ({ ...s, panel }))
  const openDialog = (dialog: Dialog | null): void => set((s) => ({ ...s, dialog }))
  const setTab = (page: string, tab: string): void => set((s) => ({ ...s, tabs: { ...s.tabs, [page]: tab } }))
  const computerAction = (agentId: string, action: 'start' | 'restart' | 'erase' | 'open_folder' | 'refresh'): void =>
    void client.call('computerAction', { agentId, action })
  const stopService = (agentId: string, name: string): void => void client.call('stopService', { agentId, name })
  const browserAction = (agentId: string, action: 'show' | 'hide' | 'clear'): void => void client.call('browserAction', { agentId, action })
  const openExternal = (url: string): void => void client.call('openExternal', { url })

  const saveRoutine = (routine: RoutineInput): Promise<Routine> => client.call('saveRoutine', { routine })
  const setJevKey = (key: string | null): Promise<void> => client.call('setJevKey', { key })
  const engineModels = (engine: EngineId): Promise<{ models: string[]; error?: string }> => client.call('engineModels', { engine })
  const testEngine = (model: string): Promise<{ ok: boolean; message: string }> => client.call('testEngine', { model })
  const saveSkill = (skill: SkillInput): Promise<Skill> => client.call('saveSkill', { skill })
  const localSkills = (): Promise<LocalSkill[]> => client.call('localSkills')
  const linkSkill = (source: string, agents: string[] = []): Promise<Skill> => client.call('linkSkill', { source, agents })
  const decideSkill = (id: string, approve: boolean): void => void client.call('decideSkill', { id, approve })
  const restoreSkill = (skillId: string, versionId: number): void => void client.call('restoreSkill', { skillId, versionId })
  const archiveSkill = (id: string, archived: boolean): void => void client.call('archiveSkill', { id, archived })
  const removeSkill = (id: string): void => void client.call('removeSkill', { id })
  const skillVersions = (skillId: string): Promise<SkillVersion[]> => client.call('skillVersions', { skillId })
  const checkTrigger = (trigger: Trigger): Promise<string> => client.call('checkTrigger', { trigger })
  const setTelegramToken = (token: string | null): Promise<void> => client.call('setTelegramToken', { token })
  const unpairTelegram = (): void => void client.call('unpairTelegram')
  const setGithubToken = (token: string | null): Promise<void> => client.call('setGithubToken', { token })
  const exportTeam = (): Promise<string> => client.call('exportTeam')
  const importTeam = (text: string): Promise<string> => client.call('importTeam', { text })
  const backupNow = (): Promise<string> => client.call('backupNow')
  const openBackups = (): void => void client.call('openBackups')
  const loadReport = (week?: number): Promise<Report> => client.call('report', { week })
  const loadUsage = (): Promise<UsageReport> => client.call('usage')
  const removeRoutine = (id: string): void => void client.call('removeRoutine', { id })
  const runRoutine = (id: string): void => void client.call('runRoutine', { id })

  // The id of the DM with an agent, created if it doesn't exist yet, without opening it.
  const dmWith = (agentId: string): Promise<string> => client.call('openDm', { agentId })

  // Opens the host's folder picker; resolves with why it couldn't be lent, if so.
  async function lendFolder(agentId: string): Promise<string | null> {
    const path = (await client.pickFolder?.()) ?? null
    if (!path) return null
    try {
      await client.call('lendFolder', { agentId, path })
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }

  const folderAction = (agentId: string, name: string, action: 'read_only' | 'read_write' | 'return'): void => void client.call('folderAction', { agentId, name, action })

  // Connects to the core and loads the first snapshot, exactly as the GUI did:
  // hook navigation and viewing, then fill in the state and the first view.
  async function start(): Promise<void> {
    client.onNavigate((id) => navigate({ kind: 'conversation', id }))
    let viewing: string | null = null
    subscribe(() => {
      const id = state.view?.kind === 'conversation' ? state.view.id : null
      if (id !== viewing) client.viewing((viewing = id))
    })
    await client.connect(dispatch)
    const snap = await client.call('snapshot')
    set((s) => {
      const first = snap.conversations.find((c) => c.kind === 'channel') ?? snap.conversations[0]
      const view = s.view ?? (first ? { kind: 'conversation' as const, id: first.id } : { kind: 'new-agent' as const })
      return {
        ...withSettings(s, snap.settings),
        ready: true,
        view,
        agents: snap.agents,
        conversations: snap.conversations,
        messages: snap.messages,
        connectors: snap.connectors,
        approvals: snap.approvals,
        memories: snap.memories,
        artifacts: snap.artifacts,
        computers: snap.computers,
        browsers: snap.browsers,
        routines: snap.routines,
        skills: snap.skills,
        platform: snap.platform,
        packaged: snap.packaged,
        demoServer: snap.demoServer
      }
    })
  }

  return {
    getState,
    subscribe,
    dispatch,
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
  }
}
