# Codex CLI: optional completion notifications

This adapter supports **completed turns only** through the documented Codex CLI `notify` setting. It receives a real thread ID, so independent threads can appear as distinct fish. It does not observe session start/end, active work, tool use, permission requests, subagents or context usage. A fish appears after the first observed completed turn, then may become stale. Missing metrics remain Unknown. This integration is deliberately narrower than Claude lifecycle hooks.

The [official OpenAI notification documentation](https://learn.chatgpt.com/docs/config-file/config-advanced#notifications) specifies an external program invoked with one JSON argument. The adapter copies only `type`, `thread-id`, optional `turn-id`, and a sanitized basename from `cwd`. It discards `input-messages`, `last-assistant-message`, and all unknown fields. When `turn-id` is present, retries deduplicate using a hash of thread and turn identity. When absent, deliveries receive unique IDs because no reliable turn identity can be invented.

## Explicit manual setup

Build/install the companion CLI from the same release first. Find your installed `node` executable and bundled `packages/cli/dist/bin.cjs`; use absolute installed paths. Add the following **top-level** key to your Codex `config.toml` only after reviewing any existing `notify` configuration:

```toml
# Replace these paths with your installed Node executable and companion bundle.
notify = ["C:/Program Files/nodejs/node.exe", "C:/tools/agent-aquarium/bin.cjs", "hook", "codex"]
```

macOS/Linux use the same array with their actual Node and bundle paths. Codex appends the JSON notification argument. Do not put private notification contents in a shell command manually. Do not use a Windows npm `.cmd` shim as the executable; invoking Node directly avoids shim and path-quoting ambiguity.

Agent Aquarium does not automatically edit TOML or replace a preexisting notifier. If you already use `notify`, retain it until you explicitly compose and review a separate wrapper; automatic chaining is not provided. Back up the configuration before editing. Remove only the line you added to disconnect, restoring your original notifier if applicable. Restart or resume CLI sessions as needed. The desktop's **Connect Claude Code** flow does not install this optional adapter.

Notifications reach the same authenticated loopback/spool pipeline as Claude events. The hook is silent, fail-open, bounded to 1.2 seconds, and discards malformed or oversized input. Codex's documented transport places raw JSON in process arguments; Aquarium cannot prevent same-user process inspection of provider-created arguments, but it never logs or persists the private fields. Claude continues to use stdin.

## Verification limits

Verified on October 12, 2026: fetched the official OpenAI documentation and checked installed `codex-cli 0.159.3` version/help. Unit fixtures verify strict allowlisting, documented event mapping, stable session identity and deduplication. No paid inference or real Codex turn was launched for this check. The installed CLI's `features` subcommand does not support `--strict-config`, so that command cannot establish notify compatibility. A real configured completion remains a manual acceptance check for the exact target CLI/version. No support is claimed for Codex Desktop, remote daemons, plugin lifecycle events or private app internals.
