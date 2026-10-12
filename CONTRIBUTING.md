# Contributing

Agent Aquarium is a free, local observation tool. Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing behavior. Preserve the full loop from lifecycle hook to safe normalized event to deterministic state to fish.

## Development

Use Node.js 22.12+ and pnpm 11.3.0. Install with `pnpm install --frozen-lockfile`; keep `pnpm-lock.yaml` committed when dependencies change. Run `pnpm check` before opening a pull request. Run `pnpm exec electron-rebuild -f -w better-sqlite3` before launching Electron with `pnpm dev` or `pnpm start` after `pnpm build`. Native SQLite needs different ABI builds for Node tests and Electron; restore the Node build with `pnpm rebuild better-sqlite3` before returning to tests.

Keep changes focused and describe the concrete behavior, validation performed, and any manual checks still outstanding. Include a sanitized screenshot for visual work and regression tests for reducer, transport, adapter, installer, or persistence behavior. Do not submit real transcripts or credentials as fixtures.

## Boundaries

- `packages/protocol`: strict versioned schemas and narrow IPC contracts; no Electron dependency.
- `packages/domain`: pure deterministic identity, lifecycle, and projection; no IO.
- `packages/adapters` and `packages/cli`: allowlist provider facts, fail open, preserve unrelated settings and hooks.
- Desktop main: loopback transport, one SQLite writer, local persistence, native lifecycle.
- Desktop renderer: accessible controls and fish presentation from domain snapshots; no Node privileges.

Never infer session identity from project paths, fabricate context metrics, or treat a completed turn as session end. All UI artwork and assets must be original or compatibly licensed. Architecture calls for Astra during visual design; the shipped app must use ordinary local assets and code without an AI runtime dependency.

## Security and dependencies

Do not add telemetry, remote runtime APIs, dynamic provider-code execution, arbitrary IPC, or transcript scraping. Keep normalized data minimal and treat imported events as untrusted. Dependency changes need a purpose, a compatible license, a lockfile update, and a vulnerability review using `pnpm audit` where available. Record unresolved findings and their actual applicability; a successful audit alone is not a security review.

If you discover a sensitive issue, avoid including tokens, private paths, or exploit details containing personal data in public issues. Share a minimal sanitized reproduction through the repository owner's available private contact channel when one is configured. There is no dedicated security reporting service promised by this repository.

## Release evidence

Use [docs/acceptance.md](docs/acceptance.md). Automated tests cannot establish real Claude Code five-session compatibility, clean-machine installer behavior, or frame rate on hardware that was never exercised. Record platform, versions, date, commands, and safe evidence for those checks before marking them complete. Keep release artifacts unsigned unless a maintainer explicitly configures signing credentials; no paid service is required for development or normal use.
