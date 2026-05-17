# G-01 — Sandbox preload cannot `require('./ipc')`

**Severity**: high
**Surface**: Preload, IPC, security defaults
**Discovered in**: L1 GREEN debug (`04_logs/expectation-gap-ledger.md#entry-1`)

## Symptom

Under `webPreferences: { sandbox: true }` (the default since Electron 20), a preload script compiled with `tsc` from TypeScript that uses `import { IPC_CHANNELS } from './ipc'` silently aborts. `contextBridge.exposeInMainWorld` never runs. `window.api` is `undefined` in the renderer. Tests time out waiting for any ipc invocation. **No error appears in the main process log.**

## Root cause

`sandbox: true` replaces preload's `require` with a polyfill that only resolves a whitelisted set of modules (`contextBridge`, `crashReporter`, `ipcRenderer`, `nativeImage`, `webFrame`, `webUtils`, `events`, `timers`, `url`). A `require('./ipc')` call is silently rejected and the preload aborts mid-evaluation (evidence: `01_research/05-security-model.md` lines 205-213; `01_research/02-three-process-model.md` whitelist).

## Fix

Two options:

1. **Bundle the preload with esbuild** (canonical from L2 onward):
   ```bash
   esbuild src/preload.ts --bundle --platform=node \
     --target=node22 --format=cjs --external:electron \
     --outfile=dist/preload.js
   ```
   `external: ['electron']` preserves Electron's runtime resolution so the sandbox whitelist still works.

2. **Inline the constants** with a drift-detector unit test:
   ```typescript
   // src/preload.ts
   const IPC_PING = 'app:ping' as const
   const IPC_ECHO = 'app:echo' as const
   // ... and a tests/unit/preload-channel-drift.test.ts that imports IPC_CHANNELS
   // from src/ipc.ts and asserts equality.
   ```

## Test that catches a regression

`tests/e2e/BT-L1-2.spec.ts`: launch app, wait for `renderer:ready` log marker within 3s. Without the fix, this times out at 30s. Also `tests/unit/preload-channel-drift.test.ts` (L1) for the inline variant.

## Evidence

- `04_logs/expectation-gap-ledger.md#entry-1`
- `04_logs/decision-log.md#decision-4`, `#decision-5`
- `03_pocs/L2-secure-ipc/src/preload.ts` — canonical esbuild-bundled form
- `01_research/05-security-model.md` lines 205-213
