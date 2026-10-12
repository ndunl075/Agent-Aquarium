# Connecting local agents

Claude Code is the first integration. It uses supported lifecycle hooks; Agent Aquarium never reads transcripts, prompts, tool arguments, outputs, or raw commands. Separate real session IDs produce separate fish, including sessions in the same repository. Subagents appear only when Claude supplies an `agent_id`. A finished turn leaves its parent fish present. A failed tool does not imply a failed turn.

## Install and remove

Use the desktop **Connect Claude Code** preview and approve installation, or install the companion CLI from the same release. From a source checkout, run `pnpm build`, then `npm install --global ./packages/cli` to make `agent-aquarium` available on PATH. The CLI package bundles its dependencies; Node.js 22 or newer is required for the npm distribution. Desktop packages include a companion CLI and use their installed runtime paths.

```sh
agent-aquarium install claude          # previews only
agent-aquarium install claude --yes    # explicitly apply
agent-aquarium doctor
agent-aquarium open
agent-aquarium uninstall claude
```

Installation targets `~/.claude/settings.json` (`CLAUDE_CONFIG_DIR` overrides the directory). Existing hook matchers and other preferences remain intact. Each edit saves a sibling `settings.json.aquarium-backup-*` file and replaces settings atomically. Reinstallation is idempotent. Removal deletes only marked Aquarium command handlers, preserving subsequent unrelated edits. Malformed settings are left unchanged; restore a backup manually only after reviewing it. Restart or resume existing Claude sessions to load changes. Organization policies can prevent user hooks.

Hook commands have a two-second Claude timeout and a shorter internal deadline, always exit zero, and produce no output. Missing desktop, malformed input, stale discovery and transport failures cannot block an agent. Atomic per-event spool files hold at most 1,000 events / 10 MiB; contention may drop events. Attention and terminal events are retained preferentially. App startup drains the spool with receiver deduplication. Context remains Unknown until actual telemetry is supplied.

## Optional context bridge

```sh
agent-aquarium install claude --yes --status-line
```

This explicitly wraps the current status-line command. Its original stdin and stdout are preserved, with a bounded 700 ms execution timeout. No original command is invented when none existed. A private sidecar stores the prior configuration; uninstall restores it only while the current wrapper is still Aquarium's. Independently changed status lines are preserved, recursive Aquarium wrappers are refused. The bridge samples at most every two seconds per session and reads only `context_window.used_percentage`, never account rate-limit percentages. Missing/null values remain Unknown. Claude's update cadence can make metrics stale. Status-line commands that need longer than 700 ms should stay unwrapped.

Documentation verified against [Claude hooks](https://code.claude.com/docs/en/hooks) and [status-line JSON](https://code.claude.com/docs/en/statusline) on October 12, 2026. Installed older clients may expose fewer events; Agent Aquarium never infers unobserved activity. Optional Codex notification support has separate limits described below.

## Optional Codex completion notifications

A manually configured Codex CLI notifier can emit completed turns with real thread identity. This provides no active-work, tool, attention, context, subagent or session-end telemetry. See [Codex setup and verification limits](codex.md); automatic TOML editing and Desktop integration are not provided. The lifecycle integration above remains Claude-specific.
