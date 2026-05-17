/**
 * Preload — exposes `window.api` to the renderer via contextBridge.
 *
 * Pulse adds focus + journal-encrypted + new test seams to the L5 surface.
 * The test seams (testAdvanceClock, testTriggerNotificationAction,
 * testFireDeepLink) are wired unconditionally on the preload side; main-side
 * registration is gated by `testHooksEnabled()` so a real distribution
 * cannot reach them.
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, PUSH_CHANNELS, IPC_VALIDATION_ERROR_PREFIX } from './ipc'

type StateListener<T> = (payload: T) => void

async function rethrowingInvoke<T>(channel: string, arg?: unknown): Promise<T> {
  try {
    const result = await ipcRenderer.invoke(channel, arg)
    return result as T
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const sentinelIdx = message.indexOf(IPC_VALIDATION_ERROR_PREFIX)
    if (sentinelIdx >= 0) {
      const real = message.slice(sentinelIdx + IPC_VALIDATION_ERROR_PREFIX.length)
      throw { name: 'IpcValidationError', message: real }
    }
    throw err
  }
}

const api = {
  ping(): Promise<{ pong: true; ts: number; monotonic: number }> {
    return rethrowingInvoke(IPC_CHANNELS.PING)
  },
  echo<T>(value: T): Promise<T> {
    return rethrowingInvoke<T>(IPC_CHANNELS.ECHO, value)
  },
  // L4 carry
  traySetState(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TRAY_SET_STATE, args)
  },
  appGetTrayState(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.APP_GET_TRAY_STATE)
  },
  notificationShow(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.NOTIFICATION_SHOW, args)
  },
  appSetAutoLaunch(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.APP_SET_AUTOLAUNCH, args)
  },
  appGetAutoLaunch(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.APP_GET_AUTOLAUNCH)
  },
  appSetTheme(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.APP_SET_THEME, args)
  },
  appGetTheme(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.APP_GET_THEME)
  },
  dockSetBadge(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.DOCK_SET_BADGE, args)
  },
  appAddRecent(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.APP_ADD_RECENT, args)
  },
  // L5 test seams
  testCheckForUpdates(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_CHECK_FOR_UPDATES)
  },
  testGetUpdaterState(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_GET_UPDATER_STATE)
  },
  testGetCrashReporterState(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_GET_CRASH_REPORTER_STATE)
  },
  // L4 test seams
  testFireShortcut(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_FIRE_SHORTCUT, args)
  },
  testEmitPower(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_EMIT_POWER, args)
  },
  testTriggerWillQuit(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_TRIGGER_WILL_QUIT)
  },
  testEmitOpenUrl(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_EMIT_OPEN_URL, args)
  },
  testEmitSecondInstance(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_EMIT_SECOND_INSTANCE, args)
  },
  // ---- Pulse new ----
  focusStart(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.FOCUS_START, args)
  },
  focusStop(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.FOCUS_STOP)
  },
  focusState(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.FOCUS_STATE)
  },
  focusExtend(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.FOCUS_EXTEND, args)
  },
  journalAppend(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.JOURNAL_APPEND, args)
  },
  journalList(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.JOURNAL_LIST)
  },
  journalUnlockWithPassphrase(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.JOURNAL_UNLOCK_WITH_PASSPHRASE, args)
  },
  journalSetPassphrase(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.JOURNAL_SET_PASSPHRASE, args)
  },
  testAdvanceClock(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_ADVANCE_CLOCK, args)
  },
  testTriggerNotificationAction(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_TRIGGER_NOTIFICATION_ACTION, args)
  },
  testFireDeepLink(args: unknown): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_FIRE_DEEP_LINK, args)
  },
  testGetBootSummary(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_GET_BOOT_SUMMARY)
  },
  // ---- push channels ----
  onShortcutFired(cb: StateListener<{ accelerator: string }>): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (typeof payload === 'object' && payload !== null) {
        cb(payload as { accelerator: string })
      }
    }
    ipcRenderer.on(PUSH_CHANNELS.SHORTCUT_FIRED, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.SHORTCUT_FIRED, handler)
  },
  onOpenUrl(cb: StateListener<{ url: string; origin: 'open-url' | 'second-instance' }>): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (typeof payload === 'object' && payload !== null) {
        cb(payload as { url: string; origin: 'open-url' | 'second-instance' })
      }
    }
    ipcRenderer.on(PUSH_CHANNELS.LIFECYCLE_OPEN_URL, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.LIFECYCLE_OPEN_URL, handler)
  },
  onFocusStateChanged(cb: StateListener<unknown>): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => cb(payload)
    ipcRenderer.on(PUSH_CHANNELS.FOCUS_STATE, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.FOCUS_STATE, handler)
  },
  onJournalAppended(cb: StateListener<unknown>): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => cb(payload)
    ipcRenderer.on(PUSH_CHANNELS.JOURNAL_APPENDED, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.JOURNAL_APPENDED, handler)
  },
  onThemeChanged(cb: StateListener<unknown>): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => cb(payload)
    ipcRenderer.on(PUSH_CHANNELS.THEME_CHANGED, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.THEME_CHANGED, handler)
  },
  onNotificationFailed(cb: StateListener<{ id: string; error: string }>): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (typeof payload === 'object' && payload !== null) {
        cb(payload as { id: string; error: string })
      }
    }
    ipcRenderer.on(PUSH_CHANNELS.NOTIFICATION_FAILED, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.NOTIFICATION_FAILED, handler)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ApiSurface = typeof api
