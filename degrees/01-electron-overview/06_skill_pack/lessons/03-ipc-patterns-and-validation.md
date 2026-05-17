# Lesson 03 — IPC Patterns and Validation

**Prerequisites**: [02-secure-renderer-defaults.md](./02-secure-renderer-defaults.md)  
**Next**: [04-storage-and-encryption.md](./04-storage-and-encryption.md)

## Why Validation Is Mandatory

Every `ipcMain.handle` callback receives an `arg: unknown` from the renderer. The renderer is a Chromium page — your code, but also potentially compromised by XSS. Treat every IPC argument as untrusted input.

Without validation: a renderer bug (or XSS) can pass `{ path: '/etc/passwd' }` to a file-read handler.

With validation: a type guard rejects the malformed argument before it reaches the handler.

## The IPC Registry Pattern

Do not scatter `ipcMain.handle` calls across files. Centralize them:

```typescript
// src/ipc.ts
import type { IpcMain, IpcMainInvokeEvent } from 'electron'

export const IPC_CHANNELS = {
  APP_PING: 'app:ping',
  JOURNAL_APPEND: 'journal:append',
} as const

export class IpcValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'IpcValidationError' }
}

interface RegistryEntry<A, R> {
  channel: string
  validate: (arg: unknown) => A
  handler: (arg: A, ctx: HandlerContext, evt: IpcMainInvokeEvent) => Promise<R> | R
}

export const IPC_REGISTRY: ReadonlyArray<RegistryEntry<unknown, unknown>> = [
  {
    channel: IPC_CHANNELS.APP_PING,
    validate: () => undefined,
    handler: (_arg, ctx) => ({ ts: ctx.monotonicNow() }),
  },
  {
    channel: IPC_CHANNELS.JOURNAL_APPEND,
    validate: (arg) => {
      if (typeof arg !== 'object' || arg === null) throw new IpcValidationError('expected object')
      const a = arg as Record<string, unknown>
      if (typeof a.text !== 'string' || a.text.length === 0) throw new IpcValidationError('text must be non-empty string')
      return { text: a.text as string }
    },
    handler: async ({ text }, ctx) => ctx.journal.append(text),
  },
]

export function registerIpc(ipcMain: IpcMain, ctx: HandlerContext): void {
  for (const entry of IPC_REGISTRY) {
    ipcMain.handle(entry.channel, async (evt, arg) => {
      try {
        const validated = entry.validate(arg)
        const result = await entry.handler(validated, ctx, evt)
        ctx.logger.info(`ipc:${entry.channel}:served`, {})
        return result
      } catch (err) {
        if (err instanceof IpcValidationError) {
          ctx.logger.warn(`ipc:${entry.channel}:validation-failed`, { message: err.message })
        } else {
          ctx.logger.error(`ipc:${entry.channel}:threw`, {
            message: err instanceof Error ? err.message : String(err),
          })
        }
        throw err
      }
    })
  }
}
```

Benefits:
- Every channel has a mandatory validator
- Structured log markers `ipc:<ch>:served` and `ipc:<ch>:validation-failed` are deterministic test signals
- `HandlerContext` is injectable — unit tests construct a fake context

## The Error Round-Trip Problem

Errors do NOT round-trip cleanly across IPC. Electron strips `Error.name` when forwarding from `ipcMain.handle` to the renderer. `contextBridge` further strips it when re-throwing.

**Wrong**:
```typescript
// main.ts — handler throws
throw new AuthError('unlock required')

// renderer — receives
error.name === 'Error'      // WRONG — name was stripped
error.message === 'unlock required'  // ok
```

**Correct** — encode the type in the message with a sentinel prefix, then decode in preload:

```typescript
// main.ts
throw new Error('AUTH_REQUIRED:unlock required')

// preload.ts — decoder
const result = await ipcRenderer.invoke('journal:list').catch((err: Error) => {
  if (err.message.startsWith('AUTH_REQUIRED:')) {
    return { ok: false, requiresFallback: true, reason: 'touch-id-unavailable' }
  }
  throw err
})

// Alternative: throw a plain object (not an Error instance)
// This works because contextBridge serializes plain objects faithfully
throw { name: 'AuthRequired', message: 'unlock required' }
```

## The Channel Constants Pattern

Define channels as `as const` object — never use string literals inline:

```typescript
export const IPC_CHANNELS = {
  APP_PING: 'app:ping',
  JOURNAL_APPEND: 'journal:append',
} as const
export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]
```

This makes typos compile errors. Preload imports the same constant:

```typescript
// src/preload.ts — bundled with esbuild, so imports are fine
// BUT: if not bundled, inline the constants and add a drift-detector test (G-02)
const APP_PING = 'app:ping'  // fallback if not bundling
```

## Ambient Type Declarations

The renderer uses `window.api.*`. Type it for editor support:

```typescript
// src/renderer.d.ts
interface Window {
  api: {
    ping(): Promise<{ ts: number }>
    appendEntry(text: string): Promise<{ ok: boolean; id: number }>
  }
}
```

Gotcha (G-02): a `.d.ts` file with only global augmentations and no `export` is NOT picked up by `include: ["src/**/*.ts"]` globs. List it explicitly in `tsconfig.json`:

```json
{
  "files": ["src/renderer.d.ts"],
  "include": ["src/**/*.ts"]
}
```

## Test-Seam IPC Channels

For OS events that Playwright cannot drive (powerMonitor, second-instance, open-url), register test-only channels:

```typescript
export const TEST_CHANNELS = {
  TEST_EMIT_POWER: 'test:emit-power-event',
  TEST_EMIT_OPEN_URL: 'test:emit-open-url',
} as const

function testHooksEnabled(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.MY_APP_TEST_HOOKS === '1'
}

// In registerIpc():
if (testHooksEnabled()) {
  for (const entry of TEST_REGISTRY) {
    ipcMain.handle(entry.channel, ...)
  }
}
```

Test channels follow the same validator+handler pattern as production channels. They ARE production code — just registered conditionally. See [recipes/recipe-test-seam-ipc-channel.md](../recipes/recipe-test-seam-ipc-channel.md).

## Sync IPC Is Banned

Never use `ipcRenderer.sendSync`. It blocks the renderer process while waiting for main's reply — this freezes the UI and can cause watchdog timeouts.

```typescript
// WRONG
const result = ipcRenderer.sendSync('app:ping')

// CORRECT
const result = await ipcRenderer.invoke('app:ping')
```

## Main → Renderer Push

To push events from main to renderer (e.g., updater progress, power events):

```typescript
// main.ts
win.webContents.send('updater:progress', { pct: 42 })

// preload.ts
contextBridge.exposeInMainWorld('api', {
  onUpdaterProgress: (cb: (pct: number) => void) => {
    ipcRenderer.on('updater:progress', (_evt, data) => cb(data.pct))
  },
})
```

## Key Takeaways

1. Every IPC channel needs a validator — no exceptions.
2. Centralize all channels in one IPC registry with a single registration site.
3. Errors lose their `name` across IPC — encode type in message or throw plain objects.
4. Use `as const` channel constants — never string literals inline.
5. `ipcRenderer.sendSync` is banned.
6. Test-seam channels follow the same validator pattern as production channels.

Evidence: `../../05_distillation/patterns/P-02-ipc-registry-with-validators.md`, `../../05_distillation/patterns/P-07-test-seam-ipc-channels-gated-by-env.md`, `../../05_distillation/gotchas/G-03-contextbridge-drops-error-name.md`, `../../05_distillation/gotchas/G-02-tsc-skips-ambient-dts-in-include-glob.md`, `../../05_distillation/anti-patterns/AP-03-sync-ipc-sendsync.md`
