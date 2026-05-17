# Recipe — IPC Handler with Validator

**Use when**: Adding any IPC channel to an Electron app.

## Code

```typescript
// src/ipc.ts
import type { IpcMain, IpcMainInvokeEvent } from 'electron'

export const IPC_CHANNELS = {
  APP_PING: 'app:ping',
  ECHO: 'app:echo',
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
    handler: (_arg, ctx) => ({ ts: Date.now() }),
  },
  {
    channel: IPC_CHANNELS.ECHO,
    validate: (arg) => {
      if (typeof arg !== 'object' || arg === null) throw new IpcValidationError('expected object')
      const a = arg as Record<string, unknown>
      if (typeof a.message !== 'string' || a.message.length === 0)
        throw new IpcValidationError('message must be non-empty string')
      return { message: a.message }
    },
    handler: ({ message }: { message: string }, ctx) => {
      ctx.logger.info(`ipc:${IPC_CHANNELS.ECHO}:served`, {})
      return { echo: message.toUpperCase() }
    },
  },
]

export function registerIpc(ipcMain: IpcMain, ctx: HandlerContext): void {
  for (const entry of IPC_REGISTRY) {
    ipcMain.handle(entry.channel, async (evt, arg) => {
      try {
        const validated = entry.validate(arg)
        return await entry.handler(validated, ctx, evt)
      } catch (err) {
        if (err instanceof IpcValidationError) {
          ctx.logger.warn(`ipc:${entry.channel}:validation-failed`, { message: (err as Error).message })
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

## Preload counterpart

```typescript
// src/preload.ts (bundled with esbuild)
import { contextBridge, ipcRenderer } from 'electron'
const PING = 'app:ping'
const ECHO = 'app:echo'
contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke(PING),
  echo: (message: string) => ipcRenderer.invoke(ECHO, { message }),
})
```

## Test Pattern

```typescript
// Unit test — inject fake context
const fakeCtx = { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }
const echoEntry = IPC_REGISTRY.find(e => e.channel === 'app:echo')!
const validated = echoEntry.validate({ message: 'hello' })
const result = await echoEntry.handler(validated, fakeCtx as any, {} as any)
expect(result).toEqual({ echo: 'HELLO' })

// Reject invalid
expect(() => echoEntry.validate({ message: '' })).toThrow(IpcValidationError)
```

## Watch Out For

- Errors thrown across IPC lose their `name` (G-03). If callers need to distinguish error types, encode the type in the message string: `throw new Error('AUTH_REQUIRED:reason')`.
- Never expose `ipcRenderer` directly — only named wrappers.
- Channel strings must match between `IPC_CHANNELS`, preload, and registry.

Evidence: `../../05_distillation/patterns/P-02-ipc-registry-with-validators.md`, `../../05_distillation/gotchas/G-03-contextbridge-drops-error-name.md`
