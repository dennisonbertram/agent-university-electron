# G-03 — contextBridge + ipcMain.handle drop `Error.name`

**Severity**: medium
**Surface**: IPC error transport
**Discovered in**: L2 GREEN debug of BT-L2-5 (`04_logs/expectation-gap-ledger.md#entry-3`)

## Symptom

Main side throws `new IpcValidationError('...')` where the class definition sets `name = 'IpcValidationError'`. Renderer's `catch (err)` block sees `err.name === 'Error'` and `err.message === '...'`. The custom name is gone. Even setting `.name` on a fresh Error in the preload's catch (via assignment OR `Object.defineProperty`) does NOT survive the contextBridge clone into the main world.

## Root cause

Two compounding behaviors:

1. **`ipcMain.handle` serialization**: Electron's documented IPC error serialization forwards only `Error.message` to the renderer. `name`, stack, and custom properties are dropped.
2. **contextBridge cloning of Error instances**: even if the preload rethrows a fresh `Error` with a custom `.name`, the structured-clone-like marshalling to the main world resets `name` to `'Error'`.

## Fix

Sentinel-prefix the error name in `message`, then throw a **plain object** (not an Error instance) from the preload:

```typescript
// src/ipc-validation.ts (main + shared)
export const IPC_VALIDATION_ERROR_PREFIX = '__IPCVE__:'
export class IpcValidationError extends Error {
  override readonly name = 'IpcValidationError' as const
  constructor(message: string) {
    // Encode the name in the message so it survives the IPC boundary.
    super(`${IPC_VALIDATION_ERROR_PREFIX}${message}`)
  }
}
```

```typescript
// src/preload.ts — rethrowingInvoke helper
async function rethrowingInvoke(channel: string, arg: unknown): Promise<unknown> {
  try {
    return await ipcRenderer.invoke(channel, arg)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.startsWith('Error: __IPCVE__:') || msg.startsWith('__IPCVE__:')) {
      const real = msg.replace(/^Error:\s*/, '').slice('__IPCVE__:'.length)
      // PLAIN OBJECT — not an Error instance. The renderer reads err.name.
      throw { name: 'IpcValidationError', message: real }
    }
    throw err
  }
}
```

The renderer's `catch` block then reads `err.name === 'IpcValidationError'`. The thrown value is NOT `instanceof Error` — use duck-typing.

## Test that catches a regression

`tests/e2e/BT-L2-5.spec.ts`: send a validation-failing argument; assert the rejected promise carries `err.name === 'IpcValidationError'`.

## Evidence

- `04_logs/expectation-gap-ledger.md#entry-3`
- `04_logs/decision-log.md#decision-6`
- `03_pocs/L2-secure-ipc/src/preload.ts` — `rethrowingInvoke` implementation
- `01_research/04-ipc-patterns.md` lines 44-58
- Electron docs `tutorial/ipc.md` → "Error Handling Considerations"
