# DR-03 — `LOG_DIR` env-var override for tests

**Status**: accepted (2026-05-17)
**POC scope**: L1+, all carry forward

## Context

Each Playwright test needs a fresh log file. `app.setPath('logs', ...)` has early-init quirks on some platforms (the path isn't stable before `app.whenReady()`).

## Decision

Main process reads `LOG_DIR` from `process.env` and uses it when set; otherwise falls back to `app.getPath('logs')` (then to `${userData}/logs` as a final safety net).

## Alternatives considered

1. Override `app.setPath('logs', ...)` before `app.whenReady()`.
2. Read `LOG_DIR` env var. ← chosen
3. Always write to a fixed dev path and have tests clear it.

## Consequences

- Smallest surface — standard test-isolation pattern, doesn't entangle production paths.
- Any production code that needs the log path must read it from main's logger (or `IPC_CHANNELS.LOG_PATH`), not by assuming `app.getPath('logs')`.
- The `LOG_DIR` override must be preserved across subsequent POCs so `tests/e2e/helpers.ts` stays compatible.

## Evidence

- `04_logs/decision-log.md#decision-3`
- `03_pocs/L1-hello-electron/tests/e2e/helpers.ts`
- `03_pocs/L-capstone-pulse/src/main.ts:84-99`
