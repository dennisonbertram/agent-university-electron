/**
 * Preload — exposes `window.api` to the renderer via contextBridge.
 *
 * Carries forward L3's surface and adds the L4 wrappers:
 *   - traySetState / appGetTrayState
 *   - notificationShow
 *   - appSetAutoLaunch / appGetAutoLaunch
 *   - appSetTheme / appGetTheme
 *   - dockSetBadge / appAddRecent
 *   - onShortcutFired / onOpenUrl / onThemeChanged / onNotificationFailed push channels
 *   - test seams (only meaningful when L4_TEST_HOOKS=1 / NODE_ENV=test):
 *       testFireShortcut, testEmitPower, testTriggerWillQuit,
 *       testEmitOpenUrl, testEmitSecondInstance
 *
 * Note (Entry 1 in expectation-gap-ledger): under sandbox the preload can only
 * relative-import other bundled files via esbuild's bundling — channel
 * constants live in src/ipc.ts and are inlined at build time by build-preload.mjs.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC_CHANNELS, PUSH_CHANNELS, IPC_VALIDATION_ERROR_PREFIX } from './ipc'

type TickListener = (n: number) => void
type FileChangedListener = (event: {
  kind: 'rename' | 'add' | 'change' | 'unlink'
  path?: string
  oldPath?: string
  newPath?: string
}) => void
type ShortcutFiredListener = (payload: { accelerator: string }) => void
type OpenUrlListener = (payload: { url: string; origin: 'open-url' | 'second-instance' }) => void
type ThemeChangedListener = (payload: { source: 'system' | 'light' | 'dark'; isDark: boolean }) => void
type NotificationFailedListener = (payload: { id: string; error: string }) => void

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
  journalAppend(input: unknown): Promise<{
    ok: true
    entry: { id: string; ts: string; text: string }
  }> {
    return rethrowingInvoke(IPC_CHANNELS.JOURNAL_APPEND, input)
  },
  journalList(): Promise<ReadonlyArray<{ id: string; ts: string; text: string }>> {
    return rethrowingInvoke(IPC_CHANNELS.JOURNAL_LIST)
  },
  dialogOpen(args?: unknown): Promise<{ canceled: boolean; filePaths: readonly string[] }> {
    return rethrowingInvoke(IPC_CHANNELS.DIALOG_OPEN, args ?? {})
  },
  dialogSave(args?: unknown): Promise<{ canceled: boolean; filePath: string | null }> {
    return rethrowingInvoke(IPC_CHANNELS.DIALOG_SAVE, args ?? {})
  },
  filesDropped(paths: unknown): Promise<{ ok: true; count: number }> {
    return rethrowingInvoke(IPC_CHANNELS.FILES_DROPPED, paths)
  },
  getApplicationMenu(): Promise<ReadonlyArray<unknown>> {
    return rethrowingInvoke(IPC_CHANNELS.APP_GET_MENU)
  },
  getPathForFile(file: File): string {
    return webUtils.getPathForFile(file)
  },
  // ---- L4 ----
  traySetState(args: unknown): Promise<{ ok: true; view: { state: string; title: string; hasImage: boolean } }> {
    return rethrowingInvoke(IPC_CHANNELS.TRAY_SET_STATE, args)
  },
  appGetTrayState(): Promise<{ state: string; title: string; hasImage: boolean }> {
    return rethrowingInvoke(IPC_CHANNELS.APP_GET_TRAY_STATE)
  },
  notificationShow(args: unknown): Promise<{ ok: boolean; id: string; failed?: { error: string } }> {
    return rethrowingInvoke(IPC_CHANNELS.NOTIFICATION_SHOW, args)
  },
  appSetAutoLaunch(args: unknown): Promise<{ requested: boolean; observed: boolean }> {
    return rethrowingInvoke(IPC_CHANNELS.APP_SET_AUTOLAUNCH, args)
  },
  appGetAutoLaunch(): Promise<{ openAtLogin: boolean; status?: string }> {
    return rethrowingInvoke(IPC_CHANNELS.APP_GET_AUTOLAUNCH)
  },
  appSetTheme(args: unknown): Promise<{ source: string; isDark: boolean }> {
    return rethrowingInvoke(IPC_CHANNELS.APP_SET_THEME, args)
  },
  appGetTheme(): Promise<{ source: string; isDark: boolean }> {
    return rethrowingInvoke(IPC_CHANNELS.APP_GET_THEME)
  },
  dockSetBadge(args: unknown): Promise<{ ok: boolean; badge: string }> {
    return rethrowingInvoke(IPC_CHANNELS.DOCK_SET_BADGE, args)
  },
  appAddRecent(args: unknown): Promise<{ ok: boolean }> {
    return rethrowingInvoke(IPC_CHANNELS.APP_ADD_RECENT, args)
  },
  // ---- test seams ----
  testFireShortcut(args: unknown): Promise<{ ok: boolean; fired: boolean }> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_FIRE_SHORTCUT, args)
  },
  testEmitPower(args: unknown): Promise<{ ok: boolean }> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_EMIT_POWER, args)
  },
  testTriggerWillQuit(): Promise<{ ok: boolean }> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_TRIGGER_WILL_QUIT)
  },
  testEmitOpenUrl(args: unknown): Promise<{ ok: boolean }> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_EMIT_OPEN_URL, args)
  },
  testEmitSecondInstance(args: unknown): Promise<{ ok: boolean }> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_EMIT_SECOND_INSTANCE, args)
  },
  // ---- L5 test seams ----
  testCheckForUpdates(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_CHECK_FOR_UPDATES)
  },
  testGetUpdaterState(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_GET_UPDATER_STATE)
  },
  testGetCrashReporterState(): Promise<unknown> {
    return rethrowingInvoke(IPC_CHANNELS.TEST_GET_CRASH_REPORTER_STATE)
  },
  // ---- push channels ----
  onTick(cb: TickListener): () => void {
    const handler = (_event: Electron.IpcRendererEvent, n: unknown): void => {
      if (typeof n === 'number') cb(n)
    }
    ipcRenderer.on(PUSH_CHANNELS.TICK, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.TICK, handler)
  },
  onFileChanged(cb: FileChangedListener): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (typeof payload === 'object' && payload !== null) {
        cb(payload as Parameters<FileChangedListener>[0])
      }
    }
    ipcRenderer.on(PUSH_CHANNELS.FILE_CHANGED, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.FILE_CHANGED, handler)
  },
  onShortcutFired(cb: ShortcutFiredListener): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (typeof payload === 'object' && payload !== null) {
        cb(payload as Parameters<ShortcutFiredListener>[0])
      }
    }
    ipcRenderer.on(PUSH_CHANNELS.SHORTCUT_FIRED, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.SHORTCUT_FIRED, handler)
  },
  onOpenUrl(cb: OpenUrlListener): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (typeof payload === 'object' && payload !== null) {
        cb(payload as Parameters<OpenUrlListener>[0])
      }
    }
    ipcRenderer.on(PUSH_CHANNELS.LIFECYCLE_OPEN_URL, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.LIFECYCLE_OPEN_URL, handler)
  },
  onThemeChanged(cb: ThemeChangedListener): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (typeof payload === 'object' && payload !== null) {
        cb(payload as Parameters<ThemeChangedListener>[0])
      }
    }
    ipcRenderer.on(PUSH_CHANNELS.THEME_CHANGED, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.THEME_CHANGED, handler)
  },
  onNotificationFailed(cb: NotificationFailedListener): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (typeof payload === 'object' && payload !== null) {
        cb(payload as Parameters<NotificationFailedListener>[0])
      }
    }
    ipcRenderer.on(PUSH_CHANNELS.NOTIFICATION_FAILED, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.NOTIFICATION_FAILED, handler)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ApiSurface = typeof api
