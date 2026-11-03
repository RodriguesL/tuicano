#!/usr/bin/env node
// The TUIcano herdr bridge (docs/spec-tuicano.md §5, P6).
//
// herdr owns the layout, the keys and the events; TUIcano owns the core. This file is
// the whole seam between them and it is deliberately thin:
//
//   * it NEVER spawns, owns or supervises the daemon. Every call to the core goes
//     through `tuicano --no-spawn`, so a plugin pane can never leave a second core
//     running against the same data folder. If nothing is listening, it says what to
//     run and stops.
//   * it holds no background process of its own. Every action, every event hook and
//     the installer's build step is a one-shot process that exits; the only long-lived
//     thing it starts is a PANE, which dies with its pane because herdr owns it.
//   * it never writes outside its own state dir (HERDR_PLUGIN_STATE_DIR) and the core.
//
// Read `herdr-plugin/README.md` for how it is linked, and the plugin manifest next to
// this file for the primitives it exposes.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PLUGIN_ROOT = process.env['HERDR_PLUGIN_ROOT'] ?? dirname(HERE)
const REPO = dirname(PLUGIN_ROOT)
const HERDR = process.env['HERDR_BIN_PATH'] ?? 'herdr'

/** The client this plugin drives: the checkout's build, or an installed `tuicano`. */
export function clientPath(env = process.env) {
  if (env['TUICANO_BIN']) return env['TUICANO_BIN']
  const built = join(REPO, 'out', 'tuicano', 'index.js')
  return existsSync(built) ? built : 'tuicano'
}

export const stateDir = (env = process.env) => env['HERDR_PLUGIN_STATE_DIR'] ?? join(homedir(), '.local', 'state', 'tuicano-herdr')

export function readState(env = process.env) {
  try {
    const raw = JSON.parse(readFileSync(join(stateDir(env), 'state.json'), 'utf8'))
    return { lastConversation: undefined, lends: [], panes: {}, ...raw }
  } catch {
    return { lastConversation: undefined, lends: [], panes: {} }
  }
}

export function writeState(next, env = process.env) {
  mkdirSync(stateDir(env), { recursive: true })
  writeFileSync(join(stateDir(env), 'state.json'), `${JSON.stringify(next, null, 2)}\n`)
  return next
}

/**
 * HERDR_PLUGIN_CONTEXT_JSON, read leniently. Its exact shape is herdr's business and
 * it may grow fields; the ones this bridge needs are picked by name from wherever
 * they appear, and the raw context is kept in the state so a wrong guess is visible
 * instead of silent.
 */
export function contextOf(env = process.env) {
  let raw
  try {
    raw = JSON.parse(env['HERDR_PLUGIN_CONTEXT_JSON'] ?? '{}')
  } catch {
    raw = {}
  }
  const flat = []
  const walk = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 4) return
    for (const [k, v] of Object.entries(node)) {
      flat.push([k.toLowerCase(), v])
      if (v && typeof v === 'object') walk(v, depth + 1)
    }
  }
  walk(raw)
  const pick = (...keys) => {
    const hit = flat.find(([k, v]) => keys.includes(k) && typeof v === 'string' && v.trim())
    return hit?.[1]
  }
  return {
    raw,
    text: pick('selected_text', 'selectedtext', 'selection', 'selected'),
    url: pick('url', 'link', 'clicked_url', 'clickedurl', 'uri'),
    cwd: pick('cwd', 'foreground_cwd', 'foregroundcwd', 'path', 'worktree', 'worktree_path'),
    agent: pick('agent', 'agent_name', 'agentname', 'agent_kind'),
    tabId: pick('tab_id', 'tabid') ?? env['HERDR_TAB_ID'],
    workspaceId: pick('workspace_id', 'workspaceid') ?? env['HERDR_WORKSPACE_ID'],
    paneId: pick('pane_id', 'paneid') ?? env['HERDR_PANE_ID'],
    event: env['HERDR_PLUGIN_EVENT']
  }
}

/** A `tucano://` link, which is what an artifact an agent showed looks like. */
export function linkOf(url) {
  const m = /^tucano:\/\/artifact\/([0-9a-fA-F-]{36})(?:\/(.*))?$/.exec(url ?? '')
  if (m) return { kind: 'artifact', id: m[1], name: decodeURIComponent(m[2] ?? '') }
  const a = /^tucano:\/\/agent\/([^/]+)$/.exec(url ?? '')
  if (a) return { kind: 'agent', id: decodeURIComponent(a[1]) }
  return undefined
}

/** Every call to the core: one shot, never a daemon of our own. */
export function core(args, env = process.env) {
  const bin = clientPath(env)
  const use = isAbsolute(bin) ? process.execPath : bin
  const argv = isAbsolute(bin) ? [bin, ...args] : args
  const out = spawnSync(use, argv, { encoding: 'utf8', env, timeout: 30_000 })
  return { ok: out.status === 0, stdout: (out.stdout ?? '').trim(), stderr: (out.stderr ?? '').trim(), status: out.status }
}

/** A core call that only reads: it must not start a daemon (the ownership rule). */
export const read = (args, env) => core([...args, '--no-spawn'], env)

export function snapshot(env = process.env) {
  const r = read(['cli', 'snapshot'], env)
  if (!r.ok) return { error: r.stderr || r.stdout || 'the core did not answer' }
  try {
    return JSON.parse(r.stdout)
  } catch {
    return { error: 'the core answered with something that is not a snapshot' }
  }
}

const notify = (title, body, env = process.env, sound = 'none') => {
  try {
    execFileSync(HERDR, ['notification', 'show', title, '--body', body, '--sound', sound], { stdio: 'ignore', env })
  } catch {
    process.stdout.write(`${title}: ${body}\n`)
  }
}

/** No daemon, no plugin: say the command once, clearly, and stop. */
export function noDaemon(env = process.env) {
  const dir = env['TUCANO_DATA'] ?? '(the app’s own folder)'
  notify('TUIcano', `no core is listening on ${dir}. Start one: tuicano daemon`, env)
  process.exitCode = 1
}

/**
 * Which graphics protocol a pane should be told to use, and why it has to be told: a
 * herdr pane reports TERM_PROGRAM=herdr, so auto-detection there can only ever answer
 * text (spec §4.6). kitty is the protocol herdr relays through a pane's own output, so
 * it is the default; set TUICANO_GRAPHICS=none if the terminal outside herdr cannot
 * draw it, or iterm2 / sixel for a bare terminal.
 */
export const graphics = (env = process.env) => env['TUICANO_GRAPHICS'] ?? 'kitty'

/** The client, as the foreground process of a pane: it lives exactly as long as the pane. */
function runClient(args, env = process.env) {
  const bin = clientPath(env)
  const use = isAbsolute(bin) ? process.execPath : bin
  const argv = isAbsolute(bin) ? [bin, ...args] : args
  const r = spawnSync(use, argv, { stdio: 'inherit', env })
  if (r.error) {
    process.stderr.write(`TUIcano could not start: ${r.error.message}\n`)
    process.exitCode = 1
  }
}

const pane = (entrypoint, args, env = process.env) => {
  try {
    const out = execFileSync(HERDR, ['plugin', 'pane', 'open', '--plugin', 'tuicano', '--entrypoint', entrypoint, ...args], { encoding: 'utf8', env })
    return out.trim()
  } catch (e) {
    notify('TUIcano', `could not open a pane: ${e instanceof Error ? e.message : String(e)}`, env)
    return undefined
  }
}

/** The conversation to work on: what was asked, else the last one, else the first channel. */
export function planConversation(snap, spec, state) {
  const name = (spec ?? '').replace(/^#/, '')
  if (name) {
    const hit = snap.conversations.find((c) => c.id === spec || (c.kind === 'channel' && c.name === name))
    if (hit) return hit
  }
  const last = state.lastConversation && snap.conversations.find((c) => c.id === state.lastConversation.id)
  if (last) return last
  return snap.conversations.find((c) => c.kind === 'channel') ?? snap.conversations[0]
}

export const titleOf = (snap, c) => (c.kind === 'channel' ? `#${c.name}` : (snap.agents.find((a) => a.id === c.name)?.name ?? 'DM'))

/** An agent by handle, name or id; the plugin can also be configured with a default. */
export function agentOf(snap, spec) {
  if (!spec) return undefined
  const want = spec.replace(/^@/, '').toLowerCase()
  return snap.agents.find((a) => a.handle.toLowerCase() === want || a.name.toLowerCase() === want || a.id === spec)
}

function ensureBuilt(env = process.env) {
  const built = join(REPO, 'out', 'tuicano', 'index.js')
  if (existsSync(built)) return process.stdout.write(`TUIcano is built: ${built}\n`)
  process.stdout.write('TUIcano is not built yet; building (npm run build:tui)\n')
  const out = spawnSync('npm', ['run', 'build:tui'], { cwd: REPO, encoding: 'utf8', env, timeout: 300_000 })
  process.stdout.write(out.stdout ?? '')
  if (out.status !== 0) {
    process.stderr.write(out.stderr ?? '')
    process.exitCode = 1
  }
}

// ---------- the commands the manifest names ----------

function commandChannel(spec, env = process.env) {
  const snap = snapshot(env)
  if (snap.error) return noDaemon(env)
  const state = readState(env)
  const conversation = planConversation(snap, spec, state)
  if (!conversation) {
    notify('TUIcano', 'there is nothing to open yet: no channels', env)
    return
  }
  const cwd = contextOf(env).cwd
  const args = ['--placement', 'split', '--direction', 'right', '--env', `TUICANO_OPEN=${conversation.id}`, '--no-focus']
  if (cwd) args.push('--cwd', cwd)
  const opened = pane('channel', args, env)
  // The DM the plugin acts on next is the one it just opened.
  writeState({ ...state, lastConversation: { id: conversation.id, name: titleOf(snap, conversation) } }, env)
  notify('TUIcano', `${titleOf(snap, conversation)}${opened ? '' : ' (the pane did not open)'}`, env)
}

async function commandChannels(env) {
  const snap = snapshot(env)
  if (snap.error) return noDaemon(env)
  const list = snap.conversations
  if (!list.length) {
    notify('TUIcano', 'there is nothing to open yet: no channels', env)
    return
  }
  process.stdout.write('Open which conversation?\n')
  list.forEach((c, i) => process.stdout.write(`  ${String(i + 1).padStart(2)}  ${titleOf(snap, c)}${c.unread ? `  (${c.unread} new)` : ''}\n`))
  process.stdout.write('> ')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise((resolve) => rl.question('', resolve))
  rl.close()
  const pick = list[Number(answer.trim()) - 1] ?? list.find((c) => titleOf(snap, c).toLowerCase() === answer.trim().replace(/^#/, '').toLowerCase())
  if (!pick) return void process.stdout.write('nothing matched\n')
  const state = readState(env)
  writeState({ ...state, lastConversation: { id: pick.id, name: titleOf(snap, pick) } }, env)
  execFileSync(HERDR, ['plugin', 'pane', 'open', '--plugin', 'tuicano', '--entrypoint', 'channel', '--placement', 'split', '--direction', 'right', '--env', `TUICANO_OPEN=${pick.id}`], { stdio: 'inherit', env })
}

function commandApprovals(env) {
  const snap = snapshot(env)
  if (snap.error) return noDaemon(env)
  const pending = snap.approvals.filter((a) => a.state === 'pending')
  if (!pending.length) {
    notify('TUIcano', 'nothing is waiting for a decision', env)
    return
  }
  // A popup: session-modal, takes all input including Escape, no pane id, no lifecycle
  // events — which is exactly what an approval card wants.
  pane('approvals', ['--placement', 'popup', '--width', '66%', '--height', '50%', '--focus'], env)
}

function commandStatus(env) {
  const snap = snapshot(env)
  if (snap.error) return noDaemon(env)
  const pending = snap.approvals.filter((a) => a.state === 'pending').length
  const unread = snap.conversations.reduce((n, c) => n + (c.unread ?? 0), 0)
  const working = snap.messages.filter((m) => m.run?.status === 'working').length
  const parts = [`${pending} approval${pending === 1 ? '' : 's'}`, `${unread} unread`, `${working} working`, snap.settings.paused ? 'paused' : 'running']
  const body = parts.join(' · ')
  notify('TUIcano', body, env, pending ? 'request' : 'none')
  process.stdout.write(`${body}\n`)
}

function commandAsk(env) {
  const ctx = contextOf(env)
  const snap = snapshot(env)
  if (snap.error) return noDaemon(env)
  const state = readState(env)
  const text = ctx.text ?? process.env['TUICANO_ASK'] ?? process.argv.slice(3).join(' ').trim()
  if (!text) {
    notify('TUIcano', 'select some text in the pane first (or pass it as an argument)', env)
    return
  }
  const conversation = planConversation(snap, process.env['TUICANO_TO'], state)
  if (!conversation) {
    notify('TUIcano', 'no conversation to ask in', env)
    return
  }
  const r = read(['send', text, '--to', conversation.id, '--json'], env)
  notify('TUIcano', r.ok ? `asked in ${titleOf(snap, conversation)}` : `could not ask: ${r.stderr || r.stdout}`, env)
}

function commandLend(env) {
  const ctx = contextOf(env)
  const snap = snapshot(env)
  if (snap.error) return noDaemon(env)
  const state = readState(env)
  const agent = agentOf(snap, process.env['TUICANO_AGENT']) ?? (state.lastAgent ? agentOf(snap, state.lastAgent) : undefined)
  if (!agent) {
    notify('TUIcano', 'which agent? set TUICANO_AGENT=<handle> in the plugin config, or bind the action with it', env)
    return
  }
  const path = ctx.cwd
  if (!path || !isAbsolute(path)) {
    notify('TUIcano', 'this pane does not say which folder it is in', env)
    return
  }
  const r = core(['cli', 'lendFolder', JSON.stringify({ agentId: agent.id, path }), '--no-spawn'], env)
  if (!r.ok) {
    notify('TUIcano', `could not lend ${path}: ${r.stderr || r.stdout}`, env)
    return
  }
  // Recorded so `tab.closed` / `workspace.closed` can give it back.
  writeState(
    {
      ...state,
      lastAgent: agent.handle,
      lends: [...state.lends.filter((l) => !(l.tabId === ctx.tabId && l.path === path)), { tabId: ctx.tabId, workspaceId: ctx.workspaceId, agentId: agent.id, handle: agent.handle, path, name: path.split('/').pop() }]
    },
    env
  )
  notify('TUIcano', `lent ${path} to ${agent.name}`, env)
}

function commandOpenLink(env) {
  const ctx = contextOf(env)
  const link = linkOf(ctx.url)
  if (!link) {
    notify('TUIcano', `nothing to open for ${ctx.url ?? 'that link'}`, env)
    return
  }
  const snap = snapshot(env)
  if (snap.error) return noDaemon(env)
  // An artifact lives in the conversation that showed it: open *that*, so the pane has
  // the card and the file in front of it. An agent link opens its DM, which the core
  // creates if the agent has none yet (`openDm` is what the sidebar's agent rows use).
  let conversationId = link.kind === 'artifact' ? snap.artifacts.find((a) => a.id === link.id)?.conversationId : snap.conversations.find((c) => c.kind === 'dm' && c.name === link.id)?.id
  if (!conversationId && link.kind === 'agent') {
    const opened = read(['cli', 'openDm', JSON.stringify({ agentId: link.id })], env)
    if (opened.ok) conversationId = JSON.parse(opened.stdout || 'null') ?? undefined
  }
  if (!conversationId) {
    notify('TUIcano', `that ${link.kind} is not in this team any more`, env)
    return
  }
  const conversation = snap.conversations.find((c) => c.id === conversationId)
  const state = readState(env)
  writeState({ ...state, lastConversation: { id: conversationId, name: conversation ? titleOf(snap, conversation) : 'DM' } }, env)
  pane('channel', ['--placement', 'split', '--direction', 'right', '--env', `TUICANO_OPEN=${conversationId}`, '--no-focus'], env)
}

function commandEvent(name, env) {
  const ctx = contextOf(env)
  const state = readState(env)
  if (name === 'pane.agent_detected' || name === 'worktree.created') {
    // Context to attach: which pane is in which worktree, and which agent is there.
    writeState({ ...state, panes: { ...state.panes, [ctx.paneId ?? 'unknown']: { agent: ctx.agent, cwd: ctx.cwd, worktree: ctx.cwd, at: Date.now() } } }, env)
    return
  }
  if (name === 'tab.closed' || name === 'workspace.closed') {
    const key = name === 'tab.closed' ? 'tabId' : 'workspaceId'
    const mine = state.lends.filter((l) => l[key] && l[key] === (key === 'tabId' ? ctx.tabId : ctx.workspaceId))
    for (const lend of mine) core(['cli', 'folderAction', JSON.stringify({ agentId: lend.agentId, name: lend.name, action: 'return' }), '--no-spawn'], env)
    writeState({ ...state, lends: state.lends.filter((l) => !mine.includes(l)) }, env)
    if (mine.length) notify('TUIcano', `${mine.length} folder${mine.length === 1 ? '' : 's'} back from ${name.startsWith('tab') ? 'the tab' : 'the workspace'}`, env)
    return
  }
  process.stderr.write(`bridge: no handler for event ${name}\n`)
}

/** Housekeeping herdr runs once, as a one-shot: prune lends whose tab is gone. */
function commandStartup(env) {
  const state = readState(env)
  const stale = state.lends.filter((l) => Date.now() - (l.at ?? 0) > 7 * 86_400_000)
  if (!stale.length) return
  writeState({ ...state, lends: state.lends.filter((l) => !stale.includes(l)) }, env)
  process.stdout.write(`bridge: pruned ${stale.length} stale lend(s)\n`)
}

/** The channel pane: the client, already looking at TUICANO_OPEN. */
function commandPane(env) {
  const open = env['TUICANO_OPEN']
  runClient(['--open', open ?? '', `--graphics=${graphics(env)}`], env)
}

/**
 * The approval card, as a popup. It decides one thing and goes away (the client exits
 * on a decision, or on Escape); with nothing waiting it does not open at all, so a
 * keybind never leaves an empty modal on the screen.
 */
function commandPaneApprovals(env) {
  const snap = snapshot(env)
  if (snap.error) {
    process.stdout.write('nothing is waiting for a decision (no core is listening)\n')
    return
  }
  if (!snap.approvals.some((a) => a.state === 'pending')) {
    process.stdout.write('nothing is waiting for a decision\n')
    return
  }
  runClient(['--open', 'approvals', '--popup', `--graphics=${graphics(env)}`], env)
}

function usage() {
  process.stdout.write(
    [
      'the TUIcano herdr bridge (docs/spec-tuicano.md §5)',
      '',
      '  build                 make sure the client is built (herdr runs it at link/install)',
      '  startup               one-shot housekeeping (prune stale lends)',
      '  pane                  the client as a pane (TUICANO_OPEN, TUICANO_GRAPHICS)',
      '  pane-approvals        the approval card, as a popup',
      '  channel [spec]        open a split pane on a conversation',
      '  channels              the popup chooser, then the split pane',
      '  approvals             the approval card, as a popup pane',
      '  status                notify a one-line status',
      '  ask [text]            send the pane’s selected text to the last conversation',
      '  lend                  lend the pane’s folder to an agent (TUICANO_AGENT=<handle>)',
      '  open-link             a clicked tucano:// link, routed here instead of a browser',
      '  event <name>          what herdr tells the plugin',
      '  state                 print the plugin’s state (debugging)',
      ''
    ].join('\n')
  )
}

async function main(argv) {
  const [command, ...rest] = argv
  // Every command gets the environment explicitly: a call site that forgets it is a
  // crash in a pane nobody is watching (which is how the pane entrypoint shipped a
  // TypeError for one draft).
  const env = process.env
  switch (command) {
    case 'build':
      return ensureBuilt(env)
    case 'startup':
      return commandStartup(env)
    case 'pane':
      return commandPane(env)
    case 'pane-approvals':
      return commandPaneApprovals(env)
    case 'channel':
      return commandChannel(rest.join(' ') || undefined, env)
    case 'channels':
      return commandChannels(env)
    case 'approvals':
      return commandApprovals(env)
    case 'status':
      return commandStatus(env)
    case 'ask':
      return commandAsk(env)
    case 'lend':
      return commandLend(env)
    case 'open-link':
      return commandOpenLink(env)
    case 'event':
      return commandEvent(rest[0] ?? env['HERDR_PLUGIN_EVENT'] ?? '', env)
    case 'state':
      return void process.stdout.write(`${JSON.stringify(readState(), null, 2)}\n`)
    default:
      return usage()
  }
}

// Only when run, never when imported by a test.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`bridge: ${e instanceof Error ? e.stack : String(e)}\n`)
    process.exitCode = 1
  })
}
