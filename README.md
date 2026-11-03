<div align="center">

<img src="build/icon.png" width="112" alt="Tucano">

# TUIcano

**Tucano's team of AI agents, in your terminal.**

A fork of [Tucano](https://github.com/eduwxyz/tucano) that keeps the headless core and replaces the
window with a terminal client. Same agents, same channels, same approvals, same vault — drawn with a
keyboard, inside the multiplexer you already live in.

[![License](https://img.shields.io/badge/license-Apache--2.0-141210)](LICENSE)
[![Upstream](https://img.shields.io/badge/upstream-eduwxyz%2Ftucano-141210)](https://github.com/eduwxyz/tucano)
[![Runs on](https://img.shields.io/badge/runs%20on-Claude%20Code%20·%20Codex%20·%20OpenCode%20·%20Pi-E2541B)](#runs-on-what-you-already-have)

[Spec and parity contract](docs/spec-tuicano.md) · [Upstream README](https://github.com/eduwxyz/tucano)

</div>

---

## What this fork is

**Attribution.** TUIcano is a fork of [Tucano](https://github.com/eduwxyz/tucano), by
[eduwxyz](https://github.com/eduwxyz) and its contributors. It carries changes, and is distributed
under the same licence, Apache-2.0. The original project and its authors are credited here and in
the [NOTICE](NOTICE) file, which lists the areas this fork modified or added.

Tucano is an Electron app for a team of AI agents that run on the harnesses you already have installed
and signed in. This fork takes the part that does the work — the core: SQLite, the engines, the runs,
the MCP gateway, approvals, memory, routines — and puts a terminal in front of it.

**The Electron UI is not maintained here.** It is upstream's, it is still in the tree (the core it
shares is the same core), and it is kept for exactly one reason: it is the reference the parity matrix
is measured against. Everything this fork maintains is the terminal client and the seam that makes it
possible:

- **`src/core`** — the brain, shared with upstream. It no longer names Electron at all (`src/host` is
  the machine it runs on: the app's utility process, or plain Node).
- **`src/app`** — the state, the event reduce, the selectors and the actions both renderers share.
- **`src/tuicano`** — TUIcano: an [Ink](https://github.com/vadimdemedes/ink) client over a local
  socket, with real images (kitty, iTerm2, sixel), 18 themes, and one key per thing.

`docs/spec-tuicano.md` carries the **parity contract**: all 66 `Api` methods, 18 events, 12 views, 16
components and 9 host services, each mapped to the key that reaches it and the phase that delivers it.
That document is the definition of "the same features" — arguments about it belong there.

This fork is **independent**: it keeps upstream as a fetch-only remote for reference and does not
intend to merge it, so the commits and the branch are the fork's own. Upstream is credited, and the
modified areas are listed in [NOTICE](NOTICE), as Apache-2.0 asks.

### Why a terminal

Because the work is already there. Coding agents got good; working with several of them is still a mess
of terminals. This one puts the team where the terminals are: no window to switch to, no context lost
between a build and a message, and routines that keep running when you close the laptop lid.
It also means agents run on a machine with no graphical session at all.

## Why Tucano (upstream's idea, unchanged)

- **A team, not a prompt box.** Agents with names, roles, tools and memory. They talk in channels, call
  each other with `@mentions` and hand work over: one finds the bug, another fixes it, a third reviews
  it, and you get the result.
- **Your rules.** Each agent sees only the tools you give it — *no access*, *read*, or *read and write*
  per tool. Merges, purchases, posts, emails and deletes become an approval tied to the exact action.
- **It runs on your subscriptions.** The agents run on the Claude Code, Codex, OpenCode or Pi you
  already have. The app never touches your credentials, and there is no per-call billing.
- **Everything leaves a receipt.** Every turn records the model, tokens (in, cache, out), duration and
  the equivalent API cost, per agent and per month.

## Runs on what you already have

| Harness | Install | Sign in |
|---|---|---|
| [Claude Code](https://code.claude.com) | `curl -fsSL https://claude.ai/install.sh \| bash` | `claude auth login` |
| [Codex](https://github.com/openai/codex) | `npm install -g @openai/codex` | `codex login` |
| [OpenCode](https://opencode.ai) | `curl -fsSL https://opencode.ai/install \| bash` | `opencode auth login` |
| [Pi](https://pi.dev) | `npm install -g @earendil-works/pi-coding-agent` | `pi` |

An agent runs on one of these, the way you set it up: on your plan, on your company's gateway, or on
the providers you have logins for. **Tuca** — the agent that builds your other agents — prefers **Pi**
when your machine has it, and falls back to the plan models when it doesn't.

## Install

TUIcano needs **Node 22 or later** (Ink, the renderer, needs it) and at least one harness signed in.

```bash
git clone https://github.com/RodriguesL/tuicano.git
cd tuicano
sh scripts/install-tui.sh            # builds, then links `tuicano` into ~/.local/bin
```

`--prefix /usr/local` puts it elsewhere, `--copy` copies the launcher instead of linking it (so the
checkout can move), `--skip-build` uses what is already built, and `--uninstall` removes the link. The
launcher points back at the checkout, so `git pull` is the update.

Then, from anywhere:

```bash
tuicano                     # the client; starts a daemon on your data folder if none is running
```

### A demo, with nothing installed

```bash
TUCANO_FAKE_ENGINES=1 tuicano    # fake engines: no subscription, no login, deterministic replies
```

The fake harnesses answer canned replies and understand a few magic phrases (`apague a tarefa 3`
produces a real approval, `gaste 2000000 tokens` trips the budget pause), so you can see the whole
machine work before you point it at your own credentials. A fresh data folder starts **empty** — the
introduction builds your first agent. `TUCANO_SEED=1` adds the sample team the screenshots use.

### The pieces you can call from a keybind

```bash
tuicano daemon                       # the core as its own process: the lock, the socket, no UI
tuicano send 'deploy failed, take a look' --to '#engenharia'
tuicano approvals                    # what is waiting for a decision (--json for a script)
tuicano approvals approve <id>       # the gate, from a keybind: approve, refuse, or always
tuicano cli snapshot | jq '.agents'  # any of the 66 methods, one shot
```

Read-only one-shots attach and say so when nothing is listening; mutating ones may start a daemon
(`--start` allows it for anything, `--no-spawn` refuses).

## Using it

```
Tab / Shift+Tab   move between the sidebar and the screen      a   approvals
1-9               channel 1 to 9 (as Cmd-1-9 in the app)       /   search
i                 write a message                              n   new channel
u c m r k b       usage, connectors, memory, routines, skills, report
,                 settings                                     Ctrl+T  themes
?                 every key, on screen                        q   quit
```

Inside a conversation: `e` steps, `t` receipt, `s` stop, `r` retry, `C` continue, `v` an image (real
pixels), `o` a link, `S` the summary. On an approval: `y` approve, `x` refuse, `Y` always allow — and a
high-risk call needs the same key twice within three seconds, the terminal's stand-in for the
press-and-hold the window asks for. Every screen lists its own keys at the bottom.

Themes: 18 palettes (Catppuccin, Kanagawa, Dracula, Darcula, Gruvbox, Nord, One Dark, Tokyo Night,
Rosé Pine, Solarized, Everforest), chosen with `Ctrl+T`, `--theme <name>`, or `tuicano.config.json`
next to your data.

## Your data

`--data <dir>`, else `TUCANO_DATA`, else the platform's application-data folder plus the app's name
(`~/Library/Application Support/Tucano`, `~/.config/Tucano`, `%APPDATA%\Tucano`) — the same folder the
installed app uses, so the terminal and the window are one team by default. Run `tuicano
--graphics-info` to see which folder and which graphics protocol this terminal resolved.

- **One core per data folder**, owned by the daemon, which takes `tuicano.lock` before it touches
  SQLite or starts routines. Clients attach to it: several panes and a keybind share one team.
- **The socket is a privilege boundary.** A Unix domain socket (a named pipe on Windows), user-only
  (`0600`), with a token the daemon writes next to it (`tuicano.token`, `0600`) that every connection
  presents first. Never a TCP port. A same-user process can read that token, and that is the limit of
  what a local socket can promise.
- **One rule for secrets, across both hosts**: a secret is sealed by the host that wrote it, and a host
  never reads one it did not seal. The Electron app seals with the OS keychain; the daemon seals its own
  and refuses the app's, loudly, naming the folder — rather than reading a keychain blob as a password.
  Until a keyring-backed cipher lands for the daemon, its own secrets are not encrypted: fine on a
  development machine, and not fine as an end state.

## Development

```bash
npm install
npm run build:tui     # the terminal client, to out/tuicano
npm run tui           # build, then run it
npm test              # 61 files, 490 tests
npm run typecheck
```

The Electron app still builds (`npm run build`) and is not part of what this fork maintains — treat a
failure there as upstream's business unless it is the shared core. `docs/spec-tuicano.md` §5 lists the
phases: P0 (the seam), P1–P5 (the screens), P6 (a herdr plugin, written down only) and P7 (removing
Electron, gated on parity and on three replacements: the keychain, the screenshot path and the update
mechanism).

## License

Apache-2.0, as upstream. Tucano is [eduwxyz's](https://github.com/eduwxyz/tucano); TUIcano is this
fork's terminal client. The name, the icon and the idea stay theirs — this is a fork, not a
replacement. The attribution Apache-2.0 asks for, and the areas this fork changed, are in
[NOTICE](NOTICE).
