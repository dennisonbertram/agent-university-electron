# P-02 — IPC channel registry with per-channel validators

**When to use**: any Electron app with more than 2 IPC channels.
**Evidence**: L2 (`03_pocs/L2-secure-ipc/src/ipc.ts`), L3, L4, L5, capstone — all extend this same shape.

## Pattern

```typescript
// src/ipc.ts
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { validateAppPing, validateJournalAppend, IpcValidationError } from './ipc-validation'
import type { Logger } from './log'

export const IPC_CHANNELS = {
  APP_PING: 'app:ping',
  JOURNAL_APPEND: 'journal:append',
  // ...
} as const

export interface HandlerContext {
  logger: Logger
  monotonicNow(): number
  // ... module adapters
}

interface RegistryEntry<A, R> {
  channel: string
  kind: 'invoke'
  validate: (arg: unknown) => A
  handler: (arg: A, ctx: HandlerContext, evt: IpcMainInvokeEvent) => Promise<R> | R
}

export const IPC_REGISTRY: ReadonlyArray<RegistryEntry<unknown, unknown>> = [
  {
    channel: IPC_CHANNELS.APP_PING,
    kind: 'invoke',
    validate: () => undefined,
    handler: (_arg, ctx) => ({ ts: ctx.monotonicNow() }),
  },
  {
    channel: IPC_CHANNELS.JOURNAL_APPEND,
    kind: 'invoke',
    validate: validateJournalAppend,
    handler: async (arg, ctx) => ctx.journal.append(arg.text),
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
          ctx.logger.warn(`ipc:${entry.channel}:validation-failed`, {
            message: err.message,
          })
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

## Why it works

- **Single registration site** — every channel is in the array. Adding a channel forces the developer to write a validator.
- **Validator is mandatory** — the wrapper calls `entry.validate(arg)` before `entry.handler`. No path to bypass.
- **Structured log markers** — `ipc:<ch>:served` and `ipc:<ch>:validation-failed` are deterministic test signals.
- **Test-friendly** — `HandlerContext` is injectable; unit tests can construct a fake context with stub adapters and exercise handlers without Electron.

## Tradeoffs

- Boilerplate per channel (validator + entry). Mitigated by `validateNoArgs` / `validatePlainString` helpers.
- The `unknown` typing on the registry array loses some end-to-end type-safety. Helpers like `defineChannel<A, R>(...)` can recover it.

## Variants

- **Generated typed bindings** — once channels stabilize, codegen `window.api.<channelMethod>` signatures from the registry.
- **Per-channel test seam** — append a `gateEnv?: string` field to gate registration on an env var (used for `test:*` channels — see P-07).

## Evidence

- `03_pocs/L2-secure-ipc/src/ipc.ts`
- `03_pocs/L-capstone-pulse/src/ipc.ts`
- `03_pocs/L2-secure-ipc/poc-report.md` §5 invariants 1, 5
- `01_research/04-ipc-patterns.md` lines 200-218
