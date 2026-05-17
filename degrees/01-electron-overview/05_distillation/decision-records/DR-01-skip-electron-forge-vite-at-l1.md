# DR-01 — Skip electron-forge + Vite at L1

**Status**: accepted (2026-05-17)
**POC scope**: L1

## Context

L1's prompt suggested `create-electron-app --template=vite-typescript`. That scaffold adds ~150 transitive dependencies and a multi-config build graph (vite.main + vite.preload + vite.renderer + forge.config). L1's behavioral contract is "main + renderer + IPC + log emission". None of those require a bundler.

## Decision

Build L1 with `tsc` only (no electron-forge, no Vite, no bundler for the preload). Inline the IPC channel string literals in `src/preload.ts` (Decision 4). Use a hand-rolled JSON-lines logger (Decision 2). Use the `LOG_DIR` env-var pattern (Decision 3).

## Alternatives considered

1. Use the Forge + Vite template as-is.
2. Hand-craft `forge.config.ts` + `vite.*.ts` but skip the template.
3. Compile with `tsc` and copy the renderer HTML verbatim. No bundler. ← chosen

## Consequences

- Minimal tsc setup keeps the Electron wiring visible.
- Cannot import npm packages into the preload (acceptable — L1 doesn't need to).
- Cannot import relative TS files into the preload either (sandbox restriction — surfaced as G-01 / expectation-gap Entry 1).
- L2+ can adopt esbuild for preload bundling without disturbing L1.
- L5 introduces Forge for packaging.

## Evidence

- `04_logs/decision-log.md#decision-1`
- `03_pocs/L1-hello-electron/poc-report.md` §3 D-1
