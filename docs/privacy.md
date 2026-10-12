# Privacy and local data

Agent Aquarium observes lifecycle metadata on your computer. It requires no account and has no hosted event service, analytics SDK, remote logging, or AI inference dependency. Downloading dependencies and manually checking/downloading releases require internet access; observing agents and Demo Mode run locally.

## Data accepted

Normalized events contain a schema version, delivery ID, provider, real session/actor IDs, event kind and timestamp, optional tool-use ID/category and short tool name, safe project basename, documented attention category, and observed context percentage/source. Strict schema validation rejects unknown fields and oversized/invalid values before publication or storage.

Adapters copy only allowed fields. They do not retain raw provider stdin, prompts, raw commands, tool arguments/results, transcripts, source contents, notification bodies, or full working-directory paths. A basename can still reveal a project name, and opaque session IDs can be correlatable. Treat these as local private metadata.

## Storage and retention

The application stores SQLite state, preferences, discovery and spool files under `%APPDATA%/Agent Aquarium` on Windows, `~/Library/Application Support/Agent Aquarium` on macOS, and `${XDG_CONFIG_HOME:-~/.config}/Agent Aquarium` on Linux. `AGENT_AQUARIUM_DATA_DIR` can explicitly override the directory, for example to isolate testing. The companion uses local discovery and spool files to locate the running receiver and briefly buffer normalized events when it is unavailable. Do not share a discovery file because it contains a bearer token.

Default event history is seven days and session summaries thirty days, with configurable retention and a history-disable setting. The spool is bounded and drops older nonterminal activity first under pressure. Local diagnostic messages must stay sanitized and rotated. Clear Local Data removes aquarium history/state; it does not uninstall provider hooks or delete unrelated Claude Code settings. Use Uninstall Claude Code to remove Agent Aquarium's own hook entries. Settings backups made during installation remain local recovery artifacts and may contain unrelated user configuration; handle them privately.

File permissions restrict discovery/token files where the platform supports it. The app does not claim protection against other processes running with your own user privileges or a compromised operating system. SQLite and settings backups are not encrypted by the app; normal device and account protections apply.

## Local transport and desktop isolation

The HTTP receiver binds to IPv4 loopback `127.0.0.1` on an ephemeral port. Requests require an unpredictable bearer token, validated content type and bounded normalized JSON. Browser-origin/CORS access is rejected. The listener accepts events and provides no shell execution, arbitrary file reads, or remote-control API.

The renderer uses local compiled assets, a restrictive content security policy, context isolation, and a narrow schema-checked preload bridge. It has no direct database, filesystem, or provider-process access. Provider strings are data, never HTML or executable code.

## Capture and metrics

Capture Mode masks sensitive identifiers and project/session labels in the tank UI. Inspect an exported image before sharing it; it cannot hide unrelated windows or content outside the aquarium. Screenshots are saved locally when requested.

Context usage is shown only when supplied by observed telemetry. Missing and null values are Unknown. Old samples can be stale. Context percentage is unrelated to account rate limits, spend, or lifetime tokens. An optional status-line bridge must be explicitly enabled and preserve existing output; no transcript parsing is used to fill gaps.

## Your agent keeps working

Hook forwarding is best effort and fail open. An unavailable aquarium, invalid payload, damaged queue item, or local transport error must not block or reject the observed agent's work. Agent Aquarium does not change permission decisions, prompts, tool execution, or model outputs. Review and approve the hook preview before installation; uninstall removes only aquarium-owned entries.

Windows portable builds retain a versioned Node companion, its license, and content-addressed CLI scripts under `userData/companion/`. These contain application code, not agent history, and remain after Clear Local Data so installed hooks continue failing open while the desktop is closed. Older companion scripts remain to keep previously installed hook paths valid; uninstall provider hooks before manually removing this folder.
