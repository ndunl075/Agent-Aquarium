# Agent Aquarium — Product & Technical Architecture

**Status:** Implementation handoff / source of truth  
**Version:** 1.0  
**Updated:** 2026-10-12  
**Repository:** https://github.com/ndunl075/Agent-Aquarium  
**Target:** Free, open-source, local-first Windows/macOS/Linux desktop application

> **Mandatory UI implementation note: Use Astra for the UI.** When building the product, use **Astra** for visual design and frontend implementation: aquarium scene, fish illustrations, animations, layout, onboarding, and visual polish. The finished product must run entirely from ordinary compiled assets and code; **Astra and other AI services must not be runtime dependencies**. Do not add paid API calls or require users to own an Astra subscription.

---

## 1. Product definition

Agent Aquarium turns concurrent AI coding-agent sessions into a living, animated aquarium. Each observed agent gets its own fish. Its provider, activity, tool use, context-window usage (when available), and execution status determine how the fish behaves.

**Core demo:** Open five independently running supported agents and see five independent fish moving around the same tank, each reacting to what its real agent is doing.

This is a developer utility with a deliberately playful visualization, **not** an AI coding agent, agent orchestrator, or game that fabricates activity.

### Core user flow

1. Install/open Agent Aquarium.
2. Select **Connect Claude Code** and approve installation of small lifecycle hooks.
3. Start one or more Claude Code sessions in terminals or supported hosts.
4. A fish appears for each session. The aquarium responds to activity in near real time.
5. Select a fish to see its safe, minimal status details.
6. When an agent needs attention, its fish signals that state without interrupting the actual work.
7. When a turn finishes, the fish celebrates; when the session ends, it leaves after a short configurable linger.
8. Optionally use Mini Tank, Always on Top, Demo Mode, or Capture Mode.

### Product rules

- **Completely free to use:** no subscriptions, hosted databases, metered APIs, logins, telemetry services, or LLM calls.
- **Open source:** choose a standard license (MIT is recommended), add a LICENSE file before the first release, and use dependencies with compatible licenses.
- **Local first:** events, settings, fish customizations, and history stay on the user's machine.
- **Non-invasive:** observation only; never change the prompt, tool execution, output, permissions, or lifecycle of the observed coding agent.
- **Truthful:** never claim live context usage, thinking state, approvals, or tool results that the provider does not actually expose.
- **Low friction:** a first-run setup button and a documented CLI are preferable to editing configuration files by hand.
- **Visual quality matters:** the aquarium must be entertaining and legible even when no session is active.
- **Support multiple sessions:** do not reduce all instances of a provider to one fish.

## 2. Release scope and non-goals

### MVP (must ship)

- Cross-platform local desktop tank, with **Windows as the first packaging and QA priority**.
- Reliable local event pipeline and schema validation.
- Claude Code integration through supported lifecycle hooks.
- One unique fish per concurrent parent session, including multiple sessions in the same repository.
- Optional subagent fish where real subagent identifiers/events are present.
- Live behavior for started, working, tool use, needs-attention, completed turn, failed, stale, and ended.
- Distinctive fish illustrations, smooth motion, particles, readable state indicators, and stable positioning.
- Fish inspector (provider, safe session label, project basename, current state, last activity, last tool category, known context percentage).
- Configurable sound, notifications, reduced motion, default tank size, and Always on Top.
- Persistent local preferences and limited session history.
- One-click hook installation/removal, backup/restore, and diagnostics.
- Offline Demo Mode with five simulated agents, explicitly identified as simulated.
- Privacy-aware screenshot/capture mode with filenames, prompts, commands, and paths hidden.
- No network/account requirement and no paid services.

### V1 follow-ups

- Better context usage through an **opt-in status-line bridge**.
- Codex adapter, **only using integration surfaces verified for the target Codex client/version**.
- Custom agent adapter and documented ingestion protocol.
- Mini Tank dock, tray menu, hotkeys, and more fish/tank customization.
- Optional local screenshot/GIF export if it can be shipped without a paid dependency.

### Explicit non-goals

- Launching, directing, or controlling coding agents.
- Reading transcripts, source files, tool arguments, raw commands, prompts, or secrets.
- Pretending to have precise per-agent token or context metrics from hooks alone.
- Multi-device cloud sync, collaborative tanks, public profiles, or a hosted backend.
- Financial/account usage reporting or token billing estimates.
- Requiring an AI model at runtime.
- Scraping inaccessible desktop-app internals or promising integration across every provider at launch.

## 3. Proposed technology stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Desktop host | **Electron + TypeScript** | Mature Windows/macOS/Linux shell, tray/window control, cross-platform Node runtime, desktop packaging |
| Renderer UI | **React + Vite + TypeScript** | Standard, testable app architecture |
| Aquarium canvas | **PixiJS** | Efficient GPU-accelerated 2D drawing, sprites, effects, and animation |
| State management | **Zustand** or a small typed store | Subscription to narrow UI state slices |
| IPC contracts | **Zod + TypeScript** | Runtime input validation and shared schemas |
| Local event receiver | **Node HTTP server in Electron main process** | No backend to host, easy CLI-to-desktop connection |
| Event forwarding CLI | **Node/TypeScript command-line package** | Hooks can forward structured event JSON from stdin |
| Persistence | **SQLite** (better-sqlite3 with Electron rebuild) | Durable local sessions, bounded event history, migrations |
| Styling | **CSS variables + scoped CSS** | Precise visual control without heavyweight component/dashboard systems |
| Unit/integration tests | **Vitest** | Reducer, adapters, installer, schema, persistence tests |
| Desktop E2E tests | **Playwright Electron support** where applicable | End-to-end flows and capture tests |
| Package manager | **pnpm workspaces** | Shared types and deterministic lockfile |
| Packaging | **electron-builder** | Windows, macOS, Linux installable artifacts |
| CI | **GitHub Actions** | Public-repo testing/builds; local builds also supported |

Use supported current package versions, lock dependencies, and verify native SQLite module compatibility with packaged Electron. Prefer built-in features to dependencies. Do not add a web server deployment, cloud worker, Firebase/Supabase, paid monitoring service, or hosted database.

### Why a desktop app instead of a hosted web app?

The data originates in **local** coding-agent processes. The desktop app can receive local events, manage a floating tank, work offline, and enforce a single on-device source of truth. A remote dashboard adds cost, credentials, latency, and privacy concerns without improving the core use case.

## 4. System architecture

~~~mermaid
flowchart LR
  CC["Claude Code sessions + subagents"] --> H["Lifecycle hooks"]
  SL["Optional Claude status line"] --> B["Opt-in metrics bridge"]
  CA["Future Codex / custom adapters"] --> CLI["Agent Aquarium CLI"]
  H --> CLI
  B --> CLI
  CLI -->|Authenticated POST over 127.0.0.1| RX["Electron main: receiver"]
  CLI -->|App unavailable: bounded local spool| SP["Local spool"]
  SP --> RX
  RX --> V["Validate + normalize + deduplicate"]
  V --> R["Per-agent state reducer"]
  V --> DB[("Local SQLite")]
  R --> DB
  R -->|Typed, narrow IPC snapshots/deltas| UI["React app state"]
  UI --> PX["PixiJS aquarium renderer"]
  UI --> INS["Fish inspector + settings"]
  PX --> OUT["Live fish + readable status"]
~~~

### Process boundaries

**Provider process:** Claude Code, Codex, or a custom agent executes on its own. Agent Aquarium never runs in the agent's prompt or tool context.

**Hook adapter:** A lightweight, best-effort notification process reads a provider-supplied event from stdin, copies only an approved list of fields, and sends the normalized event locally. It always exits successfully and never prints instructions to the agent.

**Electron main:** Owns the port, auth token, singleton lock, SQLite, normalized data, process/window lifecycle, notification permission, and narrow IPC channel. There is exactly one SQLite writer.

**Electron renderer:** Owns UI and fish simulation; no filesystem/OS/network privileges. It receives normalized snapshots and small state changes through an isolated preload API.

**Optional spool:** Local, bounded, atomic holding area for brief periods when the UI isn't open. Not a cloud queue.

## 5. Event pipeline and transport

### 5.1 Listener lifecycle

1. Electron obtains a **single-instance lock**.
2. It generates a random per-installation bearer token on first run and saves it with user-only permissions where supported.
3. It binds an HTTP server to **127.0.0.1**, using an OS-assigned ephemeral port. Do not bind 0.0.0.0.
4. It atomically writes a small discovery file under application data containing the port, protocol version, and token (user-only permissions where supported).
5. CLI reads the discovery file, sends a bounded JSON POST with a short timeout, and exits.
6. On shutdown it removes or invalidates the discovery file; stale discovery information must be handled.
7. Startup drains queued spool records, deduplicating before applying.

The local HTTP server is **ingest-only**. Do not expose arbitrary query, command-execution, file access, or remote-control endpoints. Require a bearer token, reject invalid methods and unexpected content types, enforce a small payload cap (e.g. 16 KiB of **normalized** JSON), and check protocol version.

The receiver must reject untrusted browser origins and CORS access. The Electron renderer should read via preload IPC, **not** by consuming the loopback HTTP endpoint.

### 5.2 Hook CLI behavior

Recommended CLI commands:

~~~text
agent-aquarium install claude
agent-aquarium uninstall claude
agent-aquarium doctor
agent-aquarium open
agent-aquarium hook claude
agent-aquarium status-bridge claude
agent-aquarium emit --help
~~~

- The hook entry point consumes **one JSON object from stdin**, never command-line arguments containing private tool data.
- Extract only session IDs, actor IDs, event type, tool name/category, safe project name, and coarse state metadata.
- Do not record user prompts, raw tool inputs/outputs, transcript contents, command strings, or notification message bodies.
- Keep the hook short-lived. No retries that block the agent.
- When Electron isn't running, a **best-effort** bounded spool or opt-in auto-open strategy is allowed.
- Only session-start / user-prompt events may initiate an auto-open, with a global rate limit to avoid opening a window on every tool call.
- Transport/serialization errors are local diagnostics only; the hook must **fail open** with exit code 0 and no provider-facing messages.
- Limit spool count and total bytes (e.g. 1,000 events / 10 MiB). Drop oldest nonterminal activity before terminal/waiting events when full.
- Use atomic per-event files or a concurrency-safe append mechanism. Never let two hook processes corrupt a shared log.

### 5.3 Typed, provider-agnostic event schema

All providers map to one versioned schema, validated **before** storage or UI publication.

~~~ts
type Provider = "claude-code" | "codex" | "custom";

type AgentEventKind =
  | "session_started"
  | "turn_started"
  | "tool_started"
  | "tool_succeeded"
  | "tool_failed"
  | "attention_required"
  | "turn_completed"
  | "turn_failed"
  | "subagent_started"
  | "subagent_stopped"
  | "session_ended"
  | "context_updated"
  | "heartbeat";

type ToolCategory =
  | "read"
  | "write"
  | "shell"
  | "test"
  | "search"
  | "delegate"
  | "other";

interface AquariumEventV1 {
  version: 1;
  eventId: string;            // Unique delivery/dedup ID
  provider: Provider;
  sessionId: string;          // Real session identity, not just repo path
  actorId: string;            // Parent = "main"; subagent = provider agent ID
  parentActorId?: string;     // For nested/subagent fish
  kind: AgentEventKind;
  occurredAt: number;         // Unix milliseconds, local producer clock
  toolUseId?: string;         // Pair tool_start with tool_finish where available
  toolCategory?: ToolCategory;
  toolName?: string;          // Sanitized short allowlisted name
  projectLabel?: string;      // Sanitized basename; never a raw path
  contextUsedPercent?: number | null; // Only from observed telemetry
  contextSource?: "statusline" | "provider" | "unknown";
  attentionReason?: "permission" | "input" | "other";
}
~~~

**Identity:** Parent fish key is provider + session ID + "main". Subagent fish key is provider + session ID + real subagent ID. Two agents in the **same repository** are still two fish. Never use project name, working directory, window title, or model name as the unique session key.

**Payload rules:** Reject blank/oversized IDs, unknown event kinds, unknown schema versions, percentages outside 0–100, invalid timestamps, and raw strings longer than their allowlisted field limits. Sanitize displayed names and do not interpret any field as HTML or code.

**Ordering:** Hook invocations may arrive out of order. Deduplicate on eventId; pair tool lifecycle using toolUseId when available; preserve per-actor latest event timestamps; prevent late tool events from overwriting a newer completed/ended state. Store timestamps and a local ingestion sequence for reproducibility. Do not mistake clock order for a globally guaranteed ordering protocol.

### 5.4 App-to-renderer contract

Expose a minimal, context-isolated API:

~~~ts
interface AquariumDesktopAPI {
  getSnapshot(): Promise<AquariumSnapshot>;
  onDelta(callback: (delta: AquariumDelta) => void): () => void;
  updatePreferences(patch: PreferencesPatch): Promise<void>;
  installProvider(provider: "claude-code"): Promise<InstallResult>;
  uninstallProvider(provider: "claude-code"): Promise<InstallResult>;
  getDiagnostics(): Promise<SafeDiagnostics>;
  activateDemoMode(enabled: boolean): Promise<void>;
  setWindowMode(mode: "full" | "mini"): Promise<void>;
}
~~~

Every channel is allowlisted and schema-checked. No generic "execute shell", "read file", or "invoke arbitrary IPC" bridge.

## 6. Claude Code integration (MVP)

Use Claude Code's **documented lifecycle hooks**, never transcript scraping or modification of the model prompt.

Reference: https://code.claude.com/docs/en/hooks

| Claude Code event | Normalized event | Required behavior |
| --- | --- | --- |
| SessionStart | session_started | Create or resume the parent fish |
| UserPromptSubmit | turn_started | Start purposeful swimming / working mode |
| PreToolUse | tool_started | Show tool-type activity; record toolUseId if present |
| PostToolUse | tool_succeeded | Complete that tool animation and resume working |
| PostToolUseFailure | tool_failed | Brief error visual; remain in active turn unless another event changes status |
| Notification or PermissionRequest | attention_required | Only mark waiting when event type really signifies input/approval |
| SubagentStart | subagent_started | Create child fish, linked to parent |
| SubagentStop | subagent_stopped | Complete and retire the identified child fish |
| Stop | turn_completed | Turn is done; parent fish **remains present** |
| StopFailure | turn_failed | Display an error without claiming the session has ended |
| SessionEnd | session_ended | End the session and retire fish after linger |

Optional post-MVP events include task creation/completion, compaction, provider-specific diagnostics, and more granular lifecycle updates.

### 6.1 Hook installation

The installation workflow must:

1. Detect the user's Claude Code settings location for the OS and inspect current settings safely.
2. Offer a preview of the precise hook configuration to be added.
3. Back up existing settings before editing.
4. **Merge** with existing hooks, matchers, and user preferences; never replace their entire hooks object.
5. Install fixed commands that invoke the Agent Aquarium CLI; quote the executable path safely on Windows/macOS/Linux.
6. Be idempotent: installing twice must not create duplicate handlers.
7. Set appropriate short timeouts or supported asynchronous delivery, and never use hook output to block actions or add model context.
8. Validate the resulting settings file; roll back the edit if validation fails.
9. Provide exact reversible uninstall of **only Agent Aquarium's own entries**.
10. Tell users that already-running sessions may need to restart/resume before all hooks apply.

Claude Code supports command hooks and asynchronous hooks, but the implementation must check the currently supported schema and input behavior before generating config. Avoid changing the user's prompt, tool permission policy, or other hooks.

### 6.2 Context-window usage: opt-in bridge, not a guess

Lifecycle hooks **do not guarantee a real-time context-window percentage**. Claude Code's documented status-line JSON includes context-window usage fields, including a percentage that may temporarily be null.

Reference: https://code.claude.com/docs/en/statusline

**Default MVP:** show context as **Unknown** when the provider hasn't supplied it. Fish still animate based on observed lifecycle activity.

**Opt-in V1:** an Agent Aquarium status-line bridge reads status-line JSON from stdin, extracts session ID and context_used_percentage, emits a throttled context_updated event, and preserves the user's existing status-line behavior and output. Implement carefully:

- Never silently overwrite another status line.
- Preserve and restore a preexisting status-line command on uninstall; avoid recursive wrappers.
- Document that status-line fields can be absent/null and data can update less often than hooks.
- Never confuse context-window percentage with rate-limit usage, account spend, or lifetime token count.
- When metric input is unavailable, retain the last value with a visibly stale indicator or display Unknown, rather than inventing 0%.

Do **not** parse private transcripts just to fill a number.

### 6.3 Provider capabilities

Each provider adapter declares its actual capabilities:

~~~ts
interface ProviderCapabilities {
  sessions: boolean;
  toolLifecycle: boolean;
  attention: boolean;
  subagents: boolean;
  contextPercentage: "none" | "optional" | "reliable";
  guaranteedSessionEnd: boolean;
}
~~~

UI must honor capability differences. Do not show a fake progress ring because another provider happens to offer better telemetry.

## 7. Codex and custom provider architecture

Build an adapter interface **now**, but do not label Codex as a supported production integration until tested against the specific CLI/desktop client.

~~~ts
interface ProviderAdapter<RawEvent> {
  readonly id: Provider;
  readonly capabilities: ProviderCapabilities;
  normalize(raw: RawEvent): AquariumEventV1 | null;
  install?(): Promise<InstallResult>;
  uninstall?(): Promise<InstallResult>;
  doctor?(): Promise<SafeDiagnostics>;
}
~~~

Suggested rollout:

1. Claude Code lifecycle hooks: fully supported MVP.
2. Codex: examine current, documented supported local hooks, app-server streams, and/or plugin interfaces. Prefer user-authorized local integrations. A turn-complete-only signal should **not** be labeled as full tool telemetry.
3. Custom adapter: document the versioned local emit command and example provider bindings. Encourage community contributions.
4. Other IDE agents: add only when they expose a stable, permissioned event source; never implement screen scraping as the default.

Useful OpenAI documentation for future Codex integration: https://developers.openai.com/plugins/build/plugins and https://developers.openai.com/learn/codex .

## 8. Agent lifecycle and deterministic state machine

### 8.1 Domain states

~~~ts
type AgentStatus =
  | "starting"
  | "working"
  | "using_tool"
  | "waiting"
  | "turn_done"
  | "error"
  | "stale"
  | "ended";
~~~

State is derived **only from events + elapsed time**, never from frame-by-frame simulation.

| Incoming fact | Domain transition | UI depiction |
| --- | --- | --- |
| Session started | starting | Fish enters tank |
| User turn started | working | Swim with intentional routes |
| Tool started | using_tool | Category-specific animation |
| Tool succeeded | working | Small completion ripple |
| Tool failed | error overlay, then working if still active | Short wobble + alert bubble |
| Needs permission/input | waiting | Hover by front glass, subtle attention indicator |
| Turn completed | turn_done | Small victory loop, then relaxed idle |
| Turn failed | error | Caution-colored bubbles / worried motion |
| Session ended | ended | Graceful swim offscreen; archive state |
| Missing updates beyond timeout | stale / unknown activity | Muted, not declared finished |
| Subagent spawned | child starting | Smaller linked fish joins |
| Subagent stopped | child ended | Child fish exits independently |

### 8.2 Reducer rules

- **Stop is not SessionEnd.** A completed turn leaves the session fish in the tank.
- Completion and tool failure should be distinct; a failed tool does not imply the entire turn failed.
- "Waiting" should only occur for a documented attention-required input, not every notification.
- Tool completion with the wrong toolUseId must not close a different in-flight tool.
- A new turn can resume a fish from turn_done or error.
- After a configurable grace period (default 2 minutes) without new events, mark as **stale/unknown**, not definitely inactive or terminated; model inference can take time.
- A stale fish returns to the correct live state on the next observed event.
- A session_ended state is terminal for that session lifecycle; a later legitimate resume is a new/explicitly resumed lifecycle, not a stale tool event resurrecting an ended fish.
- Deduplication means at-least-once local delivery does not duplicate visual actions.
- Child fish are tied to exact child identifiers; do not invent individual subagents from a single parent tool call.

### 8.3 Motion should explain real activity

| Activity | Fish behavior | Effect |
| --- | --- | --- |
| Thinking/working (derived from active turn) | Calm, curious, continuous swimming | Soft motion trails |
| Reading/searching | Inspects plants, rocks, or objects | Small discovery bubbles |
| Writing/editing | Moves to coral/construction area | Pixel/bubble "building" particles |
| Shell commands | Brief purposeful dart | Speed streak |
| Tests/build | Zigzag course or jump through a bubble ring | Success/failure ring |
| Delegating | Nearby school forms | Child fish enters |
| Permission/input needed | Comes to glass, waits | Clear attention symbol |
| Successful turn | Short victory spin | Celebratory bubbles |
| Failed turn | Slows/wobbles briefly | Error pulse |
| No event data | Gentle ambient swimming | No implied metrics |

Animation categories are explanatory, not literal execution details. Fish should have personalities and species variation but identical underlying state semantics.

## 9. Aquarium visual system — **Astra owns UI quality**

**Use Astra for the frontend design and implementation pass.** Give Astra this architecture, ask it to establish a distinctive cohesive visual direction, build the React/Pixi interface, and refine motion and microinteractions. Prioritize the result over generic component-library scaffolding. Astra is a **development-time tool only**.

### Design direction

- A beautiful **2D animated desktop aquarium**, not a SaaS analytics dashboard.
- Clear glass/water feeling; subtle layered depth, aquatic plants, rocks, bubbles, fish shadows, and caustic lighting.
- Fish should look like recognizable fish (personality, fins, tails, eyes), not colored circles with icons.
- Stylized vector/pixel-inspired art is fine if it is consistent and polished; avoid unlicensed assets.
- Restrained chrome and minimal text; the actual aquarium is the hero.
- Status must be understandable without color alone.
- Cozy and fun enough to keep open while coding, yet visually clean enough for short screen-recorded demos.
- Responsive to compact floating windows, ultrawide monitors, and different DPI settings.

### Screen inventory

**Full Tank:** aquarium fills most of the window; small title/controls overlay; subtle active-agent count and status filters.

**Fish Inspector:** clicking a fish opens a lightweight side sheet with fish name, provider, session/project label, current activity, context usage only if known, and last seen timestamp. No raw prompts, code, shell commands, or transcripts.

**Mini Tank:** frameless-ish, resizeable compact window (subject to OS usability requirements), optionally always on top. Show fish plus discreet waiting/done badges.

**Onboarding:** first launch with "Connect Claude Code", permission explanation, install button, test-event confirmation, "Try Demo Mode", and uninstall link.

**Settings:** sound, notifications, always-on-top, FPS/battery-saving mode, tank theme, reduced motion, privacy mode, provider connections, history retention, diagnostics.

**Capture Mode:** hide private identifiers and clutter while retaining fish, status, and water motion; offer a local screenshot export, with recording/GIF export optional later.

**Demo Mode:** one-click staged scene with **five clearly labeled simulated agents** moving through distinct roles (read, edit, test, delegate, waiting, complete). No provider setup required.

### Fish design

- Procedural or locally bundled sprites/meshes with defined head/body/tail/fin components.
- Deterministic fish identity from a stable hash of provider + session ID; store optional user-custom color, species, name, and accessories.
- Idle, cruise, sprint, inspect, celebrate, await, error, enter, and exit motion clips.
- Additional state overlay (not pure color) for permission/waiting and errors.
- Parent/child linkage can be conveyed through coordinated school behavior.
- Context percentage, when **actually available**, can affect a subtle bubble trail or water aura intensity. If unavailable, use a neutral trail; never pretend an inferred percentage is real.

### Rendering design

- PixiJS manages fish actors, particles, decorative layers, and deterministic animation.
- React manages settings, inspector, labels, onboarding, and accessible controls.
- Renderer reads domain snapshots; it **does not** make state decisions based on agent event payloads.
- One shared animation loop; no React rerender on every animation frame.
- Seed random motion per fish for reproducible demo/test behavior.
- Keep animated entity allocations/pools bounded and reuse sprites/particles.
- Render with proper delta-time handling; cap delta after tab suspension.
- Reduce updates when hidden or on battery-saving mode.
- On GPU failure, show a usable accessible static fish/session list instead of a blank window.
- Honor OS reduced-motion preferences; disable intense flashes and reduce particles.

### Sound and notifications

- Optional quiet bubbles/tank ambience, **off by default**.
- Distinguishable subtle sounds for needs-attention and turn completion, both configurable.
- Native desktop notification only for actual attention-required or completed-turn events and only with permission.
- Rate limit notifications; no pop-up storm from repeated hooks.
- Never bring the aquarium to the foreground on every tool event.

## 10. Persistent data model

Default storage under Electron's per-user application data directory.

~~~text
userData/
  aquarium.db
  connection.json        # loopback discovery/token; restrict permissions
  spool/                 # bounded, atomic event files
  logs/                  # local sanitized diagnostics, rotating
~~~

Suggested SQLite tables:

~~~sql
CREATE TABLE sessions (
  session_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_session_id TEXT NOT NULL,
  project_label TEXT,
  started_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,
  ended_at INTEGER,
  latest_status TEXT NOT NULL
);

CREATE TABLE agents (
  actor_key TEXT PRIMARY KEY,
  session_key TEXT NOT NULL REFERENCES sessions(session_key),
  provider_actor_id TEXT NOT NULL,
  parent_actor_key TEXT,
  display_name TEXT,
  species TEXT,
  color_variant TEXT,
  last_status TEXT NOT NULL,
  context_used_percent REAL,
  context_source TEXT,
  context_observed_at INTEGER
);

CREATE TABLE events (
  event_id TEXT PRIMARY KEY,
  actor_key TEXT NOT NULL REFERENCES agents(actor_key),
  kind TEXT NOT NULL,
  tool_category TEXT,
  tool_use_id TEXT,
  occurred_at INTEGER NOT NULL,
  ingested_at INTEGER NOT NULL,
  ingest_sequence INTEGER NOT NULL UNIQUE
);

CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  json_value TEXT NOT NULL
);

CREATE INDEX idx_events_actor_time ON events(actor_key, occurred_at DESC);
CREATE INDEX idx_sessions_recent ON sessions(last_activity_at DESC);
~~~

Create migrations (schema version table) and guarantee transactional per-event writes. Insert or upsert session/actor **before** recording a child event. Persist normalized events only; never store raw provider JSON. For MVP, retain event history for 7 days by default and session summaries for 30 days, with configurable purge/disable history. Do not upload these records anywhere.

Keep the DB migration strategy separate from user settings JSON. SQLite native module builds must match packaged Electron's runtime/ABI.

## 11. UI/application state synchronization

1. Main process bootstraps DB and hydrates the current live session snapshot.
2. Renderer calls getSnapshot once after preload registration.
3. Main publishes compact delta events on domain-state changes, including actor identity, status, tool category, timestamp, attention status, and optional context metric.
4. Renderer stores the latest versioned snapshot, then updates Pixi actor targets.
5. Pixi interpolates position and animation locally at frame rate; it never requires 60 network/IPC messages per second.
6. If delta sequence gaps occur, renderer requests a full snapshot.
7. Main throttles noisy updates such as context samples, tool bursts, and duplicate status writes.
8. Renderer recovers cleanly from window reload without restarting the underlying provider or losing fish identities.

The entire app remains operational if a provider suddenly stops emitting events.

## 12. Packaging, installation, and first run

### First-run experience

1. Show beautiful sample tank immediately (no mandatory login).
2. Offer **Connect Claude Code** or **Watch Demo**.
3. Detect Claude Code presence if possible; lack of detection must not break manual instructions.
4. Show safe hook preview and back up relevant settings.
5. Install/verify hooks via a signed/packaged CLI executable or a documented globally installed Node CLI.
6. Show the status "Waiting for an agent"; display a test fish for a manual test event if requested.
7. Starting a supported session makes its actual fish appear.

**Distribution choice:** Electron packages the desktop UI. Publish the companion CLI through an accessible free distribution method (e.g. npm or packaged companion binary), and test real command discovery/quoting after installation on each OS. Do **not** ship an installer that references a developer-only absolute path.

### Build targets

- Windows x64 installer + portable distribution first.
- macOS Intel/Apple Silicon next.
- Linux AppImage/deb next.
- CI builds in public GitHub Actions if available; always maintain local build scripts as a zero-infrastructure fallback.
- The project is free to develop and run; unsigned binaries may trigger platform warnings. Do not promise frictionless code signing without accounting for certificate/notarization requirements.

### Updates

Use versioned GitHub releases and a manual "Check for updates" action initially. Automatic updates are optional only if they can be implemented securely without a paid service. No surprise remote downloads during normal operation.

## 13. Privacy, trust, and security

This is a developer workstation tool. Prioritize privacy and attack-surface reduction.

- **Never** upload source code, filenames, prompts, commands, outputs, or transcripts.
- No analytics SDK, tracking pixel, persistent device identifier, or remote logging.
- Only record minimal allowlisted event metadata, with users able to wipe it.
- Loopback-only listener, unpredictable bearer token, bounded JSON, strict content type, browser-origin protection, and schema validation.
- Token/discovery file and spool are under private user storage, using permission controls appropriate for Windows/macOS/Linux.
- Electron **contextIsolation enabled**, **nodeIntegration disabled**, sandbox renderer where compatible, restrictive CSP, no remote web content.
- No dynamic evaluation of provider strings and no insecure HTML injection.
- File paths from hooks are reduced to an optional safe basename before persistence.
- Treat session/project labels as sensitive in screenshots; Capture Mode masks them.
- Treat imported/custom events as untrusted; never execute tool names or code passed inside an event.
- Settings edits require explicit user approval, are reversible, and only touch Agent Aquarium's own entries.
- Secrets (listener token) must not be written to console, diagnostics, screenshots, or error reports.
- Explicit "Clear Local Data" control.
- Prompt-free/adaptor-only integration: hook commands must have no decision output that changes provider behavior.
- Dependencies should be audited; lockfile committed; CI must check licenses and known vulnerabilities when tooling allows.

### Failure policy

**An aquarium failure must never become an agent failure.** Missing desktop app, unresponsive local listener, corrupt queue item, invalid event, bad DB migration, or rendering error must not block or reject any observed agent tool call or prompt.

## 14. Performance and reliability targets

These are **engineering targets**, to be verified by measurement, not claims of already achieved performance.

- 60 FPS target at 1080p with 5–15 active fish on a typical developer laptop; degraded mode around 30 FPS on weaker hardware.
- Browser/Electron event-loop work should stay bounded; no synchronous filesystem polling on each frame.
- Tool events should become visible promptly in the foreground (aim under 250 ms local delivery-to-render latency).
- Hook forwarding should terminate quickly with a short fail-open timeout (aim under 200 ms on a warm system); benchmark cold-start cost separately.
- Up to 30 fish without layout overlap becoming unusable; overflow can use smaller fish, additional swimming depths, and inspector filtering.
- Default hidden-window mode throttles Pixi to low frequency; OS reduced-motion preference respected.
- Keep event history bounded and rotate diagnostic logs.
- Use deterministic state reducer tests and repeatable seed-based animation tests.
- Crashes/restarts restore the most recent known fish states, clearly marking potentially stale sessions rather than assuming they are alive.

## 15. Monorepo and module ownership

~~~text
agent-aquarium/
├── ARCHITECTURE.md
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── main/               # Electron lifecycle, listener, DB, tray, native
│       │   ├── preload/            # Narrow secure IPC API
│       │   └── renderer/
│       │       ├── app/            # React shell and routes
│       │       ├── aquarium/       # Pixi scene, fish actors, motion, particles
│       │       ├── components/     # Inspector, controls, onboarding
│       │       └── styles/         # Theme tokens and custom visual language
│       └── electron-builder.yml
├── packages/
│   ├── protocol/                   # Zod schemas, typed events, IPC contracts
│   ├── domain/                     # Pure lifecycle reducer, identity, projection
│   ├── adapters/                   # Claude first; Codex/custom later
│   ├── cli/                        # Install/uninstall/doctor/hook forwarding
│   └── test-fixtures/              # Recorded SANITIZED fixtures and simulated events
├── assets/
│   ├── fish/                       # Original or licensed artwork
│   ├── tank/
│   └── audio/
├── scripts/
│   ├── package/
│   └── validate/
├── docs/
│   ├── integrations.md
│   ├── privacy.md
│   ├── protocol.md
│   └── ui-guide.md
└── .github/
    └── workflows/
        ├── ci.yml
        └── release.yml
~~~

### Ownership rules

- **protocol** is importable from CLI, desktop main, renderer, and tests. It has no Electron dependencies.
- **domain** is pure and deterministic; it neither opens network sockets nor writes files.
- **adapters** transform provider facts into validated events.
- **desktop main** is the sole SQLite writer and external event ingestion authority.
- **renderer** cannot import Node/Electron main directly.
- **aquarium** visuals are independent of a specific agent provider.
- **CLI** cannot require the UI to be open in order to safely exit from a hook.

## 16. Test strategy and acceptance gates

### Unit

- Events reject malformed/oversized/private payloads.
- Normalizer maps each documented Claude event correctly.
- Stable identity makes five sessions from the same repository produce **five** fish.
- Subagent IDs produce distinct child fish and link to exactly one parent.
- Duplicate/out-of-order events do not repeat celebrations or undo terminal transitions.
- Stop is not SessionEnd.
- Context missing/null stays Unknown, never 0%.
- Failed tools do not imply failed turns.
- Permission-only notifications are not confused with arbitrary notifications.
- Fish animation changes are deterministic for a fixed seed and event sequence.

### Integration

- Install merges existing Claude settings and preserves unrelated hooks.
- Reinstall creates no duplicate handlers.
- Uninstall restores only changed entries and preserves changes unrelated to Agent Aquarium.
- Settings backup/rollback works on invalid/malformed content.
- Hook STDIN -> CLI -> authenticated loopback -> main -> DB -> renderer update works.
- Invalid token, invalid payload, or wrong origin is rejected.
- App-down event delivery never blocks an agent.
- Event spool survives cold app start without double-applying events.
- DB migrations and event-history pruning preserve current session/fish state.
- Status-line bridge preserves an existing user's status-line output when enabled.

### End-to-end visual

- Open five parallel real Claude Code sessions: exactly five independently animated parent fish.
- Trigger read, write, shell, tests, permission request, failure, success, and session end: verify matching activity/status.
- Open a real subagent and verify a distinct child fish; confirm cleanup after subagent stop.
- Fish inspector shows only sanitized labels and known metrics.
- Capture Mode contains no project/terminal-private information.
- Demo Mode works completely offline with no Claude install.
- Mini Tank, Always on Top, resize, HiDPI, restart recovery, reduced motion, and GPU fallback work.
- Windows packaging installs/launches correctly on a clean machine.
- Observe memory, CPU, frame time, tool event latency, and notification rate under stress.

### Release gate

MVP is releasable only when **five-agent real demo, truthful lifecycle mapping, polished Astra-designed visuals, installation/uninstallation, safe fail-open hooks, and completely offline operation** all pass.

## 17. Delivery phases

### Phase 0 — scaffold and contracts

- pnpm workspace, Electron/Vite/React, PixiJS prototype, lint/typecheck/Vitest.
- Zod event schema, identity functions, and pure reducer with fixtures.
- Settings and storage directory conventions.
- Astra design exploration: fish silhouettes, water treatment, layout, motion system, and two viewport sizes.
- Success: local simulated event stream drives a credible visual tank.

### Phase 1 — real provider integration

- CLI executable, Claude adapter and user-scoped hook installer/rollback.
- Loopback receiver + auth + spool + reducer + SQLite.
- Live five-session and subagent exercise.
- Inspector, honest status/unknown context displays, and attention signals.
- Success: terminal agents update their fish while running without extra APIs.

### Phase 2 — polish and desktop UX

- Astra UI iteration for all screens, fish motion and particle depth.
- Onboarding, compact mode, notification controls, native tray, settings.
- Demo Mode and Capture Mode; screenshots.
- Accessibility/reduced motion, frame throttling, and robust error states.
- Success: a short recording communicates the product without explanation.

### Phase 3 — hardening and open-source release

- Windows clean-install tests and builds, then macOS/Linux packaging.
- Automated test coverage, docs, privacy page, README, license, contributing guide.
- Local benchmarks and stress tests, security review, dependency audit.
- Tagged releases with reproducible installation instructions.
- Success: a new user can install, connect Claude Code, and see a real fish in minutes without a paid API.

### Phase 4 — optional ecosystem

- Verified Codex adapter with clearly documented capability limits.
- Opt-in context status-line bridge.
- Documented custom-agent emitter.
- Species/tank customization and optional local GIF export.
- Community-supported integrations after their provider event APIs are verified.

## 18. Engineering decisions requiring discipline

1. **Correctness over eye candy:** derive status from observed events, never simulated provider activity.
2. **Astra for UI:** use it to create the visual frontend, fish design, and animations; ship local code/assets and no AI runtime dependency.
3. **Five sessions means five fish:** session ID is fundamental to the data model.
4. **One reducer:** adapters produce facts, reducer owns state, renderer owns presentation.
5. **Fail open:** an error in aquarium code cannot prevent a coding agent from functioning.
6. **Least data:** do not accept and then accidentally persist prompts, code, or shell commands.
7. **Zero operating cost:** no cloud service or paid API is required for any core feature.
8. **Windows first, platform-neutral design:** the desktop app and CLI must still have a macOS/Linux release path.
9. **Demo is honest:** simulated fish are visually marked Demo; real fish are backed by actual events.
10. **Ship the full loop early:** hook -> CLI -> receiver -> reducer -> fish is more valuable than a decorative prototype with fake activity.

---

## 19. Sources / implementation references

These are implementation references, **not runtime services**:

- Claude Code hook events, handler configuration, schemas, and asynchronous behavior: https://code.claude.com/docs/en/hooks
- Claude Code status-line JSON and context-window fields: https://code.claude.com/docs/en/statusline
- Codex plugin lifecycle interfaces and their installation/permissions limitations: https://developers.openai.com/plugins/build/plugins
- Electron security guidance: https://www.electronjs.org/docs/latest/tutorial/security
- PixiJS documentation: https://pixijs.com/
- SQLite documentation: https://sqlite.org/docs.html

**Final instruction to any coding agent implementing this repository:** Read this document first; build the working local event pipeline, and **use Astra specifically for frontend UI and visual polish**. Do not replace live agent observation with mocked status data outside the clearly labeled Demo Mode.
