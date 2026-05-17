# DR-04 — Inline IPC channel strings in preload + unit drift check (L1 only)

**Status**: superseded by DR-05 (esbuild bundling at L2)
**POC scope**: L1

## Context

Under `sandbox: true`, preload cannot `require('./ipc')` — only whitelisted modules resolve. Importing the constants caused `window.api` to silently fail to materialize (G-01 / expectation-gap Entry 1).

## Decision

Preload duplicates the channel string literals from `src/ipc.ts`. A vitest unit test cross-checks them against `IPC_CHANNELS`:

```typescript
test('preload inline channel constants do not drift from IPC_CHANNELS', () => {
  // assert PRELOAD_INLINE constants equal IPC_CHANNELS values
})
```

## Alternatives considered

1. Bundle the preload with esbuild so the import is resolved at build time. (Adopted at L2 — DR-05.)
2. Inline the strings and add a drift-detector test. ← chosen at L1
3. Switch off `sandbox: true` (security regression — rejected).

## Consequences

- Adding a bundler at L1 was over-scope for the smoke test. The drift-detector test made the inline a controlled, observable workaround rather than silent duplication.
- Every new IPC channel must be added in two places. The drift-check test catches drift immediately.
- L2 grew the IPC surface to 4+ channels; the inline pattern became untenable; DR-05 introduced esbuild.

## Evidence

- `04_logs/decision-log.md#decision-4`
- `03_pocs/L1-hello-electron/src/preload.ts` (inlined form)
- `03_pocs/L1-hello-electron/tests/unit/preload-channel-drift.test.ts`
- `04_logs/expectation-gap-ledger.md#entry-1`
