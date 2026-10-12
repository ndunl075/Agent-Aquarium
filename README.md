# Agent Aquarium

A local desktop aquarium for your coding agents. Each observed session gets its own fish, including several sessions in the same repository. Real lifecycle events drive the fish; the tank stays on your machine and runs without an account, subscription, hosted database, or AI service.

Built with Electron, React, PixiJS, TypeScript, Zod, and SQLite. Windows is the first packaging priority, with macOS and Linux build paths. The project is MIT licensed.

## Run from source

Install Git, Node.js **22.12 or newer**, and **pnpm 11.3.0**. Native SQLite compilation may require a C++ toolchain: Visual Studio Build Tools on Windows, Xcode command-line tools on macOS, or a compiler and Python on Linux. Dependency installation requires internet access; normal aquarium operation does not.

```sh
git clone https://github.com/ndunl075/Agent-Aquarium.git
cd Agent-Aquarium
pnpm install --frozen-lockfile
pnpm check
pnpm exec electron-rebuild -f -w better-sqlite3
pnpm dev
```

`pnpm check` runs type checking, unit/integration tests, and the production build. Tests use your **Node** runtime; the desktop app uses **Electron**. SQLite is a native module, so its binary must match the runtime in use. Run tests before rebuilding it for Electron. When returning to tests after a desktop rebuild, run `pnpm rebuild better-sqlite3` first; if the existing binary remains unchanged, reinstall/rebuild the dependency for Node using your platform's native build tools. A module-version/ABI mismatch is a build issue, not damaged aquarium data.

`pnpm dev` starts the local Vite development server and Electron. The development server is a development tool; packaged builds contain local compiled assets. To launch a production build locally:

```sh
pnpm build
pnpm exec electron-rebuild -f -w better-sqlite3
pnpm start
```

## Connect an agent

Open **Connect Claude Code** in the tank, review the hook preview, and approve installation. Agent Aquarium backs up your settings and merges its own hooks into the existing configuration. Restart or resume existing Claude Code sessions after installing hooks. Start five independent Claude Code sessions to see five independent fish, even in one project.

The companion CLI also provides setup, removal, diagnostics, hook forwarding, and custom event ingestion. From a source checkout:

```sh
pnpm cli install claude
pnpm cli install claude --yes
pnpm cli doctor
pnpm cli uninstall claude
```

Hook commands are notifications only: they do not approve tools, alter prompts, or direct the observed agent. Missing desktop app or malformed input must fail open. See [integration details](docs/integrations.md) and [the event protocol](docs/protocol.md).

`install claude` previews only; `--yes` applies the reversible settings change. Add `--status-line` only when explicitly enabling the optional context bridge. `agent-aquarium emit --help` explains normalized custom-event input.

After `pnpm build`, install the bundled, dependency-free Node companion from the checkout with `npm install --global ./packages/cli`. The resulting command is `agent-aquarium`; it still requires Node.js 22+. Alternatively run `npm pack` inside `packages/cli` and install that local tarball. Maintainers must publish a verified version before registry installation can be promised. Do not copy development-machine executable paths into another user's settings. Packaged installations must use their own bundled companion or a verified globally installed CLI.

## What the tank shows

- A distinct fish per parent session, plus child fish when a real provider subagent ID is available.
- Started, working, tool activity, attention, completed turn, failed turn, stale, and ended states. A finished turn leaves its fish present; only an ended session retires it after linger.
- A safe inspector with provider, project basename, last activity, tool category, and context usage **only when observed**. Missing/null context is Unknown, never an invented zero.
- A clearly marked offline Demo Mode with five simulated agents, Capture Mode, reduced motion, compact window mode, and configurable desktop preferences.
- A local authenticated event receiver, bounded spool, local history, and reversible Claude Code hooks.

Claude Code is the initial integration. Codex is not advertised as a production integration without client/version-specific verification. The custom event protocol is available for explicitly authored integrations. A status-line bridge is optional; lifecycle hooks alone do not supply dependable context percentages.

## Build installers

```sh
pnpm package:win
# Run on the target platform:
pnpm package --mac
pnpm package --linux
```

Packaging runs the production build and uses electron-builder. Prefer native platform builds for native dependencies. Windows targets include an installer and portable distribution; the packaging configuration is the source of truth for architecture and platform targets. Workflow artifacts are build outputs, not proof of clean-machine validation. Unsigned binaries can trigger operating-system warnings; signing and notarization are not configured as a paid prerequisite.

The manual **Package desktop** GitHub Actions workflow checks the source, rebuilds SQLite for Electron, and uploads platform artifacts. It does not automatically publish a release. See [release acceptance](docs/acceptance.md) before distributing binaries. Builds, tests, and manual package commands also work locally without GitHub Actions.

## Privacy and trust

Events contain allowlisted lifecycle metadata. Agent Aquarium does not read transcripts, source files, prompts, commands, or raw tool inputs/outputs. The receiver listens on `127.0.0.1`, requires a private bearer token, rejects browser-origin requests, and exposes ingestion rather than remote control. Renderer access uses a narrow isolated preload API.

Project basenames and session identifiers can still be sensitive. Use Capture Mode before sharing an image. Settings, normalized events, and bounded history stay local; Clear Local Data removes aquarium history. See the [privacy document](docs/privacy.md) for storage, retention, hook backups, and limits.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [ARCHITECTURE.md](ARCHITECTURE.md). The acceptance checklist separates automated evidence from manual real-agent and clean-install checks. Performance figures in the architecture are targets until measured on a recorded machine.
