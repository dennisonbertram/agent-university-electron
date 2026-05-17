# DR-08 — `USER_DATA_DIR` env-var override at L3

**Status**: accepted (2026-05-17)
**POC scope**: L3+

## Context

L3 writes a journal file and a watched-folder to `app.getPath('userData')`. Without isolation, e2e tests pollute the developer's real Electron app data and collide across runs.

## Decision

Main reads `USER_DATA_DIR` from `process.env` and applies it via `app.setPath('userData', dir)` BEFORE `app.whenReady`; helpers.ts generates a fresh temp dir per test launch.

## Alternatives considered

1. Use `--user-data-dir=...` CLI flag understood by Electron.
2. Use the env-var override pattern that mirrors L1's `LOG_DIR`. ← chosen
3. Always write to a fixed dev path and have tests clear it.

## Consequences

- Mirrors `LOG_DIR` precisely (same shape, same call site).
- Keeps test helpers small. `app.setPath` works reliably when called before `whenReady`.
- `app.setPath('userData', ...)` must be the very first synchronous call after the env var is read; a future refactor that moves it past `whenReady` would silently lose isolation.
- L4+ POCs that touch userData (storage, badge state, recent docs) must honor the same env-var pattern via the helpers extension.

## Evidence

- `04_logs/decision-log.md#decision-8`
- `03_pocs/L3-storage-and-native-io/src/main.ts`
- `03_pocs/L-capstone-pulse/src/main.ts:90-96`
