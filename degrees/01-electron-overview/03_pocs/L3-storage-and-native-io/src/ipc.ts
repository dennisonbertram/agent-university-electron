/**
 * IPC channel registry — extends L2 with storage + native-IO channels.
 *
 * Every entry has:
 *   - channel:   string (verb:noun namespacing)
 *   - validator: validates the renderer's argument; throws IpcValidationError on bad input
 *   - handler:   the main-process function that produces the response
 *   - kind:      'invoke' (request/response) or 'send' (fire-and-forget)
 *
 * Channels added at L3:
 *   - journal:append      → { id, ts, text } entry
 *   - journal:list        → readonly JournalEntry[]
 *   - dialog:open         → { canceled, filePaths }
 *   - dialog:save         → { canceled, filePath }
 *   - files:dropped       → { ok, count }
 *   - app:get-menu-tree   → MenuTreeNode[]
 *
 * Push channels (main → renderer):
 *   - tick                (carry forward from L2)
 *   - file:changed        (NEW — from the file watcher)
 *
 * NOTE — RED commit: handlers for the L3-new channels delegate to stubs in
 * storage/watch/menu that throw `not implemented`. The wrapper still runs the
 * validator first, so validation-failed log entries still fire.
 */
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { validators, type Validator, IpcValidationError, type DialogOpenArgs, type DialogSaveArgs } from './ipc-validation'
import type { Logger } from './log'

export interface IpcRegistryEntry<TArg = unknown, TResult = unknown> {
  channel: string
  kind: 'invoke' | 'send'
  validator: Validator<TArg>
  handler: (arg: TArg, event: IpcMainInvokeEvent, ctx: HandlerContext) => TResult | Promise<TResult>
}

/**
 * Context passed to every handler. Includes the logger and a monotonic clock
 * plus pluggable adapters for L3's stateful services (storage, dialogs).
 * Adapters are injected at registration time so unit tests / e2e seams can
 * substitute stubs without touching the registry.
 */
export interface HandlerContext {
  logger: Logger
  monotonicNow: () => number
  storage: {
    append(text: string): Promise<{ id: string; ts: string; text: string }>
    list(): Promise<ReadonlyArray<{ id: string; ts: string; text: string }>>
  }
  dialogs: {
    open(args: DialogOpenArgs): Promise<{ canceled: boolean; filePaths: readonly string[] }>
    save(args: DialogSaveArgs): Promise<{ canceled: boolean; filePath: string | null }>
  }
  menus: {
    getTree(): ReadonlyArray<{
      label: string
      id?: string
      role?: string
      accelerator?: string
      type?: string
      submenu?: ReadonlyArray<unknown>
    }>
  }
}

export const IPC_CHANNELS = {
  PING: 'app:ping',
  ECHO: 'app:echo',
  JOURNAL_APPEND: 'journal:append',
  JOURNAL_LIST: 'journal:list',
  DIALOG_OPEN: 'dialog:open',
  DIALOG_SAVE: 'dialog:save',
  FILES_DROPPED: 'files:dropped',
  APP_GET_MENU: 'app:get-menu-tree',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export const PUSH_CHANNELS = {
  TICK: 'tick',
  FILE_CHANGED: 'file:changed',
} as const

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
    handler: async (
      arg: { text: string },
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): Promise<{ ok: true; entry: { id: string; ts: string; text: string } }> => {
      const entry = await ctx.storage.append(arg.text)
      ctx.logger.info('ipc:journal:append:served', { id: entry.id, textLength: entry.text.length })
      return { ok: true, entry }
    },
  },
  JOURNAL_LIST: {
    channel: IPC_CHANNELS.JOURNAL_LIST,
    kind: 'invoke' as const,
    validator: validators.journalList,
    handler: async (
      _arg: void,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): Promise<ReadonlyArray<{ id: string; ts: string; text: string }>> => {
      const entries = await ctx.storage.list()
      ctx.logger.info('ipc:journal:list:served', { count: entries.length })
      return entries
    },
  },
  DIALOG_OPEN: {
    channel: IPC_CHANNELS.DIALOG_OPEN,
    kind: 'invoke' as const,
    validator: validators.dialogOpen,
    handler: async (
      arg: DialogOpenArgs,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): Promise<{ canceled: boolean; filePaths: readonly string[] }> => {
      const result = await ctx.dialogs.open(arg)
      ctx.logger.info('ipc:dialog:open:served', {
        canceled: result.canceled,
        count: result.filePaths.length,
      })
      return result
    },
  },
  DIALOG_SAVE: {
    channel: IPC_CHANNELS.DIALOG_SAVE,
    kind: 'invoke' as const,
    validator: validators.dialogSave,
    handler: async (
      arg: DialogSaveArgs,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): Promise<{ canceled: boolean; filePath: string | null }> => {
      const result = await ctx.dialogs.save(arg)
      ctx.logger.info('ipc:dialog:save:served', {
        canceled: result.canceled,
        hasPath: result.filePath !== null,
      })
      return result
    },
  },
  FILES_DROPPED: {
    channel: IPC_CHANNELS.FILES_DROPPED,
    kind: 'invoke' as const,
    validator: validators.filesDropped,
    handler: (
      arg: readonly string[],
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): { ok: true; count: number } => {
      ctx.logger.info('files:dropped', { count: arg.length, paths: arg })
      return { ok: true, count: arg.length }
    },
  },
  APP_GET_MENU: {
    channel: IPC_CHANNELS.APP_GET_MENU,
    kind: 'invoke' as const,
    validator: validators.appGetMenu,
    handler: (
      _arg: void,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): ReadonlyArray<unknown> => {
      const tree = ctx.menus.getTree()
      ctx.logger.info('ipc:app:get-menu-tree:served', { rootCount: tree.length })
      return tree
    },
  },
} as const

function validationFailedEvent(channel: string): string {
  return `ipc:${channel}:validation-failed`
}

export const IPC_VALIDATION_ERROR_PREFIX = '__IPCVE__:'

export function registerIpc(ipcMain: IpcMain, ctx: HandlerContext): void {
  const { logger } = ctx
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

export { IpcValidationError }
