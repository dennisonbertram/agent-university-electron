# DR-05 — esbuild for preload bundling at L2

**Status**: accepted (2026-05-17); supersedes DR-04
**POC scope**: L2+

## Context

L2 grew the IPC surface to four channels (`app:ping`, `app:echo`, `journal:append`, `tick`) plus the `IPC_VALIDATION_ERROR_PREFIX` sentinel shared between main and preload. The L1 inline-channel-strings + drift-check pattern would require duplicating 5+ constants and re-running the cross-check after every change.

## Decision

Introduce esbuild at L2 to bundle `src/preload.ts` into a single `dist/preload.js`, eliminating L1's inline-channel-strings workaround.

```bash
esbuild src/preload.ts --bundle --platform=node \
  --target=node22 --format=cjs --external:electron \
  --outfile=dist/preload.js
```

## Alternatives considered

1. Continue the L1 pattern (inline literals + drift-check unit test).
2. Bundle the preload with esbuild — single file output, `external: ['electron']` so Electron's sandbox-preload whitelist still resolves. ← chosen
3. Migrate the whole POC to electron-vite or electron-forge. (Rejected: Forge is explicitly scoped to L5 — DR-01.)

## Consequences

- esbuild is one dependency (no plugins, no config file) and produces a single CommonJS file that the sandbox preload runtime resolves cleanly.
- `npm install` grows by ~12 transitive packages (esbuild binary + types).
- Two compile steps now (tsc for main + esbuild for preload) — both run in series in `npm run build`.
- This is the canonical preload-bundling pattern for the degree. L3+ should add their preload imports to `src/preload.ts` directly; do NOT reintroduce the inline-strings pattern.

## Evidence

- `04_logs/decision-log.md#decision-5`
- `03_pocs/L2-secure-ipc/poc-report.md` §3 D-5
- `03_pocs/L2-secure-ipc/src/preload.ts`
