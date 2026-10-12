# Windows candidate verification — 2026-10-12

This is local engineering evidence, not a production-release certification. The real five-Claude-session exercise and clean-machine/platform checks in [acceptance.md](acceptance.md) remain open.

## Environment and reproducibility

Windows 11 x64 build 26200, Intel Core i7-14700F, approximately 31.8 GiB RAM; Node 22.23.2, pnpm 11.3.0, Electron 44.7.0. Claude Code 2.1.287 and Codex 0.159.3 were inspected without launching paid inference sessions. GPU model was not recorded. Dependencies and companion runtime are pinned; the full Node distribution license accompanies the bundled executable.

Run `pnpm check`, `node scripts/validate/release-files.mjs`, `pnpm package:win`, and `pnpm test:desktop`. To exercise the packaged executable in PowerShell:

```powershell
$env:AQUARIUM_SMOKE_EXECUTABLE='release/win-unpacked/Agent Aquarium.exe'
node scripts/validate/desktop-smoke.mjs
```

The smoke script uses isolated temporary Aquarium and Claude configuration directories. It never edits the user's provider settings or launches provider inference. Screenshots are local ignored outputs under `.local/desktop-smoke/`.

## Verified behavior

Source and packaged desktop smoke checks passed: five clearly simulated demo fish; seven independent ingested actors including a subagent and an event delivered by executing the exact installed hook handler; turn completion retains the fish; absent context stays Unknown; Mini Tank; Always on Top; masked capture and actual PNG export; usable static fallback after simulated GPU context loss; persisted actors recover stale after application restart and fresh heartbeat restores the preserved lifecycle; Clear Local Data removes Aquarium history and preserves unrelated provider configuration; no renderer errors. Malformed provider settings produce actionable diagnostics.

The packaged hook uses the bundled standalone Node executable and compiled CLI through Claude's direct-exec command and args fields. A previous Electron-as-CLI approach did not forward stdin reliably and was removed. The smoke test waits synchronously for the resulting actor and independently asserts the snapshot count, preventing an asynchronous predicate from passing prematurely.

Production dependency audit reported zero findings at all severities. Production license review found MIT, BSD-3-Clause and ISC dependencies; generated notices, upstream MIT attribution for Pixi's colord module, and the full exact-version Node license are included. Windows installer and portable artifacts build locally. These artifacts are unsigned; no signing service is required to build them.

## Local 30-fish performance sample

`node scripts/validate/performance.mjs` creates 30 independent actors at 1920×1080 and measures delivery until the accessible DOM reflects the event. This includes driver scheduling and does not measure GPU completion.

| Sample | Average | p95 |
| --- | --- | --- |
| New fish creation, 30 events | 61.6 ms | 464.0 ms |
| Warm tool delivery, 30 events | 14.3 ms | 23.7 ms |
| Foreground RAF interval, 180 samples | — | 5.8 ms |

Warm delivery met the architecture's 250 ms target in this sample; cold creation p95 did not. RAF cadence describes browser opportunities on this workstation, not verified GPU frame rate. Process working-set snapshots totaled approximately 421 MiB across browser, renderer, GPU and utility processes. This short run establishes neither sustained memory stability nor battery/background performance. Raw sanitized results and a 30-fish screenshot are generated in `.local/performance/`.

## Still required before claiming release acceptance

Actual five simultaneous Claude sessions, real permission/tool/subagent/session-end behavior and optional status telemetry on supported clients; clean-account Windows install/upgrade/uninstall; actual portable launch; macOS/Linux install and launch; sustained/background/battery measurement; assistive technology and OS reduced-motion testing. CI cross-platform checks are recorded by GitHub and are not a substitute for these checks. The fixed update button opens the project's releases page only after a click; no automatic updater or telemetry service runs.

Full development audit also reported GHSA-hp3w-g68c-fv3c in electron-builder’s optional download/logging chain (sprintf-js 1.1.3, moderate denial of service). The audit’s suggested 1.1.4 was unavailable in the configured registry on this date. It is absent from production dependencies; no high or critical findings were reported. Recheck the packaging toolchain before publishing a public release.

Final lifecycle/visual suite: 90 tests across 11 files, strict TypeScript, production build, and distribution entrypoint checks passed locally. The recovery regression covers working, waiting and completed actors independently; delayed tool completions pair without undoing newer attention or terminal states. Tool failure receives a three-second cue without declaring a failed turn; reduced motion uses a static cue.
