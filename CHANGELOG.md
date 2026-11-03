# Changelog

> **Two lines of versions.** This fork's own versions start at 0.1.0, at the top; every version below
> it is upstream Tucano's, and those links point at upstream
> ([eduwxyz/tucano](https://github.com/eduwxyz/tucano)), which is where those releases and pull
> requests live.

What changed in each version of Tucano. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org) (while in 0.x, a minor version may change things). Each section is also the release's notes on GitHub, which is what the app's "What's new" link opens.

## [0.1.0] - 2026-11-03

> **Em português:** o TUIcano começa aqui: o mesmo time de agentes do Tucano, os mesmos canais e as mesmas aprovações, num painel do seu terminal. É um fork independente — mantém o núcleo headless, põe a interface gráfica de lado como referência e acrescenta um plugin de herdr para abrir canais, decidir aprovações e emprestar pastas sem sair do painel.

### Added

- **The terminal client: `tuicano`.** The same team, channels, approvals, memory, routines and receipts as the window, drawn with Ink: twelve screens, the six dialogs, the three side panels, a composer, and the approval gate where a keypress decides — a high-risk call needs the same key twice, the terminal's stand-in for the press-and-hold the window asks for. `sh scripts/install-tui.sh` builds it and links it into `~/.local/bin`; a fresh folder starts empty and the client walks you through the first agent.
- **One core, two renderers.** The Electron window and the terminal are two renderers over one headless core and one shared application layer (`src/app`): the same state, the same event reduce, the same selectors and the same actions, so a new field or a new event reaches both. The core names no Electron at all — the machine it runs on is `src/host` (the app's utility process, or plain Node).
- **A daemon and one-shot commands.** `tuicano daemon` owns the data folder, the lock and a local socket (user-only, with a token), so several panes and a keybind share one team. `tuicano send`, `tuicano approvals`, `tuicano cli <method>` are what a script or a keybind calls; read-only ones attach and say so when nothing is listening.
- **Images, not placeholders.** kitty, iTerm2 and sixel behind one swappable transport, sized to the cell grid, with the text fallback always available — and the kitty path confirmed by eye in a real terminal.
- **Themes.** Eighteen palettes (Catppuccin, Kanagawa, Dracula, Darcula, Gruvbox, Nord, One Dark, Tokyo Night, Rosé Pine, Solarized, Everforest) on a semantic token interface: a palette is one file, a screen never names a colour, and the choice is the client's own (`Ctrl+T`, `--theme`, or `tuicano.config.json`).
- **A herdr plugin.** Actions and panes for a herdr workspace — a channel in a split pane, the approval card as a popup, a status one-shot, asking an agent with the selected text, lending a pane's folder — plus link handlers for `tucano://` URLs. It bridges to the daemon and never starts one.

### Changed

- **`package.json` is the fork's own**: the package is `tuicano`, and the publish and update target is this repository rather than upstream's, so a release can never land on someone else's repo.
- **Every user-facing string in the terminal is bilingual**, reusing the window's Portuguese, so the client speaks the workspace's language; what a script or a machine reads (`--graphics-info`, one-shot output, installer messages) stays English.
- **The attribution Apache-2.0 asks for** is in [NOTICE](NOTICE): this is a fork of `eduwxyz/tucano` with changes, and the areas that changed are listed there.

### Notes

- **The Electron window is upstream's** and is not maintained in this fork. It stays in the tree as the reference the parity contract is measured against, and as a later phase's removal candidate; `install.sh` and `install.ps1` install upstream's desktop app and say so.

## [0.2.0] - 2026-10-30

> **Em português:** o Tucano agora roda no Linux e no Windows. No Linux, em x64 e ARM64: `.deb` pro Ubuntu e o Debian, AppImage pras outras distribuições. No Windows 10 e 11, um comando no PowerShell instala sem pedir administrador e sem aviso do SmartScreen. Nos dois, ele se atualiza sozinho como no Mac, e ao fechar a janela fica na bandeja do sistema, com as rotinas rodando. O app passa a dizer "seu computador" em vez de "Mac". Obrigado ao Eduardo Souza pelo suporte ao Windows!

### Added

- **Linux.** A `.deb` (Ubuntu, Debian and their family) and an AppImage (other distributions), for x64 and ARM64, that update themselves like the Mac app. `install.sh` installs on Linux too. On Linux, Sign in opens your desktop's terminal, closing the window keeps Tucano in the tray so routines go on, Open at login works, passwords go to the system keyring (GNOME Keyring or KWallet, never stored without one), Docker computers give the files they write back to you, and the agents' browser uses Google Chrome or Chromium. ([#5](https://github.com/eduwxyz/tucano/pull/5), [#6](https://github.com/eduwxyz/tucano/pull/6))
- **Windows 10 and 11** (x64). In PowerShell, `irm https://github.com/eduwxyz/tucano/releases/latest/download/install.ps1 | iex` installs Tucano for your user, with no admin rights and no SmartScreen warning, and opens it; the installer is also in each release (it isn't code-signed). It updates itself like the Mac app. Harnesses installed with npm work, agents' commands on your PC run in Git Bash, Sign in opens a console, and closing the window keeps Tucano in the tray, by the clock. Thanks [@edusouza](https://github.com/edusouza)! ([#7](https://github.com/eduwxyz/tucano/pull/7), [#9](https://github.com/eduwxyz/tucano/pull/9))
- Tests run on macOS, Linux and Windows for every pull request. ([#4](https://github.com/eduwxyz/tucano/pull/4), [#9](https://github.com/eduwxyz/tucano/pull/9))

### Changed

- The app says "this computer" and "your computer" instead of the Mac, on every system. Agents are told their real system (macOS, Linux or Windows) and how things install there.
- A new install no longer touches the system's vault when it first opens: the GitHub proxy key is made when you connect GitHub.

## [0.1.2] - 2026-10-28

> **Em português:** o Tucano agora se atualiza sozinho. Esta é a última vez que você baixa uma versão nova à mão: daqui pra frente, ela chega em segundo plano e aparece **Reiniciar** na barra lateral. Também passa a rodar agentes no OpenCode 2 e a achar as skills que plugins do Claude Code declaram fora da pasta `skills/`. Obrigado ao Gian e ao Paulo pelas primeiras contribuições!

### Added

- **Updates itself.** Tucano looks for a new version on GitHub, downloads it in the background and shows **Restart** at the foot of the sidebar when it's ready. If you don't restart, it goes in the next time you quit. Restarting while an agent is working asks first. **Settings › General › Updates** shows your version and has **Check for updates**. This is the last update you install by hand. ([#3](https://github.com/eduwxyz/tucano/pull/3))
- **OpenCode 2.** The OpenCode harness now runs OpenCode 1 and 2, picked by the installed version, so upgrading OpenCode keeps your agents running. On OpenCode 2, agents use your own logins and your company gateway (in either config shape), see Tucano's tools, and count their tokens against their limits. Their sessions don't show up in your OpenCode history. Thanks [@paulo-oliveira-ifood](https://github.com/paulo-oliveira-ifood)! ([#2](https://github.com/eduwxyz/tucano/pull/2))
- **Plugin skills declared in the manifest.** Skills that a Claude Code plugin declares in `.claude-plugin/plugin.json` (`"skills": ["./"]`, as `blader/humanizer` does) now show up on the Skills page, alongside the plugin's `skills/` folder. Thanks [@GianCdM](https://github.com/GianCdM)! ([#1](https://github.com/eduwxyz/tucano/pull/1))

### Changed

- In the setup, harnesses that can't run yet (not installed, or not signed in) start unchecked. ([#2](https://github.com/eduwxyz/tucano/pull/2))

## [0.1.1] - 2026-10-28

> **Em português:** agora assinado e notarizado pela Apple. Baixe o .dmg e abra, sem aviso do macOS.

### Changed

- **Signed and notarized by Apple.** The .dmg opens with no macOS warning, and there's nothing to allow in System Settings.
- Updating from 0.1.0, macOS asks once more for the Keychain, since the signature changed. Click **Always Allow**.

## [0.1.0] - 2026-10-28

> **Em português:** a primeira versão pública. Um time de agentes de IA no seu Mac, que conversa em canais, usa as ferramentas da empresa e pede a sua aprovação antes de mexer no mundo real.

### Added

- First public release: a team of AI agents on your Mac that works in channels, like a work chat.
- Agents run on the Claude Code, Codex, OpenCode or Pi you already have, on your own subscription or your company's gateway.
- Each agent sees only the tools it was given (GitLab, Jira, Slack, Datadog, any MCP server), and anything sensitive waits for your approval of the exact call.
- Receipts and a monthly token limit per agent, reviewed memory, skills, routines on a calendar, and a computer and browser of its own for each agent.
- The app in Portuguese and English.

[0.2.0]: https://github.com/eduwxyz/tucano/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/eduwxyz/tucano/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/eduwxyz/tucano/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/eduwxyz/tucano/releases/tag/v0.1.0
