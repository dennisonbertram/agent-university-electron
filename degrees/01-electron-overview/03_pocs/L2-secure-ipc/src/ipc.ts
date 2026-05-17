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
 * SKELETON (RED commit): registry is defined but `registerIpc` does NOT
 * actually attach the handlers to ipcMain. The unit tests can introspect
 * the registry shape; the e2e tests time out because nothing answers.
 */
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { validators, type Validator, IpcValidationError } from './ipc-validation'
import type { Logger } from './log'

export interface IpcRegistryEntry<TArg = unknown, TResult = unknown> {
  channel: string
  kind: 'invoke' | 'send'
  validator: Validator<TArg>
  handler: (arg: TArg, event: IpcMainInvokeEvent) => TResult | Promise<TResult>
}

/** Stable IPC channel names. Mirror these in the renderer-facing API surface. */
export const IPC_CHANNELS = {
  PING: 'app:ping',
  ECHO: 'app:echo',
  JOURNAL_APPEND: 'journal:append',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

/** Main-only "push" channel — main → renderer. Not in IPC_REGISTRY because it
 *  has no incoming arg to validate, but enumerated here for completeness. */
export const PUSH_CHANNELS = {
  TICK: 'tick',
} as const

/**
 * The registry. Each handler is intentionally a stub in the RED commit so the
 * e2e tests fail on real assertions (the handler never returns the expected
 * shape). GREEN will replace these with real implementations.
 */
export const IPC_REGISTRY = {
  PING: {
    channel: IPC_CHANNELS.PING,
    kind: 'invoke' as const,
    validator: validators.ping,
    handler: (): never => {
      throw new Error('PING handler not implemented (RED skeleton)')
    },
  },
  ECHO: {
    channel: IPC_CHANNELS.ECHO,
    kind: 'invoke' as const,
    validator: validators.echo,
    handler: (): never => {
      throw new Error('ECHO handler not implemented (RED skeleton)')
    },
  },
  JOURNAL_APPEND: {
    channel: IPC_CHANNELS.JOURNAL_APPEND,
    kind: 'invoke' as const,
    validator: validators.journalAppend,
    handler: (): never => {
      throw new Error('JOURNAL_APPEND handler not implemented (RED skeleton)')
    },
  },
} as const

/**
 * Attaches every channel in IPC_REGISTRY to ipcMain. Each handler:
 *  1. runs the channel's validator on the raw arg
 *  2. on failure, logs a validation-failed entry and throws IpcValidationError
 *     (which surfaces to the renderer as a rejected Promise with name === 'IpcValidationError')
 *  3. on success, calls the registered handler
 *
 * SKELETON: does nothing in the RED commit. GREEN implements it.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerIpc(_ipcMain: IpcMain, _logger: Logger): void {
  // RED skeleton — intentionally no-op so e2e tests fail on real assertions.
}

// Re-export so callers don't need to dig into ipc-validation.ts.
export { IpcValidationError }
