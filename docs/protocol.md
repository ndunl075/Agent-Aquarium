# Local event protocol v1

Custom agents can emit normalized facts using the companion CLI:

```sh
echo '{"version":1,"eventId":"delivery-unique-1","provider":"custom","sessionId":"real-session-1","actorId":"main","kind":"turn_started","occurredAt":1791763200000}' | agent-aquarium emit
```

Supply a unique event ID per fact, a stable real session ID per independent session, and Unix milliseconds in `occurredAt`. Retries reuse the same event ID. Child events use their real `actorId` and `parentActorId`. Never use repository paths as session identity. Read the schema in `packages/protocol/src` for exact field limits; unknown fields, event kinds and protocol versions are rejected. Only custom-provider events are accepted by `emit`.

Required fields: `version: 1`, `eventId`, `provider`, `sessionId`, `actorId`, `kind`, `occurredAt`. Optional fields: `parentActorId`, `toolUseId`, allowlisted `toolCategory`/`toolName`, safe project basename `projectLabel`, observed `contextUsedPercent` (0–100 or null), `contextSource`, and coarse `attentionReason`. Send no prompts, commands, source code, filenames, full paths, output, transcript locations or notification bodies. Context missing/null means Unknown.

Kinds: `session_started`, `turn_started`, `tool_started`, `tool_succeeded`, `tool_failed`, `attention_required`, `turn_completed`, `turn_failed`, `subagent_started`, `subagent_stopped`, `session_ended`, `context_updated`, `heartbeat`.

Desktop writes private `connection.json` with `{ "version": 1, "port": <ephemeral>, "token": <secret> }`. The CLI sends at most 16 KiB of normalized JSON to `POST http://127.0.0.1:<port>/events`, `Content-Type: application/json`, `Authorization: Bearer <token>`, with a 150 ms network deadline. No public query/control API or browser CORS access exists. Never print or share discovery tokens. Events deduplicate by event ID; producer timestamps are not a global ordering guarantee.

Storage is `%APPDATA%/Agent Aquarium` on Windows, `~/Library/Application Support/Agent Aquarium` on macOS, and `$XDG_CONFIG_HOME/Agent Aquarium` (or `~/.config/Agent Aquarium`) on Linux. `AGENT_AQUARIUM_DATA_DIR` overrides it consistently. App-down delivery uses a private bounded spool; the desktop is the only database writer. Importing `@aquarium/cli` library functions has no executable side effects. Diagnostics omit the token and event contents.
