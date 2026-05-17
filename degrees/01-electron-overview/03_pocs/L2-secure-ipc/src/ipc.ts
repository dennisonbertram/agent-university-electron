/**
 * IPC channel registry — the single source of truth for L2's IPC surface.
 *
 * Every entry has:
 *   - channel:   string (the IPC channel name, verb:noun namespacing)
 *   - validator: validates the renderer's argument; throws IpcValidationError on bad input
 *   - handler:   the main-process function that produces the response
 *   - kind:      'invoke' (request/response) or 'send' (fire-and-forget)
 *
 * R-L2-2 enumerates this registry and asserts every channel has both a
 * validator and a handler — so a new channel cannot ship without validation.
 *
 * Error envelope for the renderer:
 *   - On validation failure: throws IpcValidationError. Electron forwards
 *     the Error's `name` + `message` to the renderer via structured clone,
 *     so the renderer sees a rejected Promise where `err.name ===
 *     'IpcValidationError'`. (BT-L2-5 asserts this.)
 *   - On handler failure: throws a plain Error; the renderer sees the
 *     message but not the type.
 */
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { validators, type Validator, IpcValidationError } from './ipc-validation'
import type { Logger } from './log'

export interface IpcRegistryEntry<TArg = unknown, TResult = unknown> {
  channel: string
  kind: 'invoke' | 'send'
  validator: Validator<TArg>
  handler: (arg: TArg, event: IpcMainInvokeEvent, ctx: HandlerContext) => TResult | Promise<TResult>
}

export interface HandlerContext {
  /** Logger scoped to module: 'ipc'. */
  logger: Logger
  /** Monotonic-ms reading captured by the registered handler. */
  monotonicNow: () => number
}

/** Stable IPC channel names. Mirror these in the renderer-facing API surface. */
export const IPC_CHANNELS = {
  PING: 'app:ping',
  ECHO: 'app:echo',
  JOURNAL_APPEND: 'journal:append',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

/** Main-only "push" channels — main → renderer via webContents.send. */
export const PUSH_CHANNELS = {
  TICK: 'tick',
} as const

/**
 * The registry. Each handler runs AFTER the validator has passed; on
 * validation failure the registration wrapper logs `ipc:<channel>:validation-failed`
 * and rethrows the IpcValidationError.
 */
export const IPC_REGISTRY = {
  PING: {
    channel: IPC_CHANNELS.PING,
    kind: 'invoke' as const,
    validator: validators.ping,
    handler: (_arg: void, _event: IpcMainInvokeEvent, ctx: HandlerContext): {
      pong: true
      ts: number
      monotonic: number
    } => {
      const ts = Date.now()
      const monotonic = ctx.monotonicNow()
      ctx.logger.info('ipc:ping:served', { ts, monotonic })
      return { pong: true, ts, monotonic }
    },
  },
  ECHO: {
    channel: IPC_CHANNELS.ECHO,
    kind: 'invoke' as const,
    validator: validators.echo,
    handler: (arg: unknown, _event: IpcMainInvokeEvent, ctx: HandlerContext): unknown => {
      // Estimate the payload size by JSON-stringifying it (good enough for logging).
      let payloadSize = 0
      try {
        payloadSize = JSON.stringify(arg ?? null).length
      } catch {
        payloadSize = -1
      }
      ctx.logger.info('ipc:echo:served', { payloadSize, type: typeof arg })
      return arg
    },
  },
  JOURNAL_APPEND: {
    channel: IPC_CHANNELS.JOURNAL_APPEND,
    kind: 'invoke' as const,
    validator: validators.journalAppend,
    handler: (arg: { text: string }, _event: IpcMainInvokeEvent, ctx: HandlerContext): { ok: true } => {
      ctx.logger.info('ipc:journal:append:served', { textLength: arg.text.length })
      return { ok: true }
    },
  },
} as const

/**
 * Channel-name → suffix used in the validation-failed log entry.
 * `journal:append` -> `journal:append:validation-failed`.
 */
function validationFailedEvent(channel: string): string {
  return `ipc:${channel}:validation-failed`
}

/**
 * Sentinel prefix used to encode "this is an IpcValidationError" across the
 * main→renderer IPC boundary. Electron's structured-clone of errors thrown
 * inside ipcMain.handle preserves only the `message` field — the `name` is
 * always 'Error' on the renderer side (see 01_research/04-ipc-patterns.md
 * "Error Handling in invoke/handle"). The preload strips this prefix and
 * re-constructs an Error with `name === 'IpcValidationError'`.
 */
export const IPC_VALIDATION_ERROR_PREFIX = '__IPCVE__:'

/**
 * Attaches every channel in IPC_REGISTRY to ipcMain. Wraps each handler in:
 *  1. validator(arg) — throws IpcValidationError on bad input;
 *     the wrapper logs `ipc:<channel>:validation-failed` and rethrows.
 *  2. handler(validatedArg, event, ctx) — runs only on validator success.
 *
 * Both `invoke` and `send` kinds are supported. Currently the L2 registry uses
 * only `invoke`; the dispatch on `kind` keeps the surface ready for future
 * fire-and-forget channels without changing the registry shape.
 */
export function registerIpc(ipcMain: IpcMain, logger: Logger): void {
  const monotonicNow = (): number => {
    // Math.floor(performance.now()) — Node 22's perf_hooks export is exposed
    // as a global `performance` in Electron's main process. Falls back to
    // Date.now() - boot if unavailable (shouldn't happen in Electron 42).
    const perf = (globalThis as { performance?: { now(): number } }).performance
    if (perf && typeof perf.now === 'function') return Math.floor(perf.now())
    return Date.now()
  }

  const ctx: HandlerContext = { logger, monotonicNow }

  for (const entry of Object.values(IPC_REGISTRY)) {
    const channelEntry = entry as IpcRegistryEntry
    const { channel, kind, validator, handler } = channelEntry

    if (kind === 'invoke') {
      ipcMain.handle(channel, async (event, rawArg: unknown): Promise<unknown> => {
        let validated: unknown
        try {
          validated = validator(rawArg)
        } catch (err) {
          if (err instanceof IpcValidationError) {
            logger.warn(validationFailedEvent(channel), {
              message: err.message,
              receivedType: typeof rawArg,
            })
            // Electron strips the Error `name` across the IPC boundary —
            // encode it in the message via a sentinel prefix that the
            // preload strips back off to reconstruct the typed error.
            throw new Error(`${IPC_VALIDATION_ERROR_PREFIX}${err.message}`)
          }
          logger.error(validationFailedEvent(channel), {
            message: err instanceof Error ? err.message : String(err),
            receivedType: typeof rawArg,
            kind: 'non-validation-error',
          })
          throw err
        }
        return handler(validated, event, ctx)
      })
    } else {
      ipcMain.on(channel, (event, rawArg: unknown): void => {
        let validated: unknown
        try {
          validated = validator(rawArg)
        } catch (err) {
          if (err instanceof IpcValidationError) {
            logger.warn(validationFailedEvent(channel), {
              message: err.message,
              receivedType: typeof rawArg,
            })
          }
          return
        }
        try {
          void handler(validated, event as unknown as IpcMainInvokeEvent, ctx)
        } catch (err) {
          logger.error(`ipc:${channel}:handler-failed`, {
            message: err instanceof Error ? err.message : String(err),
          })
        }
      })
    }
  }
}

// Re-export so callers don't need to dig into ipc-validation.ts.
export { IpcValidationError }
