// TUIcano's entry point (spec §1.4, §4). Four modes, one wire:
//   tuicano            the terminal client; attaches to the daemon
//   tuicano daemon     the core as its own process: the lock, the socket, no UI
//   tuicano send ...   one-shot: what a keybind or an event hook calls
//   tuicano approvals  one-shot: the gate, for a keybind
//
// The daemon owns the data folder, not the UI: several panes, one-shot commands
// and (in principle) a headless Electron app all attach to the same core.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { render } from 'ink'
import pkg from '../../package.json'
import { setHost } from '../host'
import { nodeHost } from '../host/node'
import { connectClient, serveClients } from '../host/socket'
import type { ClientPort } from '../host/types'
import type { Method, Params, Request, Result, Wire } from '../shared/rpc'
import { detectProtocol, parseGraphicsFlag } from './graphics/detect'
import { prepare, protocolLabel } from './graphics/transport'
import { probeCell } from './graphics/probe'
import { samplePng } from './graphics/sample'
import { acquireLock } from './lock'
import { hasTheme } from './theme'
import { readConfig } from './config'
import { resolveDataDir } from './paths'
import { opensNothing, resolveOpen } from './open'
import { runtime } from './runtime'
import { attachPort } from './client'
import { TuiApp } from './app'

const USAGE = `usage:
  tuicano [tui]                 the terminal client (starts a daemon if none is up)
  tuicano daemon                the core as its own process: lock, socket, no UI
  tuicano send <text>           send a message, starting a daemon if needed (--json)
  tuicano approvals [--json]    the approvals waiting for a decision (attach only)
  tuicano approvals approve|refuse|always <id> [reason]
  tuicano cli <method> [json]   any of the core's methods, one shot (attach only)
  tuicano --version | --graphics-info [--graphics=auto|kitty|iterm2|sixel|none]

  --data <dir>   the data folder (default: the app's own, see docs/spec-tuicano.md §4.7)
  --theme <name> a theme (Ctrl+T in the client lists them all)
  --open <what>  start looking at something: a screen name, a #channel, an @handle or an id
  --popup        go away once a decision is made (a herdr popup pane, spec §5)
  --start        let a one-shot start a daemon when nothing is listening
  --no-spawn     never start a daemon; say what to run instead
  --to <id|#channel>   which conversation send talks to`

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const flag = (argv: string[], name: string): string | undefined => {
  const at = argv.findIndex((a) => a === name || a.startsWith(`${name}=`))
  if (at < 0) return undefined
  return argv[at]!.includes('=') ? argv[at]!.slice(name.length + 1) : argv[at + 1]
}

// The words a command takes, with the flags and their values out of the way:
// `send 'hi there' --to #geral` is one message, not three words.
const positional = (argv: string[], withValue: string[]): string[] => {
  const out: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a.startsWith('--')) {
      if (!a.includes('=') && withValue.includes(a)) i++
      continue
    }
    out.push(a)
  }
  return out
}

const graphicsInfo = (override: string | undefined): void => {
  const picture = prepare(samplePng(32), 'image/png', runtime.protocol)
  const drawn = picture.escape(runtime.cell, { cols: Math.max(1, runtime.cell.cols - 1), rows: Math.max(1, runtime.cell.rows - 2) })
  const grid = `${runtime.cell.cols}x${runtime.cell.rows} cells of ${runtime.cell.pxW}x${runtime.cell.pxH}px`
  const placement = drawn ? `${drawn.placement.cols}x${drawn.placement.rows} cells at ${drawn.placement.pxW}x${drawn.placement.pxH}px` : 'none (text mode)'
  const hosted = process.env['HERDR_ENV'] === '1' || process.env['HERDR_SOCKET_PATH'] ? 'herdr' : process.env['TMUX'] ? 'tmux' : 'bare terminal'
  process.stderr.write(
    [
      `TUIcano ${runtime.version} — ${hosted}`,
      `protocol: ${protocolLabel(runtime.protocol)} ${override ? '(--graphics)' : '(detected)'}`,
      `terminal: TERM=${process.env['TERM'] ?? ''} TERM_PROGRAM=${process.env['TERM_PROGRAM'] ?? ''} tty=${process.stdout.isTTY === true}`,
      `grid: ${grid}`,
      `picture: 32x32 png -> ${placement}`,
      `data: ${runtime.dataDir}`,
      ''
    ].join('\n')
  )
  // The image goes to stdout: `tuicano --graphics-info > frame.bin` leaves exactly
  // the escape sequence a terminal would have received. This mode never blocks —
  // it reports and returns, and the probe above has already given the tty back.
  if (drawn) process.stdout.write(`${drawn.text}\n`)
  else process.stdout.write(`${picture.fallback()}\n`)
}

// ---------- the daemon ----------

async function runDaemon(dataDir: string): Promise<void> {
  mkdirSync(dataDir, { recursive: true })
  acquireLock(dataDir)
  // A clean start, like the app's: the sample team is a test affordance of the fake
  // engines (the core seeds when TUCANO_FAKE_ENGINES=1 and TUCANO_SEED is not '0'),
  // and a client must not greet a person with somebody else's channels. Ask for it
  // on purpose with TUCANO_SEED=1.
  if (process.env['TUCANO_SEED'] === undefined) process.env['TUCANO_SEED'] = '0'
  // stdout stays clean (spec §3): anything the core logs goes to stderr.
  console.log = (...a: unknown[]): void => console.error(...a)
  console.info = console.log
  let door: ((port: ClientPort) => void) | undefined
  const host = nodeHost({
    onPort: (cb) => {
      door = cb
    },
    // Terminal-native notifications: OSC 9 with a bell behind it, on stderr.
    onRequest: (msg) => {
      if (msg.type === 'notify') {
        process.stderr.write(`\x1b]9;${msg.title}: ${msg.body}\x07\x07`)
        return true
      }
      return false
    }
  })
  setHost(host)
  const server = serveClients(dataDir, (port) => door?.(port))
  // Side effects, immediately: SQLite, the harness detection, the MCP gateway.
  await import('../core/index')
  if (!door) throw new Error('the core never asked for its client door')
  process.stderr.write(`tuicano daemon ready: ${server.path} (pid ${process.pid})\n`)
  process.on('exit', () => server.close())
  process.on('SIGTERM', () => process.exit(0))
}

// ---------- the clients ----------

// A client never owns the lock: the daemon does. A mutating one-shot may start
// one when nothing is listening; a read-only one must not, or a keybind fired from
// an arbitrary directory would quietly grow a second team (spec §4.7).
async function openPort(dataDir: string, start: boolean): Promise<ClientPort> {
  try {
    return await connectClient(dataDir)
  } catch {
    if (!start)
      throw new Error(
        `no daemon is listening on ${dataDir}. Start one with: tuicano daemon (or pass --start to let this command do it)\nNothing was changed.`
      )
  }
  // The child gets the same folder this command resolved, flag and all.
  const child = spawn(process.execPath, [process.argv[1]!, 'daemon'], { detached: true, stdio: 'ignore', env: { ...process.env, TUCANO_DATA: dataDir } })
  child.unref()
  for (let i = 0; i < 80; i++) {
    await delay(100) // the core opens SQLite and looks for the harnesses first
    try {
      return await connectClient(dataDir)
    } catch {
      // keep waiting
    }
  }
  throw new Error('the daemon did not come up. Run `tuicano daemon` in a pane to see why')
}

// One request, one answer, exit: the whole point of a one-shot mode.
async function ask<M extends Method>(port: ClientPort, method: M, params?: Params<M>): Promise<Result<M>> {
  return new Promise<Result<M>>((resolve, reject) => {
    const id = 1
    port.on('message', (e) => {
      const msg = e.data as Wire
      if (!msg || 'event' in msg || msg.id !== id) return
      if (msg.error !== undefined) reject(new Error(msg.error))
      else resolve(msg.result as Result<M>)
    })
    const req: Request = { id, method, params }
    port.postMessage(req)
  })
}

async function withDaemon<T>(dataDir: string, spawnIt: boolean, fn: (port: ClientPort) => Promise<T>): Promise<T> {
  const port = await openPort(dataDir, spawnIt)
  return fn(port)
}

// A one-shot has to end: the client's socket is an open handle, so the process
// would sit there forever waiting for events nobody asked for.
const done = (): never => process.exit(0)

// The first channel, unless --to says otherwise: a keybind should not have to
// know an id, and `#name` is what a person sees in the sidebar.
async function resolveConversation(port: ClientPort, to: string | undefined): Promise<{ id: string; name: string }> {
  const snap = await ask(port, 'snapshot')
  const channels = snap.conversations.filter((c) => c.kind === 'channel')
  if (!to) {
    const first = channels[0] ?? snap.conversations[0]
    if (!first) throw new Error('there is no conversation to send to')
    return { id: first.id, name: first.kind === 'channel' ? `#${first.name}` : first.name }
  }
  const want = to.replace(/^#/, '')
  const found = snap.conversations.find((c) => c.id === to || (c.kind === 'channel' && c.name === want))
  if (!found) throw new Error(`no conversation matching ${to}`)
  return { id: found.id, name: found.kind === 'channel' ? `#${found.name}` : found.name }
}

async function runSend(argv: string[]): Promise<void> {
  const text = positional(argv, ['--to']).slice(1).join(' ')
  if (!text.trim()) throw new Error(`what should it say?\n${USAGE}`)
  const dataDir = runtime.dataDir
  await withDaemon(dataDir, !argv.includes('--no-spawn'), async (port) => {
    const conversation = await resolveConversation(port, flag(argv, '--to'))
    await ask(port, 'sendMessage', { conversationId: conversation.id, text })
    process.stdout.write(argv.includes('--json') ? `${JSON.stringify({ conversation: conversation.id, sent: text })}\n` : `sent to ${conversation.name}\n`)
  })
  done()
}

async function runApprovals(argv: string[]): Promise<void> {
  const [action, id, ...rest] = positional(argv, []).slice(1)
  const dataDir = runtime.dataDir
  // Attach only, unless --start: listing or deciding an approval with no core
  // running means something else is wrong, and starting one silently would hide it.
  await withDaemon(dataDir, argv.includes('--start'), async (port) => {
    if (action === 'approve' || action === 'refuse' || action === 'always') {
      if (!id) throw new Error(`which approval?\n${USAGE}`)
      const decision = action === 'refuse' ? 'refused' : 'approved'
      await ask(port, 'decideApproval', {
        id,
        decision,
        ...(action === 'refuse' && rest.length ? { reason: rest.join(' ') } : {}),
        ...(action === 'always' ? { always: true } : {})
      })
      process.stdout.write(`${decision}: ${id}\n`)
      return
    }
    const snap = await ask(port, 'snapshot')
    const pending = snap.approvals.filter((a) => a.state === 'pending')
    if (argv.includes('--json')) return void process.stdout.write(`${JSON.stringify(pending, null, 2)}\n`)
    if (!pending.length) return void process.stdout.write('nothing waiting for you\n')
    const name = (agentId: string): string => snap.agents.find((a) => a.id === agentId)?.name ?? 'agent'
    for (const a of pending) {
      process.stdout.write(`${a.id}  ${name(a.agentId)} wants ${a.tool} in ${a.connectorName}${a.highRisk ? ' (high risk)' : ''}\n`)
      if (a.why) process.stdout.write(`  ${a.why}\n`)
      process.stdout.write(`  args: ${JSON.stringify(a.args)}\n`)
    }
    process.stdout.write(`\ntuicano approvals approve <id> | refuse <id> [reason]\n`)
  })
  done()
}

// Every method the renderer can reach is reachable from a shell: the keybinds
// and hooks do not need a client of their own (spec §4).
async function runCli(argv: string[]): Promise<void> {
  const [method, raw] = positional(argv, []).slice(1)
  if (!method) throw new Error(`which method?\n${USAGE}`)
  const params = raw ? (JSON.parse(raw) as unknown) : undefined
  const dataDir = runtime.dataDir
  await withDaemon(dataDir, argv.includes('--start'), async (port) => {
    const result = await ask(port, method as Method, params as never)
    process.stdout.write(`${JSON.stringify(result ?? null)}\n`)
  })
  done()
}

// ---------- the client ----------

async function runTui(argv: string[]): Promise<void> {
  const port = await openPort(runtime.dataDir, !argv.includes('--no-spawn'))
  attachPort(port)
  // Imported late: the store binds the client, and the core is in the daemon, not
  // in this process (spec §4).
  const { store } = await import('./store')
  await store.start()
  // --open: what the pane is for (spec §5). Resolved against the snapshot, so a typo
  // says what it could have been instead of opening the default conversation.
  const opening = resolveOpen(store.getState(), runtime.open)
  if (opening?.kind === 'view') store.navigate(opening.view)
  else if (opening?.kind === 'dm') await store.openDm(opening.agentId)
  else if (runtime.open) process.stderr.write(`tuicano: ${opensNothing(runtime.open)}\n`)
  // The alternate screen keeps the pane's scrollback intact. `interactive` comes
  // from the tty, not it from Ink's CI heuristic, so a pane behaves predictably;
  // the kitty keyboard protocol is left off because the multiplexer owns those
  // keys (spec §3).
  // The alternate screen keeps the pane's scrollback intact. `interactive` comes
  // from the tty, not from Ink's CI heuristic, so a pane behaves predictably; the
  // kitty keyboard protocol is left off because the multiplexer owns those keys.
  // Full frames rather than diffs: a pane that resyncs, a scrollback read or a
  // screenshot then always has the whole picture, and it is what lets the screen
  // tour assert a frame per key (spec §5).
  render(<TuiApp />, { alternateScreen: process.stdout.isTTY === true, interactive: process.stdout.isTTY === true, incrementalRendering: false })
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const override = parseGraphicsFlag(argv)
  if (argv.some((a) => a.startsWith('--graphics')) && !override) throw new Error(`unknown --graphics value\n${USAGE}`)
  if (argv.includes('--help') || argv.includes('-h')) return void process.stdout.write(`${USAGE}\n`)
  runtime.version = pkg.version

  if (argv.includes('--version')) return void process.stdout.write(`tuicano ${runtime.version}\n`)

  // The command is the first word that is not a flag: `--no-spawn cli snapshot`
  // and `cli snapshot --no-spawn` mean the same thing.
  const [mode] = positional(argv, ['--graphics', '--to', '--data', '--theme', '--open'])
  const info = argv.includes('--graphics-info')
  const draws = mode === 'tui' || mode === undefined
  runtime.dataDir = resolveDataDir(argv)
  runtime.open = flag(argv, '--open')
  runtime.popup = argv.includes('--popup')
  // The client's own settings (spec §2.7): a flag beats the config file, and an
  // unknown theme name falls back to the default with a word about it.
  const cfg = readConfig(runtime.dataDir)
  const wanted = flag(argv, '--theme') ?? cfg.theme
  if (wanted && !hasTheme(wanted)) process.stderr.write(`tuicano: no theme named ${wanted}; using the default (Ctrl+T lists them)\n`)
  runtime.theme = wanted && hasTheme(wanted) ? wanted : undefined
  // Only the modes that draw ask the terminal how big a cell is: a one-shot command
  // must not write escape sequences into someone's pane (spec §3).
  if (draws || info) {
    runtime.protocol = detectProtocol({ override: override ?? cfg.graphics ?? 'auto', env: process.env })
    runtime.cell = await probeCell({ input: process.stdin, output: process.stdout })
  }

  if (info) return graphicsInfo(override)

  if (mode === 'daemon') return runDaemon(runtime.dataDir)
  if (mode === 'send') return runSend(argv)
  if (mode === 'approvals') return runApprovals(argv)
  if (mode === 'cli') return runCli(argv)
  if (draws) return runTui(argv)
  throw new Error(`unknown command ${mode}\n${USAGE}`)
}

// Every exit path leaves the terminal as it was found: a pane stuck on the
// alternate screen with a hidden cursor is worse than a client that crashed.
function restore(): void {
  if (process.stdout.isTTY !== true) return
  try {
    process.stdout.write('\x1b[?1049l\x1b[?25h')
  } catch {
    // Nothing left to write to.
  }
}

process.on('exit', restore)
process.on('uncaughtException', (e: unknown) => {
  restore()
  process.stderr.write(`tuicano: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`)
  process.exit(1)
})
process.on('unhandledRejection', (e: unknown) => {
  restore()
  process.stderr.write(`tuicano: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`)
  process.exit(1)
})

main().catch((e: unknown) => {
  restore()
  process.stderr.write(`tuicano: ${e instanceof Error ? e.message : String(e)}\n`)
  process.exit(1)
})
