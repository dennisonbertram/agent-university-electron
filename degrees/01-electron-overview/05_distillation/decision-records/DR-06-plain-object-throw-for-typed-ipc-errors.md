# DR-06 — Plain-object throw for typed IPC errors

**Status**: accepted (2026-05-17)
**POC scope**: L2+

## Context

BT-L2-5 asserts `err.name === 'IpcValidationError'` in the renderer's `catch` block. Electron's `ipcMain.handle` serialization drops every Error field except `message` (documented in `01_research/04-ipc-patterns.md` and reconfirmed via Electron docs). Setting `.name` on a fresh Error in the preload also did not survive `contextBridge`'s isolated-world cloning.

## Decision

Encode the error name in the main-side message via the `__IPCVE__:` sentinel. In the preload, strip the sentinel and throw a **plain object** `{ name: 'IpcValidationError', message }` (NOT an Error instance).

## Alternatives considered

1. Throw an `Error` subclass from preload (rejected — name lost across contextBridge).
2. Use `Object.defineProperty(err, 'name', { value: 'IpcValidationError', enumerable: true })` (rejected — same loss).
3. Throw a plain object `{ name: 'IpcValidationError', message }` from preload. Renderer reads `err.name`/`err.message` exactly like an Error. ← chosen
4. Return a discriminated-union envelope `{ ok: false, error: { ... } }` from the API and require the renderer to check `result.ok` (rejected — diverges from the prompt's "rejected Promise" requirement).

## Consequences

- Simplest pattern that satisfies the behavioral test, with no runtime cost.
- Thrown value is not `instanceof Error` in the renderer. The renderer must use duck-typing (`err.name === 'IpcValidationError'`). Documented in README "Invariants" §5.
- Any L3+ code that wants more error types should reuse this pattern (add new sentinels and corresponding preload unwrap branches) or migrate to a discriminated-union envelope. Do not assume `instanceof` works across the IPC boundary.

## Evidence

- `04_logs/decision-log.md#decision-6`
- `04_logs/expectation-gap-ledger.md#entry-3`
- `03_pocs/L2-secure-ipc/src/preload.ts` (`rethrowingInvoke`)
- `03_pocs/L2-secure-ipc/src/ipc-validation.ts` (`IpcValidationError` + sentinel)
