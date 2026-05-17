# Lab 02 — Secure IPC Roundtrip

**Goal**: Add a typed IPC registry with per-channel validators, test it with Playwright.

**Prerequisites**: [lab-01-hello-electron.md](./lab-01-hello-electron.md), [lessons/03-ipc-patterns-and-validation.md](../lessons/03-ipc-patterns-and-validation.md)

**Duration**: ~30 minutes

**POC Reference**: [examples/example-l2-secure-ipc.md](../examples/example-l2-secure-ipc.md)

## Goal

By the end, you should have:
- An IPC registry with `IPC_CHANNELS` constants, `IpcValidationError`, and `registerIpc()`
- At least one channel with a real validator (not `() => undefined`)
- A Playwright test that verifies valid and invalid payloads

## Steps

### 1. Create src/ipc.ts

Use the template from [recipes/recipe-ipc-handler-with-validator.md](../recipes/recipe-ipc-handler-with-validator.md):

```typescript
export const IPC_CHANNELS = {
  APP_PING: 'app:ping',
  ECHO: 'app:echo',
} as const

export class IpcValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'IpcValidationError' }
}

// Validator for app:echo
function validateEcho(arg: unknown): { message: string } {
  if (typeof arg !== 'object' || arg === null) throw new IpcValidationError('expected object')
  const a = arg as Record<string, unknown>
  if (typeof a.message !== 'string' || a.message.length === 0)
    throw new IpcValidationError('message must be non-empty string')
  if (a.message.length > 1000) throw new IpcValidationError('message too long')
  return { message: a.message }
}

export const IPC_REGISTRY = [
  {
    channel: IPC_CHANNELS.APP_PING,
    validate: () => undefined as void,
    handler: (_arg: void, ctx: any) => ({ ts: Date.now() }),
  },
  {
    channel: IPC_CHANNELS.ECHO,
    validate: validateEcho,
    handler: ({ message }: { message: string }, ctx: any) => {
      ctx.logger.info('ipc:app:echo:served', { length: message.length })
      return { echo: message.toUpperCase() }
    },
  },
]
```

### 2. Update preload.ts

Add the `echo` method:
```typescript
contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('app:ping'),
  echo: (message: string) => ipcRenderer.invoke('app:echo', { message }),
})
```

### 3. Update main.ts

Replace the raw `ipcMain.handle` calls with `registerIpc`:
```typescript
import { registerIpc } from './ipc'
// Inside whenReady:
registerIpc(ipcMain, { logger })
```

### 4. Write a Playwright test

```typescript
// tests/e2e/ipc.spec.ts
import { test, expect } from '@playwright/test'
import { launchApp } from './helpers'

test('BT-01: ping returns ts', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    const result = await window.evaluate(() => (window as any).api.ping())
    expect(result).toHaveProperty('ts')
    await expect.poll(
      () => readLogLines().some(l => l.event === 'ipc:app:ping:served'),
      { timeout: 3000 }
    ).toBe(true)
  } finally { await app.close() }
})

test('BT-02: echo validates message', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    // Valid
    const result = await window.evaluate(() => (window as any).api.echo('hello'))
    expect(result).toEqual({ echo: 'HELLO' })

    // Invalid — empty string
    const err = await window.evaluate(() =>
      (window as any).api.echo('').catch((e: Error) => ({ error: e.message }))
    )
    expect(err).toHaveProperty('error')

    // Validator failure should be logged
    await expect.poll(
      () => readLogLines().some(l => l.event === 'ipc:app:echo:validation-failed'),
      { timeout: 3000 }
    ).toBe(true)
  } finally { await app.close() }
})
```

## Verify

- Valid `echo` call returns `{ echo: 'HELLO' }`
- Invalid (empty string) call rejects with an error
- `logs/main.log` contains `ipc:app:echo:validation-failed` for the invalid call
- `logs/main.log` contains `ipc:app:echo:served` for the valid call

## Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Error name stripped in renderer | G-03: contextBridge drops Error.name | Encode type in message or use plain object |
| Validator not called | `registerIpc` not called in main | Check main.ts `whenReady` block |
| `app.echo is not a function` | Preload not rebuilt | Re-run esbuild for preload |

See [troubleshooting/ipc-validation-error-shape.md](../troubleshooting/ipc-validation-error-shape.md).

Evidence: [recipes/recipe-ipc-handler-with-validator.md](../recipes/recipe-ipc-handler-with-validator.md), `../../03_pocs/L2-secure-ipc/`
