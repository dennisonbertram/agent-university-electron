# Decision Log — 01-electron-overview

Material decisions made during the degree. Append-only.

## Entry Format

```
## Decision N — <short title>

- **Date**:
- **Decision**:
- **Context**:
- **Options considered**:
- **Chosen option**:
- **Reason**:
- **Tradeoffs accepted**:
- **Invalidated assumption** (if any, e.g. A4):
- **Future-agent implication**:
```

## Entries

## Decision 1 — Skip electron-forge + Vite at L1

- **Date**: 2026-05-17
- **Decision**: Build L1 with `tsc` only (no electron-forge, no Vite, no bundler for the preload).
- **Context**: The L1 prompt suggested `create-electron-app --template=vite-typescript`. That scaffold adds ~150 transitive dependencies and a multi-config build graph (vite.main + vite.preload + vite.renderer + forge.config).
- **Options considered**:
  1. Use the Forge + Vite template as-is.
  2. Hand-craft `forge.config.ts` + `vite.*.ts` but skip the template.
  3. Compile with `tsc` and copy the renderer HTML verbatim. No bundler.
- **Chosen option**: 3.
- **Reason**: L1's behavioral contract is "main + renderer + IPC + log emission". None of those require a bundler. The minimal `tsc` setup keeps the Electron wiring visible and avoids hiding bugs behind a build graph that won't actually be exercised until L5.
- **Tradeoffs accepted**: cannot import npm packages into the preload (acceptable — L1 doesn't need to). Cannot import relative TS files into the preload either (sandbox restriction; worked around by inlining channel strings + a unit drift check).
- **Future-agent implication**: L2+ can adopt esbuild for preload bundling without disturbing L1. L5 will introduce Forge for packaging.

## Decision 2 — Hand-rolled JSON-lines logger at L1, electron-log deferred to L4

- **Date**: 2026-05-17
- **Decision**: Use a dependency-free synchronous JSON-lines logger (`src/log.ts`) for L1; defer electron-log to L4 as planned.
- **Context**: `02_planning/observability-strategy.md` makes electron-log the canonical choice but introduces it at L4.
- **Options considered**:
  1. Pull electron-log in at L1.
  2. Hand-roll a synchronous logger with the same JSON-lines contract.
- **Chosen option**: 2.
- **Reason**: Tests need to read the log file immediately after IPC events. electron-log buffers writes; we'd have to sleep for an indeterminate duration in every test. The hand-rolled `appendFileSync` is deterministic. The output schema (`{ts,level,process,module,event,payload?}`) is identical to electron-log's `JSON.stringify` format, so the L4 swap is a drop-in.
- **Tradeoffs accepted**: no log rotation, no renderer→main forwarding, no console-pretty formatting. All are L4 features anyway.
- **Future-agent implication**: when L4 migrates to electron-log, keep the same field names so downstream log-reading tests do not break.

## Decision 3 — `LOG_DIR` env-var override for tests

- **Date**: 2026-05-17
- **Decision**: Main process reads `LOG_DIR` from `process.env` and uses it when set; otherwise falls back to `app.getPath('logs')` (then to `${userData}/logs` as a final safety net).
- **Context**: Each Playwright test needs a fresh log file. `app.setPath('logs', ...)` has early-init quirks on some platforms and was rejected.
- **Options considered**:
  1. Override `app.setPath('logs', ...)` before `app.whenReady()`.
  2. Read `LOG_DIR` env var.
  3. Always write to a fixed dev path and have tests clear it.
- **Chosen option**: 2.
- **Reason**: Smallest surface. The env var is a standard test-isolation pattern and doesn't entangle production paths.
- **Tradeoffs accepted**: any production code that needs the log path must read it from main's logger (or `IPC_CHANNELS.LOG_PATH`), not by assuming `app.getPath('logs')`.
- **Future-agent implication**: keep the `LOG_DIR` override in subsequent POCs so the helper module `tests/e2e/helpers.ts` stays compatible.

## Decision 4 — Inline IPC channel strings in preload + unit drift check

- **Date**: 2026-05-17
- **Decision**: Preload duplicates the channel string literals from `src/ipc.ts`; a vitest unit test cross-checks them against `IPC_CHANNELS`.
- **Context**: Under `sandbox: true`, preload cannot `require('./ipc')` — only whitelisted modules resolve. Importing the constants caused `window.api` to silently fail to materialize (see expectation-gap-ledger Entry 1).
- **Options considered**:
  1. Bundle the preload with esbuild so the import is resolved at build time.
  2. Inline the strings and add a drift-detector test.
  3. Switch off `sandbox: true` (security regression — rejected).
- **Chosen option**: 2.
- **Reason**: Adding a bundler at L1 is over-scope for the smoke test. The drift-detector test makes the inline a controlled, observable workaround rather than silent duplication.
- **Tradeoffs accepted**: every new IPC channel must be added in two places. The drift-check test makes that visible immediately.
- **Future-agent implication**: L2 should adopt a preload bundler if it introduces more than ~3 additional channels. Until then, the inline + drift-check pattern scales fine.
