/**
 * IPC channel registry — extends L3 with deep macOS integration channels.
 *
 * Every entry has:
 *   - channel:   string (verb:noun namespacing)
 *   - validator: validates the renderer's argument; throws IpcValidationError on bad input
 *   - handler:   the main-process function that produces the response
 *   - kind:      'invoke' (request/response) or 'send' (fire-and-forget)
 *
 * Channels added at L4:
 *   - tray:set-state        → { ok: true, view: TrayStateView }
 *   - app:get-tray-state    → TrayStateView
 *   - notification:show     → { ok, id, failed? }
 *   - app:set-autolaunch    → { requested, observed }
 *   - app:get-autolaunch    → { openAtLogin }
 *   - app:set-theme         → ThemeSnapshot
 *   - app:get-theme         → ThemeSnapshot
 *   - dock:set-badge        → { ok, badge }
 *   - app:add-recent        → { ok }
 *
 *   Test-only channels (only registered when NODE_ENV === 'test' OR
 *   L4_TEST_HOOKS === '1'):
 *
 *   - test:fire-shortcut         → { ok, fired }
 *   - test:emit-power-event      → { ok }
 *   - test:trigger-will-quit     → { ok }
 *   - test:emit-open-url         → { ok }
 *   - test:emit-second-instance  → { ok }
 *
 * Push channels (main → renderer):
 *   - tick                   (carry forward from L2)
 *   - file:changed           (carry forward from L3)
 *   - shortcut:fired         (NEW — globalShortcut handler ran)
 *   - lifecycle:open-url     (NEW — deep-link arrived)
 *   - theme:changed          (NEW — nativeTheme.updated fired)
 *   - notification:failed    (NEW — Notification.failed listener observed)
 */
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import {
  validators,
  type Validator,
  IpcValidationError,
  type DialogOpenArgs,
  type DialogSaveArgs,
  type TraySetStateArgs,
  type NotificationShowArgs,
  type AppSetAutoLaunchArgs,
  type AppSetThemeArgs,
  type DockSetBadgeArgs,
  type AppAddRecentArgs,
  type TestFireShortcutArgs,
  type TestEmitPowerArgs,
  type TestEmitOpenUrlArgs,
  type TestEmitSecondInstanceArgs,
} from './ipc-validation'
import type { Logger } from './log'
import type { TrayStateView } from './tray'
import type { ShowResult } from './notifications'
import type { ThemeSnapshot } from './theme'

export interface IpcRegistryEntry<TArg = unknown, TResult = unknown> {
  channel: string
  kind: 'invoke' | 'send'
  validator: Validator<TArg>
  handler: (arg: TArg, event: IpcMainInvokeEvent, ctx: HandlerContext) => TResult | Promise<TResult>
}

/**
 * Context passed to every handler. Inherits the L3 surface (storage, dialogs,
 * menus) and adds the L4 service adapters.
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
    getTree(): ReadonlyArray<unknown>
  }
  // L4-new adapters
  tray: {
    setState(state: TraySetStateArgs['state']): TrayStateView
    getState(): TrayStateView
  }
  notifications: {
    show(args: NotificationShowArgs): Promise<ShowResult>
  }
  autolaunch: {
    set(enabled: boolean): { requested: boolean; observed: boolean }
    get(): { openAtLogin: boolean; status?: string }
  }
  theme: {
    setSource(source: AppSetThemeArgs['source']): ThemeSnapshot
    snapshot(): ThemeSnapshot
  }
  dock: {
    setBadge(badge: string): { ok: boolean; badge: string }
    addRecentDocument(filePath: string): { ok: boolean }
  }
  test: {
    fireShortcut(accelerator: string): { ok: boolean; fired: boolean }
    emitPower(event: TestEmitPowerArgs['event']): { ok: boolean }
    triggerWillQuit(): { ok: boolean }
    emitOpenUrl(url: string): { ok: boolean }
    emitSecondInstance(argv: readonly string[]): { ok: boolean }
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
  // L4
  TRAY_SET_STATE: 'tray:set-state',
  APP_GET_TRAY_STATE: 'app:get-tray-state',
  NOTIFICATION_SHOW: 'notification:show',
  APP_SET_AUTOLAUNCH: 'app:set-autolaunch',
  APP_GET_AUTOLAUNCH: 'app:get-autolaunch',
  APP_SET_THEME: 'app:set-theme',
  APP_GET_THEME: 'app:get-theme',
  DOCK_SET_BADGE: 'dock:set-badge',
  APP_ADD_RECENT: 'app:add-recent',
  // L4 test seams
  TEST_FIRE_SHORTCUT: 'test:fire-shortcut',
  TEST_EMIT_POWER: 'test:emit-power-event',
  TEST_TRIGGER_WILL_QUIT: 'test:trigger-will-quit',
  TEST_EMIT_OPEN_URL: 'test:emit-open-url',
  TEST_EMIT_SECOND_INSTANCE: 'test:emit-second-instance',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export const PUSH_CHANNELS = {
  TICK: 'tick',
  FILE_CHANGED: 'file:changed',
  // L4 push
  SHORTCUT_FIRED: 'shortcut:fired',
  LIFECYCLE_OPEN_URL: 'lifecycle:open-url',
  THEME_CHANGED: 'theme:changed',
  NOTIFICATION_FAILED: 'notification:failed',
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
  // ---- L4 channels ----
  TRAY_SET_STATE: {
    channel: IPC_CHANNELS.TRAY_SET_STATE,
    kind: 'invoke' as const,
    validator: validators.traySetState,
    handler: (
      arg: TraySetStateArgs,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): { ok: true; view: TrayStateView } => {
      const view = ctx.tray.setState(arg.state)
      ctx.logger.info('ipc:tray:set-state:served', { state: view.state, title: view.title })
      return { ok: true, view }
    },
  },
  APP_GET_TRAY_STATE: {
    channel: IPC_CHANNELS.APP_GET_TRAY_STATE,
    kind: 'invoke' as const,
    validator: validators.appGetTrayState,
    handler: (
      _arg: void,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): TrayStateView => {
      const view = ctx.tray.getState()
      ctx.logger.info('ipc:app:get-tray-state:served', { state: view.state })
      return view
    },
  },
  NOTIFICATION_SHOW: {
    channel: IPC_CHANNELS.NOTIFICATION_SHOW,
    kind: 'invoke' as const,
    validator: validators.notificationShow,
    handler: async (
      arg: NotificationShowArgs,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): Promise<ShowResult> => {
      const result = await ctx.notifications.show(arg)
      ctx.logger.info('ipc:notification:show:served', {
        ok: result.ok,
        id: result.id,
        hasFailure: result.failed !== undefined,
      })
      return result
    },
  },
  APP_SET_AUTOLAUNCH: {
    channel: IPC_CHANNELS.APP_SET_AUTOLAUNCH,
    kind: 'invoke' as const,
    validator: validators.appSetAutoLaunch,
    handler: (
      arg: AppSetAutoLaunchArgs,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): { requested: boolean; observed: boolean } => {
      const result = ctx.autolaunch.set(arg.enabled)
      ctx.logger.info('ipc:app:set-autolaunch:served', { ...result })
      return result
    },
  },
  APP_GET_AUTOLAUNCH: {
    channel: IPC_CHANNELS.APP_GET_AUTOLAUNCH,
    kind: 'invoke' as const,
    validator: validators.appGetAutoLaunch,
    handler: (
      _arg: void,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): { openAtLogin: boolean; status?: string } => {
      const settings = ctx.autolaunch.get()
      ctx.logger.info('ipc:app:get-autolaunch:served', { ...settings })
      return settings
    },
  },
  APP_SET_THEME: {
    channel: IPC_CHANNELS.APP_SET_THEME,
    kind: 'invoke' as const,
    validator: validators.appSetTheme,
    handler: (
      arg: AppSetThemeArgs,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): ThemeSnapshot => {
      const snapshot = ctx.theme.setSource(arg.source)
      ctx.logger.info('ipc:app:set-theme:served', { ...snapshot })
      return snapshot
    },
  },
  APP_GET_THEME: {
    channel: IPC_CHANNELS.APP_GET_THEME,
    kind: 'invoke' as const,
    validator: validators.appGetTheme,
    handler: (
      _arg: void,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): ThemeSnapshot => {
      const snapshot = ctx.theme.snapshot()
      ctx.logger.info('ipc:app:get-theme:served', { ...snapshot })
      return snapshot
    },
  },
  DOCK_SET_BADGE: {
    channel: IPC_CHANNELS.DOCK_SET_BADGE,
    kind: 'invoke' as const,
    validator: validators.dockSetBadge,
    handler: (
      arg: DockSetBadgeArgs,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): { ok: boolean; badge: string } => {
      const out = ctx.dock.setBadge(arg.badge)
      ctx.logger.info('ipc:dock:set-badge:served', { ok: out.ok, badge: out.badge })
      return out
    },
  },
  APP_ADD_RECENT: {
    channel: IPC_CHANNELS.APP_ADD_RECENT,
    kind: 'invoke' as const,
    validator: validators.appAddRecent,
    handler: (
      arg: AppAddRecentArgs,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): { ok: boolean } => {
      const out = ctx.dock.addRecentDocument(arg.filePath)
      ctx.logger.info('ipc:app:add-recent:served', { ok: out.ok, filePath: arg.filePath })
      return out
    },
  },
  // ---- L4 test-only channels ----
  TEST_FIRE_SHORTCUT: {
    channel: IPC_CHANNELS.TEST_FIRE_SHORTCUT,
    kind: 'invoke' as const,
    validator: validators.testFireShortcut,
    handler: (
      arg: TestFireShortcutArgs,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): { ok: boolean; fired: boolean } => {
      const out = ctx.test.fireShortcut(arg.accelerator)
      ctx.logger.info('ipc:test:fire-shortcut:served', { accelerator: arg.accelerator, fired: out.fired })
      return out
    },
  },
  TEST_EMIT_POWER: {
    channel: IPC_CHANNELS.TEST_EMIT_POWER,
    kind: 'invoke' as const,
    validator: validators.testEmitPower,
    handler: (
      arg: TestEmitPowerArgs,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): { ok: boolean } => {
      const out = ctx.test.emitPower(arg.event)
      ctx.logger.info('ipc:test:emit-power-event:served', { event: arg.event })
      return out
    },
  },
  TEST_TRIGGER_WILL_QUIT: {
    channel: IPC_CHANNELS.TEST_TRIGGER_WILL_QUIT,
    kind: 'invoke' as const,
    validator: validators.testTriggerWillQuit,
    handler: (
      _arg: void,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): { ok: boolean } => {
      const out = ctx.test.triggerWillQuit()
      ctx.logger.info('ipc:test:trigger-will-quit:served', {})
      return out
    },
  },
  TEST_EMIT_OPEN_URL: {
    channel: IPC_CHANNELS.TEST_EMIT_OPEN_URL,
    kind: 'invoke' as const,
    validator: validators.testEmitOpenUrl,
    handler: (
      arg: TestEmitOpenUrlArgs,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): { ok: boolean } => {
      const out = ctx.test.emitOpenUrl(arg.url)
      ctx.logger.info('ipc:test:emit-open-url:served', { url: arg.url })
      return out
    },
  },
  TEST_EMIT_SECOND_INSTANCE: {
    channel: IPC_CHANNELS.TEST_EMIT_SECOND_INSTANCE,
    kind: 'invoke' as const,
    validator: validators.testEmitSecondInstance,
    handler: (
      arg: TestEmitSecondInstanceArgs,
      _event: IpcMainInvokeEvent,
      ctx: HandlerContext,
    ): { ok: boolean } => {
      const out = ctx.test.emitSecondInstance(arg.argv)
      ctx.logger.info('ipc:test:emit-second-instance:served', { argvCount: arg.argv.length })
      return out
    },
  },
} as const

function validationFailedEvent(channel: string): string {
  return `ipc:${channel}:validation-failed`
}

export const IPC_VALIDATION_ERROR_PREFIX = '__IPCVE__:'

/**
 * Returns `true` when the test-only channels should be exposed. Gated by env
 * vars so a real distribution does not surface the seams.
 */
export function testHooksEnabled(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.L4_TEST_HOOKS === '1'
}

const TEST_ONLY_CHANNELS = new Set<string>([
  IPC_CHANNELS.TEST_FIRE_SHORTCUT,
  IPC_CHANNELS.TEST_EMIT_POWER,
  IPC_CHANNELS.TEST_TRIGGER_WILL_QUIT,
  IPC_CHANNELS.TEST_EMIT_OPEN_URL,
  IPC_CHANNELS.TEST_EMIT_SECOND_INSTANCE,
])

export function registerIpc(ipcMain: IpcMain, ctx: HandlerContext): void {
  const { logger } = ctx
  const exposeTestHooks = testHooksEnabled()
  for (const entry of Object.values(IPC_REGISTRY)) {
    const channelEntry = entry as IpcRegistryEntry
    const { channel, kind, validator, handler } = channelEntry

    if (TEST_ONLY_CHANNELS.has(channel) && !exposeTestHooks) {
      continue
    }

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
