# TUIcano for herdr

Tucano's agents, their channels and their approvals, inside a herdr workspace — as panes and
actions rather than as another window to switch to. The plugin is a manifest plus one bridge
(`bin/bridge.mjs`); it is specified in [§5 of the spec](../docs/spec-tuicano.md).

## What it does

| Primitive | What it is for |
|---|---|
| `panes.channel` | a split pane running the client on a channel or a DM, from `TUICANO_OPEN` |
| `panes.approvals` | the approval card as a **popup** — session-modal, takes all input including Escape, no pane id, no lifecycle events, which is exactly what a card you must answer wants |
| `panes.channels` | a popup that lists your channels and opens the one you pick |
| `actions.channels` | pick a channel, then open it in a split pane |
| `actions.approvals` | decide what is waiting, without leaving the pane (it does not open when nothing is waiting) |
| `actions.status` | one notification line: approvals waiting, unread, agents working, paused or not |
| `actions.ask` | send the text you selected in this pane to the conversation TUIcano last opened |
| `actions.lend` | lend this pane's folder (the worktree) to an agent, and give it back when the tab closes |
| `actions.open-link` | a clicked `tucano://artifact/…` or `tucano://agent/…` opens in TUIcano instead of a browser |
| `events.pane.agent_detected`, `worktree.created` | remember which agent and worktree a pane has, for `ask` and `lend` |
| `events.tab.closed`, `workspace.closed` | give back the folders that tab or workspace borrowed |

## What it never does

- **It never starts a core.** Every call to the daemon goes through `tuicano --no-spawn`, so a
  plugin pane can never leave a second core running against your data folder. If nothing is
  listening, the action says what to run (`tuicano daemon`) and stops.
- **It holds no background process.** Every action, every event hook and the install-time build
  step is a one-shot process; the only long-lived thing it starts is a pane, and herdr owns that.
  Nothing of the plugin outlives its pane, which is what herdr expects of a plugin.
- **It writes outside itself nowhere.** Its own state (which conversation you last opened, which
  folders are lent) lives in `HERDR_PLUGIN_STATE_DIR`.

## Install

Needs herdr **0.9.5 or later**, Node 22+, and a TUIcano client — the checkout's build is used if it
is there (`npm run build:tui`), otherwise an installed `tuicano` on your PATH.

```bash
herdr plugin link /path/to/tucano/herdr-plugin
herdr plugin unlink tuicano
```

`link` runs the manifest's `[[build]]` step once, which only makes sure the client is built. What
herdr made of the manifest is visible with `herdr plugin list --plugin tuicano --json`, and an action
can be tried without binding a key:

```bash
herdr plugin action list --plugin tuicano
herdr plugin action invoke tuicano.status
```

## Keybindings

The plugin does not touch your config. Add what you want to `~/.config/herdr/config.toml` — these are
the shapes herdr documents, with the action ids this plugin declares:

```toml
[[keys.command]]
key = "ctrl+alt+t"
type = "plugin_action"
action = "tuicano.channels"

[[keys.command]]
key = "ctrl+alt+a"
type = "plugin_action"
action = "tuicano.approvals"

[[keys.command]]
key = "ctrl+alt+s"
type = "plugin_action"
action = "tuicano.status"

[[keys.command]]
key = "ctrl+alt+q"
type = "plugin_action"
action = "tuicano.ask"

[[keys.command]]
key = "ctrl+alt+f"
type = "plugin_action"
action = "tuicano.lend"
```

After pasting, `herdr config check` is the authority on whether the file (and those key names) are
valid — it is herdr's own validator, and this repository does not restate it.

## Two things to know before using it

**Graphics.** A herdr pane reports `TERM_PROGRAM=herdr`, so auto-detection there can only ever answer
text. A pane therefore has to be *told* which protocol to use: the plugin passes
`--graphics=$TUICANO_GRAPHICS`, defaulting to `kitty`, which is the protocol herdr relays through a
pane's own output. If the terminal you run herdr in cannot draw kitty graphics, set
`TUICANO_GRAPHICS=none` (text, with the snapshot placeholders) or `iterm2` / `sixel` if it is a bare
terminal that speaks those.

**Which team.** A pane talks to whatever `TUCANO_DATA` says, and the client falls back to the
platform app-data folder (`~/Library/Application Support/Tucano`) when it is unset. Make sure the
daemon you mean is the one that is running: `tuicano --graphics-info` prints the folder it resolved,
and `herdr plugin action invoke tuicano.status` says whether a core answered at all.

## Writing your own plugin against herdr 0.9.5

Three things the CLI does not tell you plainly, learned while building this one:

- `herdr plugin pane open --placement split` needs a target: pass `--target-pane <pane_id>`. The
  request field is `target_pane_id` (`herdr api schema --json`, `PluginPaneOpenParams`), and giving
  `--workspace` together with a target is rejected — the target already says which workspace it is in.
- `--env KEY=VALUE` on `pane open` did not reach the pane's process in this build: the pane's client
  fell back to the default data folder. Do not rely on it for anything that must be true; export the
  variable where the daemon runs, or have your entrypoint resolve it itself.
- A pane whose command exits immediately is closed by herdr, and `herdr plugin log list --plugin
  <id>` was empty for us, so a crashing entrypoint looks like "the pane never opened". Run the pane's
  command by hand in a pty first.
