# TUIcano — a terminal renderer for Tucano

> One core, two renderers. Tucano already is a headless brain (`src/core`, an Electron
> `utilityProcess` that owns SQLite, the engines, the MCP gateway, memory and routines) plus a React
> window that draws it. This fork adds a second window — **TUIcano**, a terminal client — and
> abstracts the seam between them so neither renderer owns the application logic. The parity matrix
> in [§3](#3-the-parity-contract) is the definition of "same features": countable, literal, and
> checked off phase by phase. A phase is done when its rows are reachable from a key.
>
> Structure follows [`spec-mvp.md`](spec-mvp.md), the repo's own design-document convention
> (concepts, numbered behaviours, build order, risks). That document is written in Portuguese — its
> header flags it as the historical original — so the *form* is borrowed, not the language: this one
> is English, like `docs/windows.md`, `CONTRIBUTING.md` and every comment in `src/`.
>
> **This is an independent fork.** It keeps `eduwxyz/tucano` as a *fetch-only* remote for reference
> and has no intention of merging upstream, so nothing here is shaped as an upstream patch: the
> commits are the fork's, the branch is the fork's, and the attribution Apache-2.0 asks for lives in
> [`NOTICE`](../NOTICE) and the README.

**Status:** draft · **Date:** 2026-10-30 · **Branch:** `feat/render-abstraction-tui`

## Goal

A second interface to the same product: the same team of agents, the same channels, the same
approvals and the same vault — drawn in a terminal, with no Electron. Not a secondary client and not
a degraded mode: the same application with another renderer, and the parity list says exactly what
that means.

Why it is cheap here: the core is already headless (exactly one Electron reference, and it was a
type), the renderer↔core contract is already explicit (`src/shared/rpc.ts`), and the agents' browser
already has a pure-Node implementation over CDP (`src/core/chrome.ts`). What was missing was
admitting it in the code: a core that doesn't know about the window, and an application layer both
windows share.

Users: people who already run Tucano and live in a terminal, and people who want agents on a machine
with no graphical session. One client per data folder, as in the app.

## Concepts

| Concept | What it is |
|---|---|
| **Core** | The brain: database, engines, runs, MCP gateway, connectors, memory, routines, usage. Runs as an Electron `utilityProcess` in the app, and in-process in the terminal client. |
| **Host** | Whoever hosts the core and does what it cannot: the OS vault, notifications, opening a URL or a folder, the browser without Chrome. Two implementations: Electron and plain Node. |
| **Client port** | A core client is a port: it receives every `CoreEvent` and sends `Request`. There is no privilege difference between the window and the terminal. |
| **App layer** | State + event reduce + selectors + actions, without React and without `window`. What both renderers share (`src/app`). |
| **Renderer** | Draws the state: Electron+React (`src/renderer`) or Ink (`src/tuicano`). |
| **TUIcano** | The terminal renderer. Binary `tuicano`, source in `src/tuicano`. The GUI keeps upstream's name and behaviour; only the terminal is branded TUIcano. |
| **Graphics protocol** | How an image reaches the terminal's screen: kitty, iTerm2, sixel, or none (text). |
| **Placeholder** | What the terminal shows in place of an image embedded in text: a line with its size and the key that opens it. |

## 1. The abstraction: one core, two renderers

### 1.1 Today's seam

The renderer gets a `MessagePort` handed over by main (`ipcMain.on('core:connect')`), sends
`Request`, receives `Response`/`{event}` (`src/shared/rpc.ts`: `Api` with 66 methods, `CoreEvent`
with 18 types). The core fans every event out to **every** connected port (`emit` in
`src/core/index.ts`), which already means a new client is just another port — nothing to invent in
the protocol.

What tied the core to Electron was something else: `process.parentPort`, used in six places
(requests to the host, host results, screenshot, browser op, the secrets cipher, and the client port
handoff). A core that doesn't know about the window needs that conversation to be an object, not a
global.

### 1.2 `src/host` — the host/runtime boundary

```ts
// src/host/types.ts
export interface Host {
  request(msg: HostRequest): void
  onMessage(cb: (msg: HostReply) => void): void
  onPort(cb: (port: ClientPort) => void): void
  cipher(): Cipher
}
```

`HostRequest` is exactly the set of messages main already answers (`CoreRequest` in
`src/main/index.ts`, which does not change): `open`, `open_path`, `notify`, `login_item`, `busy`,
`lang`, `screenshot`, `browser`. Nothing about the protocol was redesigned; it stopped being a
global.

- **`src/host/electron.ts`** — preserves today's behaviour: `request` → `parentPort.postMessage`,
  `onPort` → the port that arrives on `e.ports[0]`, `cipher` → the `mainCipher` (which moves out of
  `src/core/secrets.ts` to live here, because it is port traffic). Chosen at runtime by a single
  condition: `process.parentPort` exists only inside an Electron utility process.
- **`src/host/node.ts`** — the terminal host. `open`/`open_path` go through the OS opener
  (`open`, `xdg-open`, `start`), `notify` becomes OSC 9 with a bell as backstop, `lang` applies the
  language, `busy`/`login_item` do nothing (a terminal client is not a login item, and there is
  nothing to keep awake). `screenshot`, and a browser op with no Chrome present, refuse with a clear
  message instead of hanging. `cipher` is the same `plainCipher` the tests and the fake mode already
  use — there is no OS keychain without Electron, and that is named in the code (`ponytail:`) and in
  [§2.5](#25-what-the-terminal-genuinely-cannot-do). A terminal client reaches the core over the socket (spec §4); the wrapper in that same
  file is what keeps Electron's port API and Node's apart.
- **`src/host/ask.ts`** — the promise round-trip (`screenshot`, browser op) in one place, so neither
  implementation duplicates id counters and timeouts.
- **`src/host/index.ts`** — `getHost()`: the installed host, else Electron when `process.parentPort`
  exists, else an empty host (what a bare `node` import of the core gets).

After this, `src/core` has **no Electron reference at all** — not even a type. That is checkable:
`grep -rn electron src/core`.

### 1.3 `src/app` — the application layer

What lives today in `src/renderer/src/store.ts` (467 lines) and is neither React nor `window`:

- **`src/app/store.ts`** — `State`, `View`, `Dialog`, `Panel`, the initial state, the reduce
  (`applyEvent(state, event)`, now a pure function of state, keeping the same rules: the unread
  count that looks at the current view, the view fallback when a conversation is deleted, `setLang`
  on a language change), the selectors (`agentById`, `conversationTitle`, `pendingApprovals`,
  `computerOf`, `browserOf`, `pendingMemories`, plus the ones TUIcano starts using:
  `conversationMessages`, `channelList`, `unreadTotal`), and `createStore(client)` with every action.
- **`src/app/client.ts`** — the `AppClient`: `call` (the typed RPC), `connect(onEvent)`,
  `onNavigate`, `viewing`, and an optional `pickFolder` (a terminal renderer has no folder picker).
- **`src/renderer/src/store.ts`** — becomes a thin adapter: builds the GUI's `AppClient` (`./rpc` +
  `window.tucano`), creates the single store instance, and re-exports everything the components
  already import from `../store`, plus `useStore` (`useSyncExternalStore`). **No component changes.**

The gain is not architectural for its own sake: TUIcano now shares the reduce, the selectors and the
actions, so a new event or a new field reaches both renderers for free, and a state bug is fixed
once.

### 1.4 `src/tuicano` — the terminal renderer

```
src/tuicano/
  index.tsx       argv, the four modes, --graphics, --data, --theme, the socket client, Ink
  app.tsx         the Ink root: layout, focus, global keys, composer, status line, help, the overlay host
  client.ts       the terminal's AppClient: a ClientPort over the socket + host hooks
  approvals.ts    the gate: what a keypress means on an approval (tested on its own)
  useApprovals.tsx the gate wired to the store and the overlay host, shared by both places that decide
  lock.ts         the daemon's one-core-per-folder lock
  keys.ts         the keymap in one table (the help screen reads from it)
  sidebar.ts      the sidebar's rows, built from the shared state
  config.ts       the client's own config (theme, graphics) next to the data folder
  paths.ts        where the data lives: the platform's app-data folder, --data, TUCANO_DATA
  runtime.ts      what the client learned before drawing: data dir, protocol, cell, theme
  screens/        one per View: Sidebar, Conversation, Approvals, Agent, Tuca, Connectors,
                  Memory, Routines, Skills, Report, Usage, Settings, Onboarding, Banner, Placeholder
  overlays/       api (the overlay contract), host (the frame), Panels, Dialogs, ThemePicker
  theme/          types, index (the glob registry), context (useTheme), palettes/*.ts (18 looks)
  ui/             the kit every screen shares: kit.tsx, form.tsx, input.ts
  graphics/       detect, cell, fit, kitty, iterm2, sixel, raster/, transport, probe, viewer
```

- **Library:** **Ink** (`ink@8`, React for terminals), as the brief asked — it reuses React 19 and
  the store's shape, and `src/app` is deliberately renderer-agnostic.
- **Connection:** the TUIcano client builds an `AppClient` over a `ClientPort` from the daemon's
  socket (`src/host/socket.ts`); it does not import the core at all. The seam exercised is the same
  one the GUI uses, and several panes are several clients of one core ([§4](#4-the-daemon-the-transports-and-herdr)).
  - **One data folder:** enforced by the daemon, which takes `<dataDir>/tuicano.lock` (a pid) before it
  starts SQLite, the webhook listener and the routines. Clients take no lock, so several panes and a
  handful of one-shot calls share one core instead of racing it. Two clients on one folder was the
  race this avoids — and it was easy to hit: SQLite, the webhook port, and the same routines running
  twice.
- **Default data folder:** `TUCANO_DATA`, or `.tucano/` in the current directory — which is what the
  core already defaults to. The GUI uses Electron's own folder (`Tucano Dev`/`Tucano`), so the
  terminal does **not** silently open the same database: point `TUCANO_DATA=...` at it to do that.
- **Language:** the terminal's own strings are English for now. The GUI writes every user-facing
  string through `L(pt, en)` from `src/shared/lang`; the TUI wrapping its strings the same way is a
  P5 item, and it is a real parity gap until then (see [§6](#6-risks-and-open-questions)).

### 1.5 Build

A fourth target: `vite build` with `tuicano.vite.config.ts` (ssr/node, dependencies external,
automatic JSX) → `out/tuicano/index.js`. A separate target rather than one more entry in the
Electron build, for two concrete reasons: the `main` bundle inlines its dependencies, and Ink brings
`yoga-layout` (WASM) and `react-reconciler`, which should stay in `node_modules`, resolved at
runtime like any Node CLI.

```bash
npm run build:tui     # vite build --config tuicano.vite.config.ts
npm run tui           # build:tui, then the client: tuicano
tuicano daemon        # the core as its own process (what npm run tui attaches to)
tuicano send '<text>' # one-shot, for a keybind or a hook
bin/tuicano           # installable entry point (same file, no build step)
TUCANO_FAKE_ENGINES=1 npm run tui   # no subscription of any kind: this is how it is demoed and tested
```

New runtime dependencies, and why only these two: `ink` (the renderer, sanctioned choice) and
`jpeg-js` (pure-JS JPEG decode — a JPEG decoder is not something to hand-write, and the live browser
frames are JPEG). PNG decoding is written here on `node:zlib`, and kitty/iTerm2 pass PNG bytes
through untouched, so no PNG dependency is needed.

## 2. Images in a terminal

The parity ceiling here is deliberately high: the terminal shows **real images** — live frames of an
agent's browser, the PNGs of its screenshots, image artifacts in a conversation.

### 2.1 The protocols, in order of preference

| Protocol | How | Passed through | Needs decoding |
|---|---|---|---|
| **kitty** | APC `ESC _ G … ESC \`, `a=T`, `f=100`, `c=`/`r=`, `C=1` (do not move the cursor), `q=2` | PNG (`f=100`, bytes as they are) | JPEG → RGBA (`f=32`) |
| **iTerm2** | OSC `1337;File=name=…;size=…;inline=1;width=…;height=…:` + base64 + BEL | PNG and JPEG | nothing |
| **sixel** | DCS `ESC P q`, palette, 6-row bands, `ESC \` | nothing | PNG and JPEG → RGBA |

**kitty → iTerm2 → sixel → text** is the order of capability: kitty is the only one that leaves the
cursor alone (essential inside an Ink layout), iTerm2 takes both formats without decoding, and sixel
needs raw pixels. The order only applies to a bare terminal: inside herdr and tmux the environment
decides, and kitty is the whole of the in-herdr answer ([§4.6](#46-inside-herdr)).

### 2.2 Detection and sizing

`detectProtocol({ override, env })` — `--graphics=auto|kitty|iterm2|sixel|none`, where the override
always wins (including `none`, which forces text mode). Without an override: `KITTY_WINDOW_ID`,
`TERM=xterm-kitty`, `TERM_PROGRAM` ghostty/WezTerm; then iTerm2/vscode/Hyper; then a `TERM`
containing `sixel`, or `foot`, `mlterm`; otherwise `none`. A table of terminal identifiers is tested
case by case.

Sizing an image needs the pixel size of one cell, which a terminal reports two ways: the reply to
`CSI 14 t` (`ESC [ 4 ; height ; width t`), or `TIOCGWINSZ` (`ws_xpixel`/`ws_ypixel`, which plenty of
terminals report as 0). `cellSize()` falls back to a documented default (8×16 px) when there are no
pixels, and `fit()` fits the picture to the grid preserving both the picture's aspect **and the
cell's** (a cell is 8×16, i.e. 1:2 — ignoring that stretches every image), never scaling above the
original pixels.

Node cannot read `ws_xpixel` itself (nothing in `node:tty` exposes the winsize struct), so the
client probes with `CSI 14 t` before Ink takes over the terminal, with a short timeout and the
default as backstop. `parseWinsize` is implemented and tested anyway: it is the fallback for a
future caller that can read the struct (a native helper, or a platform that exposes it).

### 2.3 Decoding

Only two protocols need pixels, so the decoders are the minimum:

- **PNG** (`node:zlib` + filters 0–4, colour types 0/2/3/4/6): written here, no dependency.
  Interlaced (Adam7) and unsupported bit depths **fail with a clear message** instead of returning a
  wrong image quietly.
- **JPEG**: `jpeg-js` (pure JS, no native code), because a JPEG decoder is not hand-written lightly
  and the browser frames are JPEG.
- **Resizing**: box average to shrink (a 1280×800 frame reduced to ~300 px must not turn into
  noise), nearest neighbour to enlarge.

### 2.4 Drawing inside Ink — the decision

Ink is textual: it writes the whole frame on every commit and erases the lines it did not use. An
image written "inside" the layout would be erased by the next event — and while an agent works,
several arrive per second.

**Decision: the image is drawn outside Ink, full screen; the text keeps a placeholder.** The line
says what the image is and which key opens it (`[image 1280×800 — v]`), and `v` (or `Enter` on an
artifact) opens the viewer: Ink unmounts, the protocol draws the image across the whole screen, any
key returns. A screenshot, a browser frame and an artifact are exactly that: an image you look at,
not a 4-line thumbnail in the middle of a conversation.

The viewer **repaints on every Ink commit** (the effect runs with no dependency list), so there is
no state where the screen stays erased: whatever Ink wipes, the next cycle draws again. On a live
frame that is ~6 fps (Chrome paces itself on acks), which is the right behaviour for someone
watching an agent work.

What can be proven without looking at a screen: the bytes of every sequence (unit tests, byte for
byte: prefix, kitty's 4096-byte chunking, base64, the sixel header and palette), the image→cell
math, protocol selection per terminal identifier, and decoder round-trips. The final drawing needs a
human eye, and kitty has now had one ([§2.9](#29-what-has-been-seen-and-what-has-only-been-measured));
`tuicano --graphics-info` prints the detection, the cell size and a test image, which is how the
other two get checked.

### 2.5 What the terminal genuinely cannot do

The honest list, with the substitution and the reason. Nothing here is "TBD": these are decisions.

| What the app does | In the terminal | Why |
|---|---|---|
| Live frame of the agent's browser | **Works** (JPEG → kitty `f=32`/sixel, or straight through on iTerm2). With no graphics protocol: the textual snapshot of the page the core already produces, plus `o` to open the frame in the system viewer | A terminal with no graphics has nowhere to draw pixels |
| Image/PDF in a conversation | Image: graphics protocol. PDF: `o` opens the system reader | There is no PDF reader in a terminal |
| Native notification | OSC 9 (`ESC ] 9 ; title ; body BEL`) with a bell as backstop, plus the core's existing Telegram path | OSC 9 is what a terminal hands to the OS |
| Tray and auto-update UI | Out of scope: a terminal client has no tray and installs no versions. The version shows in `--version` and in Settings | There is no target to update |
| Open at login | Out of scope (nothing to register) | Same |
| Native folder picker | Type the path: `lendFolder` already takes a path, and the core validates it (`checkFolder`) | A terminal cannot open a dialog |
| The toucan's chirp (`.wav`) | The terminal bell plus OSC 9; Telegram is unchanged | No own audio outside Electron |
| Screenshot of the agent's Linux computer (Electron's Chromium) | Refuses with a clear message; the agent's browser still works when Chrome is installed (CDP, already pure Node) | There is no bundled Chromium in a Node process |
| Splash animation (GSAP, SVG) | A one-line banner | A terminal does not animate |
| OS keychain | `plainCipher` in the Node host, named in the code and here | `safeStorage` is an Electron API (`src/main/index.ts` handles each OS keyring) |

### 2.6 What the terminal cannot do, in one line

The table above is the whole of it: no PDF reader, no tray, no auto-update UI, no OS keychain, no
animated splash, no bundled Chromium for a computer's screenshot, no audio of its own, no native
folder picker. Everything else here is a plan to do the window's job with a keyboard.

### 2.7 Looks: themes, as data

A terminal client that is only readable is not done. `src/tuicano/theme/` holds a `Theme` of
**semantic** tokens — `text`, `dim`, `faint`, `accent`, `borderFocus`, `working`, `danger`, `done`,
`bar`, one colour per `AgentColor` — and eighteen palettes:

| Family | Palettes |
|---|---|
| Catppuccin | `latte`, `frappe`, `macchiato`, `mocha` |
| Kanagawa | `wave`, `dragon`, `lotus` |
| Editors | `dracula`, `darcula`, `one-dark`, `nord`, `tokyo-night` |
| Classic | `gruvbox-dark-hard`, `gruvbox-light`, `rose-pine`, `rose-pine-moon`, `solarized-dark`, `solarized-light`, `everforest-dark` |

Three rules keep it cheap:

1. **A palette is one file.** The registry finds them with a glob, so adding a theme is adding
   `theme/palettes/name.ts` — nothing to register, and two people adding themes cannot collide on an
   index.
2. **A screen never names a colour**; it asks the theme for `danger`. That is what makes eighteen
   looks possible without eighteen code paths, and it is a review rule: a hex outside
   `theme/palettes/` is a bug.
3. **The choice belongs to the client.** `--theme <name>`, or `Ctrl+T` for a picker with a live
   swatch of every candidate, kept in `<dataDir>/tuicano.config.json` — deliberately not in the
   app's database, because the window has its own `system | light | dark` idea and neither renderer
   should write the other's preferences into a shared row.

`accent` stays a warm orange in every palette: that is what keeps a themed TUIcano looking like
Tucano. Where a published palette has no colour for a slot (Rosé Pine has no green, One Dark has a
single cyan), the palette derives one and says so in its header and its `origin`. An honest
approximation beats a silent invention.

### 2.8 The screen contract: twelve screens, one shape

With twelve views, the risk is twelve ideas of what a list looks like. Two frozen pieces answer it:

- **`src/tuicano/ui/kit.tsx`** — `List`+`Row`, `Field`, `Segmented`, `Bar`, `Table`, `Spinner`,
  `Hint`, `Panel`. A screen that needs a tenth primitive adds it there, where the other eleven can
  see it, rather than inventing one on the side.
- **`src/tuicano/ui/form.tsx`** — one form engine (`text`, `lines`, `select`, `toggle`, `action`
  fields) owning editing, focus, Enter, `Ctrl+S` and `Esc`, so twenty forms cannot disagree about
  whether the arrows change a value. The editable core under it (`ui/input.ts`: insert, backspace,
  kill-word, window around the caret) is pure and unit-tested, because a caret bug is not something
  to find by typing.

A screen is then a small thing:

```tsx
export function Routines({ state, active }: ScreenProps): ReactNode
```

It owns its cursor (`useState`) and its keys (`useInput(handler, { isActive: active })`), asks for
modals through `useOverlay()` (`prompt`, `confirm`, `sheet`, `dialog`, `panel`, `themes`, `note`),
and never draws global chrome: the composer, the status line and the key help belong to the root.
The layers are quiet by construction — the root is inactive while an overlay is up, an overlay is
gone while an image is drawn — so a keypress has exactly one owner at a time. That is what keeps a
screen at ~180 lines, and what makes every screen testable without a terminal
(`test/helpers/screen.tsx` renders one with `ink-testing-library` and presses keys at it).

### 2.9 What has been seen, and what has only been measured

The graphics path makes three claims, and they are not equally confirmed. This is where a
reader can tell which is which.

| Claim | Evidence |
|---|---|
| **kitty** draws a real image in a real terminal | **seen by eye**, 2026-10-30, in kitty (the user ran it and photographed the result). The picture was `samplePng`'s 4-pixel-block checkerboard, orange on near-black: hard-edged, no torn rows, no banding, no shifted palette, no leftover escape text, and it did not overlap the text around it. The probe reported `212x56 cells of 9x18px` — the same cell size it reports inside a herdr pane — and the arithmetic checked out: a 32 px picture at a 9x18 px cell is 4x2 cells. |
| **iTerm2** and **sixel** draw a real image | **bytes only.** Their exact output is pinned by unit tests (framing, chunking, palette, bands) and can be dumped with `--graphics-info`, and neither has been looked at in a terminal that speaks it. |
| Inside **herdr** the path is chosen explicitly | **by construction**, and it is why the flag exists: a herdr pane reports `TERM_PROGRAM=herdr`, so auto-detection can only answer text there ([§4.6](#46-inside-herdr)). Every image surface the plugin opens passes `--graphics=<protocol>` rather than relying on detection. |

The transcript of that kitty run, verbatim:

```
TUIcano 0.2.0 - bare terminal
protocol: kitty (--graphics)
terminal: TERM=xterm-kitty TERM_PROGRAM= tty=true
grid: 212x56 cells of 9x18px
picture: 32x32 png -> 4x2 cells at 32x32px
data: /Users/nunes.lucas/Library/Application Support/Tucano
```

The last line is a second confirmation, and not about graphics: run from a checkout folder,
a one-shot resolved its data folder to the **platform app-data directory**, not to a fresh
`.tucano/` in the working directory — which is [§4.7](#47-the-data-folder-and-who-may-start-a-core)'s
decision seen in the wild rather than in a test.


### 2.10 Which surfaces are bilingual, and which are English

Both languages belong to the product, and which side a surface falls on is decided by who reads it —
not by convenience:

| Surface | Language | Why |
|---|---|---|
| Everything drawn inside the client: screens, overlays, the **key help**, labels, the composer, the status line | **bilingual** (`L(pt, en)`, in the workspace's language) | a person reads them |
| One-shot output: `tuicano send`, `approvals`, `cli`, the daemon's banner | English | a script, a keybind or a log reads it, and a machine has no language |
| `--graphics-info` | English | diagnostics |
| The installer's and the plugin bridge's messages, `install-tui.sh`, `bridge.mjs` stderr | English | a shell reads them; the bridge has a herdr pane's environment and no workspace setting |
| herdr manifest titles and action descriptions | English | herdr renders them from the manifest, where there is no runtime to ask |

The one asymmetry worth naming: the key help is drawn *by* the client *for* a person, so it is
bilingual even though nothing in the window corresponds to it — there was no pair to copy, so the
Portuguese was written for this client.


## 3. The parity contract

Two renderers, one feature set. `Phase` says when each row lands; nothing may stay TBD, and what the
terminal genuinely cannot do is in [§2.5](#25-what-the-terminal-genuinely-cannot-do).

### 3.1 The 66 `Api` methods

Literal count of `src/shared/rpc.ts` (`keyof Api`): **66**. Each one: how the GUI reaches it today,
and what TUIcano does with it.

| # | Method | In the GUI | In TUIcano | Phase |
|---|---|---|---|---|
| 1 | `snapshot` | `start()` at boot | the same `store.start()` at boot | P0 |
| 2 | `artifactText` | side panel for a text artifact | the file is read straight from `<dataDir>/artifacts/<id>/<name>` (same process); `artifactText` stays for text the core truncates. A reply's artifacts are addressed by a sub-cursor (`←/→`), so `v` and `a` act on the one selected | P1 |
| 3 | `sendMessage` | Enter in the composer | Enter in the composer | P0 |
| 4 | `stopRun` | Stop button on the reply | `s` on the reply in progress | P1 |
| 5 | `retryRun` | Retry button | `r` on the reply | P1 |
| 6 | `continueRun` | Continue button (reply paused at the budget) | `C` on the paused reply | P1 |
| 7 | `saveAgent` | agent form, Save | the same form, Enter to confirm | P2 |
| 8 | `createChannel` | ⌘N / dialog | `n` → name prompt | P5 |
| 9 | `renameChannel` | name dialog | `R` on the channel → prompt | P5 |
| 10 | `archiveAgent` | agent menu, Archive | `x` on the agent (list or sidebar) | P2 |
| 11 | `setTopic` | topic dialog | `t` on the channel header → prompt | P5 |
| 12 | `setChannelMembers` | members dialog | `m` on the channel → overlay, space toggles | P5 |
| 13 | `deleteConversation` | menu, Delete | `d` on the channel/DM → confirmation | P5 |
| 14 | `openDm` | click the agent / an `@handle` | `Enter` on the agent (or `@handle` autocomplete in the composer) | P0 |
| 15 | `ensureTuca` | the Tuca screen | `T` → the same builder screen. The model he is made with is chosen by `preferredTucaModel`: **Pi first** when this machine has it and lists models (this fork's preference), then the app's own order — what was asked for, the plan's usual two, the router's, the memory's, whatever else is ready | P1 |
| 16 | `createFromDraft` | Create on the Tuca card | `c` on the card | P1 |
| 17 | `settleDraft` | Dismiss / after creating | `d` on the card, and automatic after creating | P1 |
| 18 | `updateSettings` | each Settings field | the same, field by field, no Save button | P3 |
| 19 | `refreshEngines` | Settings, Refresh | `r` in Harnesses | P3 |
| 20 | `loginEngine` | opens a Terminal running the CLI's login | the core opens the same terminal; with no terminal to open, TUIcano **prints the command**, and `opened:false` is a normal path | P3 |
| 21 | `addConnector` | Connectors, Add | `a` → form (URL/command) | P2 |
| 22 | `removeConnector` | connector menu | `d` on the connector → confirmation | P2 |
| 23 | `reconnectConnector` | Reconnect button | `c` on the connector | P2 |
| 24 | `authorizeConnector` | Authorize button (opens the browser) | `a` on the connector: the Node host opens the same URL in the system browser | P2 |
| 25 | `harnessMcps` | lists the harnesses' own MCPs | `i` in Connectors → the list | P2 |
| 26 | `importHarnessMcp` | Add the MCP it found | `Enter` on the MCP row | P2 |
| 27 | `updateTool` | classify / enable / high risk, per tool | `c` cycles the class, `space` enables, `!` marks high risk | P2 |
| 28 | `decideApproval` | Approve / Refuse / always allow; high risk needs a 1.5 s hold | `y` approves, `x` refuses (optional reason), `Y` = always allow. **High risk: `y` twice within 3 s** — the terminal equivalent of a hold | P0 |
| 29 | `addMemory` | Memory, New | `a` on the Memory screen, with a scope picker | P2 |
| 30 | `editMemory` | edit the sentence | `e` | P2 |
| 31 | `confirmMemory` | "Still valid" | `c` | P2 |
| 32 | `decideMemory` | Accept/Dismiss a pending one | `y`/`x`, also on the in-conversation card | P2 |
| 33 | `forgetMemory` | Forget (with a reason) | `f` → optional reason | P2 |
| 34 | `purgeMemory` | Erase the forgotten record | `P` → confirmation; the card in a conversation acts on the memory the sub-cursor is on | P2 |
| 35 | `editSummary` | edit the Summary at the top of the conversation | Summary overlay (`S`), `e` edits | P1 |
| 36 | `summarizeNow` | Summarize now button | `s` in the Summary overlay | P1 |
| 37 | `computerAction` | agent page: start/restart/erase/open folder/refresh | `c` on the agent page → menu; the open-folder item goes through the host | P4 |
| 38 | `stopService` | services panel, Stop | `s` on the service row | P4 |
| 39 | `browserAction` | browser panel: Take over / Hide / Clear | `s` takes over, `h` hides, `X` clears logins (confirmation) | P4 |
| 40 | `lendFolder` | OS folder picker | type the path at the prompt (`lendFolder` takes a path; the core validates it) | P4 |
| 41 | `folderAction` | folder list: read only / read and write / return | `o` / `w` / `R` | P4 |
| 42 | `openExternal` | links open in the browser | `o` on a link/artifact/URL; the Node host opens it through the OS | P1 |
| 43 | `saveRoutine` | routine form | the same form, Enter saves | P2 |
| 44 | `setJevKey` | Settings, the Jev key (the core checks it) | `j` → key prompt | P3 |
| 45 | `engineModels` | the list a harness offers, when the picker opens | the same: when the model picker opens | P3 |
| 46 | `testEngine` | Test button (one real reply) | `t` in the picker: shows what the model answered | P3 |
| 47 | `saveSkill` | skill form | Enter in the form | P2 |
| 48 | `localSkills` | Skills, bring one in from Claude Code/Codex | `i` in Skills | P2 |
| 49 | `linkSkill` | link one it found | `Enter` on the row | P2 |
| 50 | `decideSkill` | approve/refuse the agent's proposal | `y`/`x` | P2 |
| 51 | `restoreSkill` | history, go back to a version | `Enter` on the version | P2 |
| 52 | `archiveSkill` | Archive | `x` | P2 |
| 53 | `removeSkill` | Delete | `d` → confirmation | P2 |
| 54 | `skillVersions` | the skill's history | the history list, on entering | P2 |
| 55 | `checkTrigger` | Check button in the trigger form | `c` in the form: prints what the trigger finds now | P2 |
| 56 | `setTelegramToken` | Settings, Telegram token | `p` → prompt (the core checks it) | P3 |
| 57 | `unpairTelegram` | Unpair | `P` → confirmation | P3 |
| 58 | `exportTeam` | Settings, Export → a file | `e`: writes the Markdown and prints the path | P3 |
| 59 | `importTeam` | Import (a file) | `I` → file path: TUIcano reads it and sends the text (which is what the method takes) | P3 |
| 60 | `backupNow` | Back up now | `b`: prints where the copy went | P3 |
| 61 | `openBackups` | Open the backups folder | `B`: the host opens the folder through the OS (same prefix check) | P3 |
| 62 | `report` | the Report screen (weekly) | the same screen, `←`/`→` changes week, with each agent's week cost and the skills it proposed | P2 |
| 63 | `usage` | the Usage screen | the same screen without charts: bars and tables in text | P2 |
| 64 | `setGithubToken` | Settings, GitHub token | `g` → prompt (the core checks it) | P3 |
| 65 | `removeRoutine` | routine menu, Delete | `d` | P2 |
| 66 | `runRoutine` | Run now | `R` | P2 |

### 3.2 The 18 `CoreEvent` types

Literal count of the union in `src/shared/rpc.ts`: **18**. All of them are consumed by the **same
`applyEvent`** in `src/app/store.ts`, so the difference between renderers is only where the state
shows up:

| # | Event | In the GUI | In TUIcano | Phase |
|---|---|---|---|---|
| 1 | `message` | bubble in the conversation; unread badge outside it | the same bubble in text; sidebar badge; receipt footer (`t` opens it) | P0 |
| 2 | `delta` | text appended to the streaming reply | the same, repainted at most ~30 fps so it does not flood the terminal | P0 |
| 3 | `agent` | avatar and name throughout | name/colour in text, agent list in the sidebar | P0 |
| 4 | `conversation` | sidebar entry | the same row, with unread count | P0 |
| 5 | `settings` | theme, language, badges | workspace name and language in the status line; `paused` becomes a badge | P0 |
| 6 | `connector` | Connectors screen | the connector row | P2 |
| 7 | `connector_removed` | same | the row disappears | P2 |
| 8 | `approval` | card in the conversation + an Approvals entry + a notification | text card + sidebar badge + OSC 9/bell | P0 |
| 9 | `memory` | Memory screen | the memory row | P2 |
| 10 | `memory_removed` | same | the row disappears | P2 |
| 11 | `computer` | computer section on the agent page | the same, in text (state, services, folders) | P4 |
| 12 | `browser` | panel with the live frame | text log + `v` opens the frame through the graphics path | P4 |
| 13 | `artifact` | card in the reply footer + panel | name and kind in the reply; image with `v`, PDF with `o` | P1 |
| 14 | `routine` | Routines screen | the routine row | P2 |
| 15 | `routine_removed` | same | the row disappears | P2 |
| 16 | `conversation_removed` | goes back to the first conversation | the same reduce rule (first channel, else `new-agent`) | P0 |
| 17 | `skill` | Skills screen | the skill row | P2 |
| 18 | `skill_removed` | same | the row disappears | P2 |

### 3.3 The 12 `View` variants

Literal count of the union in `src/app/store.ts` (today `store.ts`): **12**. TUIcano uses the **same
type and the same `navigate()`** — a screen is the same thing in both renderers:

| # | `View` | In the GUI | In TUIcano | Phase |
|---|---|---|---|---|
| 1 | `conversation` | `ConversationView` | the same conversation in text (steps, receipt, approval card, composer) | P0 |
| 2 | `agent` | `AgentPage` | the same page in text, numbered sections | P2 |
| 3 | `new-agent` | `AgentPage` with a draft | the same form | P2 |
| 4 | `tuca` | `Onboarding` (builder) | the same builder, step by step at the prompt | P1 |
| 5 | `approvals` | `ApprovalsPage` | the list, decided by keypress | P0 |
| 6 | `usage` | `UsagePage` | tables and bars in text | P2 |
| 7 | `connectors` | `ConnectorsPage` | list + form + tools | P2 |
| 8 | `memory` | `MemoryPage` | list by scope, with state and origin | P2 |
| 9 | `routines` | `RoutinesPage` | list + form | P2 |
| 10 | `skills` | `SkillsPage` | list + diff/history in text | P2 |
| 11 | `report` | `ReportPage` | the same weekly report | P2 |
| 12 | `settings` | `SettingsPage` | the same screen, field by field | P3 |

Besides the views, both `Dialog` values (`members`, `rename`, `topic`, `archived`, `new-channel`,
`search`) and the three `Panel` values (`artifact`, `service`, `browser`) exist in TUIcano as
overlays sharing the same state (`openDialog`/`openPanel`) — P1 (panels) and P5 (dialogs).

### 3.4 The 16 components of the GUI renderer

Literal count of `src/renderer/src/components/*.tsx`: **16**.

| # | Component | What it is | In TUIcano | Phase |
|---|---|---|---|---|
| 1 | `Conversation.tsx` | conversation, messages, steps, receipt, approval card | `screens/Conversation.tsx` (one screen, not two: the card lives in it) — the receipt sheet lists every turn of a reply, and a reply's artifacts and memory lines are addressed by a sub-cursor (`←/→`) | P0 |
| 2 | `Sidebar.tsx` | channels, DMs, agents, navigation, unread | `screens/Sidebar.tsx` (same state, keys instead of clicks); its channels are numbered as the app's `1-9` jumps to them | P0 |
| 3 | `Pages.tsx` | `AgentPage`, `ApprovalsPage`, `ConnectorsPage`, `SettingsPage` | four screens under `screens/` | P0 (Approvals) / P2 / P3 |
| 4 | `Panel.tsx` | side panel, artifact and service cards, browser | `overlays/Panel.tsx` + the graphics viewer | P1 / P4 |
| 5 | `Dialogs.tsx` | members, name, topic, archived, new channel, search | `overlays/Dialogs.tsx` (same `Dialog` values) | P5 |
| 6 | `Harness.tsx` | harnesses, status, test, models | the Harnesses section of Settings | P3 |
| 7 | `Memory.tsx` | memories, states, origin | `screens/Memory.tsx` | P2 |
| 8 | `Routines.tsx` | routines, triggers, scheduling | `screens/Routines.tsx` | P2 |
| 9 | `Skills.tsx` | skills, proposals, history | `screens/Skills.tsx` | P2 |
| 10 | `Report.tsx` | the weekly report | `screens/Report.tsx`, with each agent's week cost and the skills it proposed | P2 |
| 11 | `Usage.tsx` | usage, limits, cost | `screens/Usage.tsx` | P2 |
| 12 | `Onboarding.tsx` | first-run introduction and the Tuca builder | `screens/Onboarding.tsx` (sequential prompts) | P3 / P1 (builder) |
| 13 | `Tuca.tsx` | the Tuca's proposal card | inside `screens/Conversation.tsx` | P1 |
| 14 | `ui.tsx` | avatar, icons, `Sheet`, formatting | `ui/` — initials instead of avatars, no icon font, `Sheet` becomes an overlay | P0 |
| 15 | `Splash.tsx` | the animated opening (GSAP/SVG/audio) | a one-line banner | P5 |
| 16 | `Update.tsx` | new-version note, install | out of scope: the version shows in `--version` and in Settings | — |

`App.tsx` (screen router and the ⌘ keymap) becomes `src/tuicano/app.tsx`, with the key table in
`keys.ts` (⌘K→`/`, ⌘N→`n`, ⌘1‑9→`1-9`, ⌘,→`,`, arrows/Enter/Esc in place of the mouse).

### 3.5 The 9 host services and the app's other surfaces

`CoreRequest` in `src/main/index.ts` has **9** types. The terminal host answers the same ones:

| # | `CoreRequest` | In the app (Electron) | In TUIcano (Node host) |
|---|---|---|---|
| 1 | `secret` | the OS `safeStorage`, with the closed-keyring warning on Linux | `plainCipher`, named as the ceiling ([§2.5](#25-what-the-terminal-genuinely-cannot-do)) |
| 2 | `open` | `shell.openExternal` | the OS opener (`open`/`xdg-open`/`start`), same `https?://` check |
| 3 | `open_path` | `shell.openPath`, only the app's own folders | the same opener, with the same prefix check (`computers/`, `backups`) |
| 4 | `notify` | the OS `Notification` + a chirp | OSC 9 + bell; the "already looking at that conversation" check (`viewing`) still applies, through `client.viewing` |
| 5 | `login_item` | `setLoginItemSettings` / autostart | not applicable (documented) |
| 6 | `busy` | `powerSaveBlocker` | not applicable: a terminal session already implies the machine is in use |
| 7 | `lang` | the app menu's language | the client's own strings |
| 8 | `screenshot` | hidden-window Chromium (the agent's computer) | refuses with a clear message; the agent's browser still works over CDP when Chrome is installed |
| 9 | `browser` | an Electron offscreen window when there is no Chrome | only the Chrome/CDP path (pure Node); without Chrome, a clear message |

The app's remaining surfaces, one by one:

| Surface | In the app | In TUIcano |
|---|---|---|
| Tray | an icon by the clock where there is no Dock | out of scope: a terminal client has no tray; with no window, the process *is* the app |
| Artifact viewer | the `tucano://` protocol (sandboxed CSP) | files read from disk; images through the graphics path, PDF/HTML through the system browser (`o`) |
| Folder picker | `dialog.showOpenDialog` | a typed path → `lendFolder` (the core validates with `checkFolder`) |
| Single instance | `requestSingleInstanceLock` + raise the window | the daemon holds `tuicano.lock` (a pid); clients attach to it instead of starting a second core ([§4.5](#45-who-owns-the-daemon)) |
| Auto-update | `Updates` + `electron-updater` | out of scope; `--version` and the version in Settings |
| Chirp (`.wav`) | `afplay`/`SoundPlayer`/`pw-play` | the terminal bell + OSC 9; Telegram unchanged |
| Open at login | login item / autostart | out of scope |
| App menu | Electron's `Menu`, localised | `?` shows the keymap; there is no menu |

### 3.6 Three gaps, and how they closed

The three rows below were real gaps against the window, each marked in place while it was open. All
three are closed now, in the core where the data was missing and in both renderers; the record stays
because the *reasons* are worth keeping:

| | Was | Closed by |
|---|---|---|
| **G1** | A reply that ran several turns showed one receipt. The `receipts` table had always held a row per turn; nothing carried them to a renderer. | `Db.receiptsFor` and `Run.receipts` in the core (filled on every turn's re-emit, riding the `message` event — no new `Api` method); the window's `ReceiptLine` and the terminal's receipt sheet (`t`) list the turns, oldest first, with a total. A single-turn reply renders as it always did. |
| **G2** | The weekly report could not say what an agent cost, nor which skills it proposed. | `AgentReport.apiUsd` (present only when an engine reported a cost, so nobody prints `US$ 0.00` for silence) and `AgentReport.proposedSkills` (from `Skill.proposedBy`, active skills only), rendered in the window's `Report.tsx` and the terminal's `screens/Report.tsx`. |
| **G3** | Artifacts and memories acted on the first match, so a reply with two images gave you one of them. | The terminal's conversation gained a sub-cursor (`←/→`, aliases `[`/`]`) over the selected reply's artifacts and memory lines; `a`, `v`, `y`/`x`, `f` and `c` act on what it points at. The window already had real lists. |

Two limits are deliberate and stay:

- A reply that has *both* several artifacts and several memories shares one sub-cursor index, clamped
  per list, rather than carrying two. A reply with both is rare, and every case the contract lists has
  one kind of list.
- A message's inline footer still shows the last receipt as it always has; the per-turn breakdown lives
  in the sheet, which is where the contract puts it.

## 4. The daemon, the transports, and herdr

### 4.1 Three modes, one wire

`src/shared/rpc.ts` is unchanged and stays transport-agnostic: `Request {id, method, params}`,
`Response {id, result|error}`, `{event}`. What changes is who carries it and who hosts the core.

| Mode | What it is | Command |
|---|---|---|
| **daemon** | The core as its own process: the data folder, the single-instance lock, the socket. No UI. | `tuicano daemon` |
| **client** | The terminal client: attaches to the daemon over the socket and draws with Ink. | `tuicano` (or `tuicano tui`) |
| **one-shot** | One request, one answer, exit. What a keybind, a hook or a script calls. | `tuicano send '<text>' [--to <id\|#channel>] [--json]` · `tuicano approvals [--json]` · `tuicano approvals approve\|refuse\|always <id> [reason]` · `tuicano cli <method> [json]` |

`tuicano cli` is the escape hatch that keeps every one of the 66 methods reachable from a shell
without a flag per method; `send` and `approvals` exist because those are what a keybind actually
wants to call, and `approvals` is the gate — a keybind that approves is the whole point of the thing.

### 4.2 Two transports

| Transport | Who uses it | Where |
|---|---|---|
| **MessagePort** | the Electron window, handed over by main | `src/host/electron.ts` |
| **local socket** | TUIcano panes, one-shot commands, anything else that attaches | `src/host/socket.ts` |

Newline-delimited JSON over a Unix domain socket (a named pipe on Windows), one message per line.

The socket follows herdr's own socket conventions (`{id, method, params}` → `{id, result}` /
`{id, error}`, events pushed on the same connection), deliberately: a bridge that speaks both to
herdr and to this daemon should not have to hold two shapes in its head. Two honest deltas, both
deliberate:

- `error` is a plain string, not `{code, message}`. It is the core's `Api` answering a renderer that
  shows the message as it is (`Response` in `src/shared/rpc.ts`); changing it would change the
  Electron path too. The bridge maps it.
- Events reach every attached client with no `subscribe` handshake, because the core has fanned
  every event out to every connected port since before this fork (`emit` in `src/core/index.ts`). A
  handshake would add a mode the GUI does not use. A one-shot command ignores events, which is why
  one-shot is honest about not waiting for a reply.

### 4.3 Transport and renderer are independent axes

| Renderer | Transport | Host of the core |
|---|---|---|
| Electron GUI (React) | MessagePort | the app's `utilityProcess` (unchanged) |
| TUIcano (Ink) | local socket | the daemon |
| one-shot CLI | local socket | the daemon |
| headless Electron, attaching to a running daemon | MessagePort *or* socket | the daemon — **possible by construction, not built** |

Nothing in the matrix is special-cased: a renderer needs a `ClientPort` and an `AppClient`
(`src/app/client.ts`), and a host needs to know where the core lives (`src/host/`). TUIcano's client
is 60 lines for exactly that reason.

### 4.4 Security: the socket is a privilege boundary

A socket that can approve a sensitive tool call, open a pull request or run an agent's command is
worth attacking, so:

- Never a TCP port. A Unix socket (or a Windows named pipe), in the data folder.
- User-only: `chmod 0600` on the socket and on the token file next to it.
- A token: the daemon writes 32 random bytes to `<dataDir>/tuicano.token` (0600) and the first line
  of every connection has to present it. A wrong or missing token closes the connection before a
  single request is parsed.
- A process running as the same user can read that token, and that is the ceiling. The 0600 socket
  and the token keep out other users, and the token also survives a data folder whose permissions
  were loosened (a umask surprise, a shared `/tmp`). Node exposes no peer-credential call for Unix
  sockets, so a same-user check is not something to add; an attacker who is already that user can do
  everything the client can anyway.
- **One rule for secrets, across both hosts**: a secret is sealed by the host that wrote it, and a
  host never reads one it did not seal. The app seals with the OS keychain; the Node host seals with
  `plainCipher` and *refuses* anything else, loudly, naming the folder — because the alternative is
  reading a keychain blob as if it were a password. That is what keeps "the same database" from
  meaning two keychains. When the app ends up attaching to a daemon, the app stays the one that
  seals; the daemon never has to read a raw secret.

### 4.5 Who owns the daemon

The daemon is a **user-run service**, or started on demand: the first client that finds no socket
starts one detached and waits for it (up to ~8 s), unless `--no-spawn` says otherwise, in which case
it says what to run instead. Clients never take the lock; the daemon does, so "one core per data
folder" is enforced where it can be (two clients on one folder was the race this avoids: SQLite, the
webhook port, and the same routines running twice).

Nothing else may own it. In particular a herdr plugin must **not** supervise or spawn it: herdr runs
`[[startup]]` hooks as one-shot commands and expects plugins to stop any background process before
the parent command or pane exits, so a plugin-owned daemon would be killed whenever herdr tidied up.
The plugin bridges to the daemon; it does not host it.

### 4.6 Inside herdr

herdr relays **kitty graphics through the pane's own output** and manages placement, clipping and
visibility itself; its older external overlay API (`pane.graphics.*`) is gone with no replacement. So
inside a herdr pane:

| Protocol | Inside herdr | Bare terminal |
|---|---|---|
| **kitty** (APC `ESC _ G`) | **the only path** — and the best-tested encoder here | first choice |
| **iTerm2** (OSC 1337) | not the in-herdr path: herdr does not relay it | second choice |
| **sixel** (DCS) | not the in-herdr path | third choice |
| **text** | what most herdr users will see, so it has to be good | last resort |

`detectProtocol` encodes this: with `HERDR_ENV=1` or `HERDR_SOCKET_PATH` set, the answer is kitty if
the outer terminal speaks it and text otherwise — never iTerm2 or sixel, even when the outer terminal
would have taken them. Under `TMUX` the answer is text until a passthrough exists. `--graphics=` is
the override and wins everywhere, including `none`.

Requirements of the renderer boundary, from being a guest in someone's multiplexer:

- Alternate screen, entered on render and left on every exit path, including a crash
  (`uncaughtException`, `unhandledRejection`, `main().catch`, `exit`). A pane left on the alternate
  screen with a hidden cursor is worse than a crashed client.
- Resize is the pane's, not an assumed one: layout comes from Ink's window size (SIGWINCH under the
  hood), the sidebar narrows on a narrow pane, and the content area clips rather than overflowing.
- stdout is the drawing surface and nothing else: logs go to stderr, `--graphics-info` is the one
  documented exception because writing the escape sequence is the point, and the daemon redirects its
  own `console.log` to stderr.
- No mouse and no exotic keys: neither mouse reporting nor the kitty keyboard protocol is enabled,
  because those belong to the multiplexer; they stay opt-in if they ever land.
- The graphics writer is one swappable transport (`src/tuicano/graphics/transport.ts`): protocol in,
  escape sequence or a text fallback out. A multiplexer that strips images costs a flag, not a
  rewrite.

### 4.7 The data folder, and who may start a core

`--data <dir>`, else `TUCANO_DATA`, else the platform's application-data directory plus the app's
name (`~/Library/Application Support/Tucano`, `~/.config/Tucano`, `%APPDATA%\Tucano`) — the same
folder the installed app uses, resolved in `src/tuicano/paths.ts` without a dependency. A terminal
and a window on one machine are then one team by default, which is the whole point.

The caveat worth knowing: run from the code, the app deliberately uses `Tucano Dev` instead
(`src/main/index.ts`), so a development window and a terminal are two folders until one is pointed
at the other. Printing the resolved folder is part of `--graphics-info` and of the daemon's first
line for exactly that reason.

Two rules follow from this being a *file*, not a setting:

- **One core per data folder.** The daemon takes `<dataDir>/tuicano.lock` (holding its pid) before
  it touches SQLite, the webhook listener or the routines; clients never take it. A stale lock is
  recognised by its dead pid. This is why several panes and a keybind can share one team instead of
  racing it — and it is keyed to the *resolved* folder, so `--data` gets its own core.
- **A read-only one-shot never starts a core.** `tuicano approvals`, `tuicano cli <method>` and
  friends attach, and with nothing listening they exit with one line saying what to run. A keybind
  fired from an arbitrary directory must not quietly grow a second team — that is not hypothetical,
  it is how this rule came to exist. Mutating one-shots may start one (`send` does), and `--start`
  lets anything opt in; `--no-spawn` refuses.

## 5. Phases

Each phase is a set of rows in [§3](#3-the-parity-contract), and this is where each one stands today.
"Done" means every row of that phase is reachable from a key and covered by a test; the three gaps that were open are closed, and
[§3.6](#36-three-gaps-and-how-they-closed) records what they were.

| Phase | State | What it is |
|---|---|---|
| **P0** | done | the abstraction (`src/host`, `src/app`), the critical path: sidebar, conversation with streaming, composer, the approvals gate, the graphics path, the theme system (`Ctrl+T`, 18 palettes) and the screen contract (`ui/kit`, the form engine, the overlay host). Verified by `test/tuicano-*.test.tsx` and `scripts/tour-tui.py` |
| **P1** | done | the whole conversation: steps, the receipt sheet, stop/retry/continue, answering a question, artifacts, the summary, the Tuca's draft card, in-conversation memory lines, the three side panels |
| **P2** | done | the pages: agent and new agent, connectors (with tool classification and the harnesses' own MCPs), memory, routines, skills, report, usage |
| **P3** | done | settings (harnesses, models, tokens, team, backups, pause, quiet hours) and the first-run introduction |
| **P4** | done, with the substitutions of [§2.5](#25-what-the-terminal-genuinely-cannot-do) | the agent's browser (live frames through the graphics path, take over/hide/clear) and its computer (state, actions, services, folders) |
| **P5** | done | the six dialogs, search, the archived agents, the one-line banner in place of the splash, the key help — and the row-by-row audit this matrix is |
Phases are worked in the shared worktree by default, with one rule that is not negotiable: **no
`git stash` in it**. A lane that needs a clean tree gets a scratch clone or a worktree of its own — a
stash taken while another lane is writing ate a pop once and only a manual audit showed nothing was
lost. Everything else about how a phase is worked (lanes, scopes, evidence) is in `CONTRIBUTING.md`.

| **P6** | built, and verified in a real herdr session; the keybinds are the user's to paste | the herdr plugin (below) |
| **P7** | written down, not built | removing Electron (below) |

- **P0 — the abstraction and the critical path (this branch).** `src/host` (Electron + Node),
  `src/app` (reduce, selectors, actions) with the GUI intact, and the TUIcano skeleton: it launches,
  connects, lists channels and DMs, opens a conversation, shows `delta` streaming, sends a message,
  and decides an approval by keypress (`y`/`x`/`Y`, high risk on two presses) — the product's whole
  point. Plus the complete graphics path (kitty, iTerm2, sixel, text) with the viewer and
  `--graphics-info`. Screens: **conversation**, **approvals**, **sidebar**, image viewer.
- **P1 — the whole conversation.** Steps, per-turn receipt, stop/retry/continue, answering a
  question, artifacts (image/PDF/text), the Summary (edit/summarize now), the Tuca card
  (create/dismiss), in-conversation memory cards, the side panel. Screens: **conversation** (full),
  **tuca**, panels.
- **P2 — the pages.** Agent and new agent, Connectors (with tool classification and the harnesses'
  MCPs), Memory, Routines, Skills, Report, Usage. Screens: **agent**, **new-agent**, **connectors**,
  **memory**, **routines**, **skills**, **report**, **usage**.
- **P3 — settings and onboarding.** Harnesses (status, login, test, models), tokens
  (Jev/Telegram/GitHub), team export/import, backups, language, pause everything, quiet hours, and
  the first-run introduction. Screens: **settings**, **onboarding**.
- **P4 — browser and computers.** Live frame in the panel, take over/hide/clear, computer actions,
  services, folders lent and returned, artifacts. Screens: panels + **agent**.
- **P5 — dialogs and the matrix audit.** Members, name, topic, archived, new channel, search, the
  opening banner, the key help — plus a row-by-row pass over the matrix in real terminals (kitty,
  WezTerm, iTerm2, foot, xterm without graphics).
- **P6 — the herdr plugin (built).** `herdr-plugin/` holds the manifest, the bridge that the manifest
  launches, and its own README: a herdr action opens a split pane on a channel, the approval card is a
  popup (session-modal, all input including Escape, no pane id, no lifecycle events — what a card you
  must answer wants), the status one-shot notifies one line, `ask` sends the pane's selected text into
  the team, `lend` lends the focused pane's folder and `tab.closed`/`workspace.closed` give it back,
  `pane.agent_detected`/`worktree.created` attach the pane's context, and a clicked `tucano://` link
  opens in TUIcano instead of a browser. Two client flags exist for it: `--open` (a screen name, a
  `#channel`, an `@handle` or an id) and `--popup` (the approval card decides one thing and goes away).

  **Ownership, hardened**: every call to the core goes through `--no-spawn`, so the plugin can never
  start a second core on a data folder, and every hook is a one-shot — nothing of the plugin outlives
  its pane. With no daemon listening it notifies the command to run and stops.

  **Verified in a real herdr session** (0.9.5), not only by test: `herdr plugin link` accepts the
  manifest and returns **no warnings**, so all four event names are valid; the status action answers a
  line; `ask` put the selected text into the team and the router answered it; `lend` lent a folder that
  appeared on the agent and `tab.closed` took it back; the events recorded a pane's worktree and agent
  into the plugin's state; the pane entrypoint draws the conversation it was told to open and stays
  alive as long as its pane; and the approval popup does not open when nothing is waiting. The bridge's
  pure parts (context, links, target resolution, state) have their own tests.

  Four things the implementation taught, which the plan above had wrong:

  1. **`--env` on a plugin pane did not reach the pane's process** in this build: a pane opened with
     `--env TUCANO_DATA=…` still resolved the platform app-data folder, and the client auto-started a
     core *there*. Nothing the plugin needs may depend on `--env`; the entrypoint resolves the folder
     itself, and the README says so.
  2. **`herdr plugin pane open` needs a target for a split, spelled differently from its help.**
     `--placement split` without one is an error, the request field is `target_pane_id`
     (`herdr api schema --json` → `PluginPaneOpenParams`), and passing `--workspace` together with a
     target is rejected — the target already decides the workspace.
  3. **A mention is not a link.** herdr matches a link handler's pattern against a *clicked URL*, and a
     bare `@handle` in message text is not one, so mentions cannot be link handlers at all; the `ask`
     action is what carries selected text to an agent. `tucano://agent/<id>` is handled, because that
     *is* a URL.
  4. **An entrypoint that dies looks like "the pane never opened".** herdr closes a pane whose command
     has exited, and `herdr plugin log list` was empty for us, so the first run of the pane entrypoint
     failed invisibly (it was called without its environment and threw on `TUICANO_OPEN`). Run the
     entrypoint by hand in a pty — that is also where the `--open` bug surfaced, in which the flag's
     value was parsed as a command name.

  What is left for P6, and it is the user's to do: paste the `[[keys.command]]` bindings from
  `herdr-plugin/README.md` into their own `config.toml` — the plugin never writes there — and then
  `herdr config check`. The manifest's action titles are English because herdr renders them from the
  manifest, where there is no runtime and therefore no language to ask for.

- **P7 — removing Electron (planned, gated on parity, and on three replacements).** Only worth
  doing once the matrix is green with the window still there: parity is measured *against* the
  reference implementation, and deleting the reference before it is met means nobody can tell what
  "the same" meant. What goes with it: `src/main` (window, tray, menu, auto-update, the `tucano://`
  artifact protocol, single-instance lock), `src/preload`, the 16 React components (~8.3k lines) and
  the 115 KB stylesheet, `src/host/electron.ts`, `src/renderer`, and the dependencies that exist
  only for them (`electron`, `electron-builder`, `electron-updater`, `react-dom`, `gsap`). What gets
  simpler, concretely: one renderer instead of two, one transport instead of two, one host
  implementation instead of two, and — the one that pays for itself — **one cipher instead of two**,
  because a daemon-only world can have a keyring-backed cipher (`secret-tool`, the `security` CLI,
  or `keytar`) without anyone having to interoperate with `safeStorage`.
  What must be replaced or consciously accepted before the deletion:
  1. **The keychain.** Nothing else in the app is a security regression, and this one is: the
     replacement is a keyring-backed `Cipher` in the Node host, or secrets that stay `plainCipher`.
  2. **Computer screenshots.** The agent's `screenshot` tool today uses a hidden Chromium window
     (`src/main/index.ts`). The replacement is the same Chrome/CDP path the browser already uses —
     which means Chrome becomes a hard requirement for that one tool, and its absence is a clear
     message.
  3. **Notifications, folder picking, tray, auto-update, the splash.** Notifications are already
     OSC 9 plus the core's Telegram path; the folder picker is already a typed path; tray,
     auto-update and the splash are out of scope for a terminal by design ([§2.5](#25-what-the-terminal-genuinely-cannot-do)).
  Decision record: this is the user's call to make, and it is not a simplification until the three
  above are settled — the honest summary is that it saves a lot of *code to maintain* and one
  security caveat, and costs one bundled Chromium and one update mechanism.

## 6. Risks and open questions

- **One client per data folder** applies to the terminal too, and it is the easiest thing to forget:
  two clients on the same folder race SQLite and the webhook port, and would run the same routines.
  The daemon holds the lock, so clients attach instead of competing; the GUI keeps Electron's lock.
  Pointing both at the same folder **works today** only if they use the same lock file — the terminal
  writes its own, so the two do not exclude each other. Decide in P3 whether the locks become one.
- **A terminal with no graphics protocol** is the common case (tmux, CI, telnet). Text mode has to be
  genuinely good: the page's textual snapshot, which the core already produces, is the information;
  the frame is the bonus.
- **kitty and tmux** get in the way: inside tmux the protocol needs passthrough, which this fork does
  not do yet. Plan: detect `TMUX` and fall back to text (or wrap in passthrough) in P4.
- **Ink plus raw writes** on the same screen is the most fragile part of the design. Drawing the
  image outside Ink (full screen, repainted every commit) avoids fighting over the cursor, but
  anything that depends on Ink's `yoga-layout` cannot promise *when* the frame is written. Verify in
  every terminal on the P5 list.
- **`plainCipher` in the Node host** means connector secrets sit unencrypted in the SQLite of anyone
  using the terminal. Acceptable on a development machine, unacceptable as an end state: the path is
  a user-key cipher (or `secret-tool`/Keychain through a command line) in P3.
- **Two data folders, two conventions:** the app uses Electron's folder, the terminal uses `.tucano/`
  in the current directory (which is what the core already defaults to). Convenient for development,
  surprising for anyone expecting to see their agents: decide whether TUIcano should look for the
  app's folder by default.
- **The socket is a privilege boundary** ([§4.4](#44-security-the-socket-is-a-privilege-boundary)),
  and its protection is only as good as the data folder's permissions plus a token a same-user
  process can read. Node offers no peer-credential call for Unix sockets. If this ever needs to be
  stronger, the path is per-client credentials (a token per pane, revocable) rather than a stricter
  check on the same connection.
- **A daemon that is killed leaves a socket and a lock behind.** Both are handled (a stale pid is
  ignored, the socket is unlinked before listening), but the failure mode to watch for is a daemon
  that is alive and *not answering* — an agent's run stuck in `working`. `tuicano cli snapshot` is the
  cheap way to tell the two apart.
- **The TUI's strings are English only.** Every user-facing string in the GUI goes through
  `L(pt, en)` (`src/shared/lang`) because the app is bilingual; the terminal client's strings are
  hard-coded English for now. Closing that gap (wrapping them in `L`, and keeping the key help in
  `keys.ts` in step) is a P5 item, and it is a real parity gap until it lands.
