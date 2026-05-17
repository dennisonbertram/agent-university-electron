# DR-02 — Hand-rolled JSON-lines logger at L1, electron-log deferred to L4

**Status**: accepted (2026-05-17)
**POC scope**: L1-L3

## Context

`02_planning/observability-strategy.md` makes electron-log the canonical choice but introduces it at L4. Tests need to read the log file immediately after IPC events; electron-log buffers writes, forcing tests to sleep for an indeterminate duration.

## Decision

Use a dependency-free synchronous JSON-lines logger (`src/log.ts`) for L1-L3. Output schema matches electron-log's JSON.stringify format so the L4 swap is a drop-in.

## Alternatives considered

1. Pull electron-log in at L1.
2. Hand-roll a synchronous logger with the same JSON-lines contract. ← chosen

## Consequences

- Synchronous `appendFileSync` is deterministic; tests don't need to sleep.
- No log rotation, no renderer→main forwarding, no console-pretty formatting. All are L4 features anyway.
- L4 migration to electron-log preserves the same field names so downstream tests don't break.

## Evidence

- `04_logs/decision-log.md#decision-2`
- `02_planning/observability-strategy.md` lines 30-76
- `03_pocs/L1-hello-electron/src/log.ts`
