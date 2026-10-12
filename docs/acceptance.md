# Release acceptance and evidence

Candidate engineering evidence is recorded in [verification-2026-10-12.md](verification-2026-10-12.md). This checklist is an evidence template. Unchecked items are outstanding manual or release checks; a generated artifact or passing unit suite does not check them automatically. Record evidence for each release candidate, without exposing private prompts, tokens, commands, filenames, or unrelated user settings.

## Candidate record

- Commit/tag: _fill in_
- Date and tester: _fill in_
- OS/architecture, CPU/GPU/RAM: _fill in_
- Node, pnpm, Electron and Claude Code versions: _fill in_
- Installer/artifact checksum: _fill in_
- Automated run link or local sanitized output: _fill in_

## Automated gates

Run `pnpm install --frozen-lockfile`, then `pnpm check` with a Node-compatible SQLite binary. Record the actual output. The intended coverage is strict schemas, deterministic reducer ordering/identity, installer preservation/rollback, fail-open CLI, receiver rejection cases, spool replay, storage migration/retention, and renderer build/type safety. Inspect current test files rather than assuming this list proves coverage.

- [x] Type checking, unit/integration tests and production build pass on the candidate commit.
- [x] Dependency audit reviewed; applicable unresolved findings documented.
- [x] Dependency licenses reviewed for distribution compatibility; include required notices.
- [x] After checks, SQLite rebuilt for Electron and package build succeeds.
- [x] Artifact contents include local renderer assets and a usable companion CLI without developer-machine paths.
- [x] Release verification script passes: `node scripts/validate/release-files.mjs`.

## Real five-session exercise

- [ ] Install hooks after reviewing the preview; existing unrelated hooks and preferences survive.
- [ ] Install twice and verify no duplicate handlers. Uninstall and confirm only aquarium entries disappear; test backup/restore and invalid-settings refusal.
- [ ] Start **five real Claude Code parent sessions in one repository** and observe exactly five independently animated parent fish.
- [ ] Trigger read, write, shell, tests, documented permission/input attention, tool failure, turn success, and session end. Verify each fish responds to the correct session.
- [ ] Stop completes a turn and leaves its fish present; a failed tool does not declare a failed turn.
- [ ] Spawn a real subagent and verify exact parent/child identity, independent activity, and cleanup.
- [ ] Context is Unknown without telemetry. With explicit status-line opt-in, observe percentage/null updates and verify existing status-line output is preserved/restored.
- [ ] Kill or close the desktop during active hooks: Claude keeps working without provider-facing hook messages; bounded spool drains once after restart.
- [ ] Restart the desktop and confirm recovered sessions become stale honestly; late/duplicate tool deliveries never undo a newer terminal state.

## Desktop and privacy

- [x] Offline Demo Mode shows five clearly simulated fish without Claude installed.
- [ ] Inspector shows safe metadata only; Capture Mode image contains no project/session-private information.
- [ ] Mini Tank, Always on Top, tray, window resize, HiDPI, and restart recovery work.
- [ ] Keyboard navigation, focus visibility, screen-reader labels and OS reduced motion work; attention/errors use more than color.
- [x] GPU/rendering failure leaves a usable static session list.
- [ ] Sound/notifications are off by default; enabled notifications are limited to observed attention/completion and rate limited.
- [x] Clear Local Data removes aquarium history while preserving unrelated provider configuration.
- [ ] Normal operation remains usable with network access disabled and performs no unexpected remote calls.

## Clean-machine packaging

- [ ] Windows x64 installer installs and launches on a clean account without development tools; bundled CLI hook path resolves correctly.
- [x] Windows portable artifact launches, connects, and handles paths containing spaces.
- [ ] macOS builds tested on each advertised architecture; unsigned/notarization limitations documented.
- [ ] Linux advertised artifact installs/launches with documented system requirements.
- [ ] Upgrade/uninstall behavior preserves or removes local data according to explicit user choice.
- [ ] Distribution download, version label, checksum and release notes match the exact validated artifacts.

## Measurements

Record average and p95/p99 where useful, measurement method, duration, machine, and active fish count. Architecture numbers are engineering targets, not established results.

| Measurement | Target / scenario | Recorded result |
| --- | --- | --- |
| Frame time | 60 FPS target at 1080p, 5–15 fish | _not measured_ |
| Degraded rendering | Usable around 30 FPS on weaker hardware | _not measured_ |
| Fish overflow | 30 fish remain inspectable | _not measured_ |
| Foreground local delivery | Aim under 250 ms delivery-to-render | _not measured_ |
| Warm hook forwarding | Aim under 200 ms; cold start separately | _not measured_ |
| Sustained load | Bounded memory/tools/history/spool | _not measured_ |
| Background/battery | Throttled animation and low CPU | _not measured_ |

MVP release requires the real five-agent exercise, truthful lifecycle, polished visuals, safe reversible installation, fail-open hooks, and offline operation. Do not convert these manual gates to completed claims solely because CI is green.
