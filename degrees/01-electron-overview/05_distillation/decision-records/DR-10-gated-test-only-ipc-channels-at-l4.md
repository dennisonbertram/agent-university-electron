# DR-10 — Gated test-only IPC channels at L4

**Status**: accepted (2026-05-17)
**POC scope**: L4+

## Context

L4 has many surfaces that cannot be driven by real OS events under Playwright (powerMonitor.suspend, open-url, second-instance, globalShortcut keypress, will-quit). REF-01 / REF-06 explicitly allow programmatic simulation via `app.emit(...)`. We need an IPC seam that lets the renderer-side test drive these, but the seam must not leak into real distribution.

## Decision

A set of `test:*` IPC channels (`test:fire-shortcut`, `test:emit-power-event`, `test:trigger-will-quit`, `test:emit-open-url`, `test:emit-second-instance`) are registered ONLY when `process.env.NODE_ENV === 'test'` OR `process.env.L4_TEST_HOOKS === '1'`. The renderer's preload exposes the wrappers unconditionally so the renderer surface is stable across test/non-test runs; in non-test builds the invoke calls reject with `No handler registered`.

## Alternatives considered

1. Carry the simulation through `app.evaluate(...)` from Playwright into main directly, bypassing IPC.
2. Expose the test seams as part of the regular IPC surface but gate them by an env var. ← chosen
3. Build a separate "test main" entry that includes the seams.

## Consequences

- `app.evaluate` (option 1) couples the test harness to the internal state shape of main and makes assertions awkward to read.
- Option 3 doubles the build matrix.
- Option 2 reuses the existing IPC validator + handler plumbing — every test seam is a normal channel with a validator, just registered conditionally. Mirror of DR-09's env-var pattern.
- Production main.ts contains the test handlers in source, even if not registered. The seam is small, fully validated, and gated by literal env-var opt-in.
- L5 packaging should NOT set `L4_TEST_HOOKS=1`; the capstone Pulse should ideally remove the test seams entirely (move them behind a `__DEV__` define resolved at build time).

## Evidence

- `04_logs/decision-log.md#decision-10`
- `03_pocs/L4-deep-macos-integration/src/main.ts`
- `03_pocs/L-capstone-pulse/src/main.ts:503-533`
- `02_planning/test-strategy.md` REF-01, REF-06
