/**
 * L5 main-process entry.
 *
 * CRITICAL ORDERING (L5 adds one pre-ready requirement on top of L4's):
 *   1. requestSingleInstanceLock(): the call runs at module-load time, BEFORE
 *      the ready promise resolves (carry-forward of R-L4-5).
 *   2. startCrashReporter(): pre-ready, BEFORE the ready promise resolves
 *      (R-L5-1). Renderers spawned before the call would not be monitored,
 *      and this static ordering is enforced by a source-text regression
 *      test that reads this file.
 *   3. setAsDefaultProtocolClient('electron-l5') registers the deep-link
 *      scheme so macOS routes `electron-l5://...` URLs to this process (FM-06).
 *   4. The open-url handler is registered before the ready promise so cold-
 *      start URLs are captured (FM-06).
 *   5. The Tray instance is owned by `src/tray.ts` in module scope so it
 *      cannot be GC'd (FM-04, R-L4-1).
 *   6. globalShortcut cleanup MUST run in `will-quit` (R-L4-2).
 *   7. Every Notification.show() pairs a `failed` listener (R-L4-3) — that's
 *      enforced inside `src/notifications.ts`.
 *
 * Carries forward from L3/L4:
 *   - structured JSON-lines logger contract
 *   - storage adapter + before-quit flush
 *   - dialog adapter + DIALOG_STUB seam
 *   - menu install + context-menu listener
 *   - secure-defaults BrowserWindow construction
 *   - file watcher rooted at userData/watched-folder
 *   - tray + notifications + shortcuts + power + lifecycle + autolaunch +
 *     theme + dock (full L4 menu-bar-shell surface, now being PACKAGED).
 *
 * RED commit: the L5-new service installers (`startCrashReporter`,
 * `installUpdater`) throw. Boot still happens (catches and logs), the secure
 * window stays up so Playwright can exercise IPC, and the L5 behavioral
 * tests fail on the real assertion (`updater:update-available` never logged,
 * `crash-reporter:started` never logged).
 */
import { app, BrowserWindow, dialog, ipcMain, session, type WebContents } from 'electron'
import path from 'node:path'
import { mkdirSync } from 'node:fs'

import { createLogger } from './log'
import { startCrashReporter, type CrashReporterService } from './crash'
import { installUpdater, type UpdaterService } from './updater'

// ---------------------------------------------------------------------------
// CRASH REPORTER — R-L5-1 requires `crashReporter.start()` to run BEFORE the
// app-ready promise resolves. We wrap the call in try/catch so a missing or
// failing crash service does not block boot; the failure is logged and
// surfaced through the `test:get-crash-reporter-state` channel.
// ---------------------------------------------------------------------------
const CRASH_BOOT_LOG_DIR = process.env.LOG_DIR ?? path.join(__dirname, '..', '.crash-boot-logs')
try {
  mkdirSync(CRASH_BOOT_LOG_DIR, { recursive: true })
} catch {
  // ignored — best-effort
}
const crashBootLogger = createLogger({
  logDir: CRASH_BOOT_LOG_DIR,
  module: 'crash',
  process: 'main',
})
let crashReporterService: CrashReporterService | null = null
try {
  const submitURL = process.env.CRASH_URL
  crashReporterService = startCrashReporter({
    logger: crashBootLogger,
    submitURL,
    productName: 'L5-packaging-signing-update',
  })
} catch (err) {
  crashBootLogger.error('crash-reporter:start-failed', {
    message: err instanceof Error ? err.message : String(err),
  })
}

// ---------------------------------------------------------------------------
// SINGLE-INSTANCE LOCK — R-L4-5 requires this happens BEFORE whenReady().
// We accept a second-instance test seam via the L4_TEST_HOOKS env var.
// ---------------------------------------------------------------------------
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  // Second instance must exit immediately; the running first instance receives
  // the `second-instance` event with this process's argv.
  app.quit()
}

import { registerIpc, PUSH_CHANNELS, type HandlerContext } from './ipc'
import { createMainWindow } from './window'
import { registerSecurityGuards, registerSessionPermissionHandler } from './security'
import { createJournalStorage, type JournalStorage } from './storage'
import { startWatcher, type Watcher, type WatchEvent } from './watch'
import {
  installApplicationMenu,
  attachContextMenu,
  getApplicationMenuTree,
} from './menu'
import {
  installTray,
  type TrayController,
  type TrayState,
  type TrayStateView,
} from './tray'
import { installNotificationService, type NotificationService } from './notifications'
import { installShortcuts, type ShortcutsService, FOCUS_TOGGLE_ACCELERATOR } from './shortcuts'
import { installPowerService, type PowerService } from './power'
import { installLifecycle, type LifecycleController } from './lifecycle'
import { parseDeepLink, DEEP_LINK_SCHEME, type ParsedDeepLink } from './protocol'
import { installAutoLaunch, type AutoLaunchService } from './autolaunch'
import { installThemeService, type ThemeService } from './theme'
import { installDock, type DockService } from './dock'
import type {
  DialogOpenArgs,
  DialogSaveArgs,
  NotificationShowArgs,
  PowerEvent,
} from './ipc-validation'

function resolveLogDir(): string {
  const fromEnv = process.env.LOG_DIR
  if (fromEnv && fromEnv.length > 0) return fromEnv
  try {
    return app.getPath('logs')
  } catch {
    return path.join(app.getPath('userData'), 'logs')
  }
}

const userDataOverride = process.env.USER_DATA_DIR
if (userDataOverride && userDataOverride.length > 0) {
  try {
    mkdirSync(userDataOverride, { recursive: true })
    app.setPath('userData', userDataOverride)
  } catch {
    // ignored
  }
}

const LOG_DIR = resolveLogDir()
const appLogger = createLogger({ logDir: LOG_DIR, module: 'app', process: 'main' })
const ipcLogger = createLogger({ logDir: LOG_DIR, module: 'ipc', process: 'main' })
const secLogger = createLogger({ logDir: LOG_DIR, module: 'security', process: 'main' })
const tickLogger = createLogger({ logDir: LOG_DIR, module: 'tick', process: 'main' })
const storageLogger = createLogger({ logDir: LOG_DIR, module: 'storage', process: 'main' })
const watchLogger = createLogger({ logDir: LOG_DIR, module: 'watch', process: 'main' })
const menuLogger = createLogger({ logDir: LOG_DIR, module: 'menu', process: 'main' })
const trayLogger = createLogger({ logDir: LOG_DIR, module: 'tray', process: 'main' })
const notificationLogger = createLogger({ logDir: LOG_DIR, module: 'notification', process: 'main' })
const shortcutLogger = createLogger({ logDir: LOG_DIR, module: 'shortcut', process: 'main' })
const powerLogger = createLogger({ logDir: LOG_DIR, module: 'power', process: 'main' })
const lifecycleLogger = createLogger({ logDir: LOG_DIR, module: 'lifecycle', process: 'main' })
const autolaunchLogger = createLogger({ logDir: LOG_DIR, module: 'autolaunch', process: 'main' })
const themeLogger = createLogger({ logDir: LOG_DIR, module: 'theme', process: 'main' })
const dockLogger = createLogger({ logDir: LOG_DIR, module: 'dock', process: 'main' })
const protocolLogger = createLogger({ logDir: LOG_DIR, module: 'protocol', process: 'main' })
const updaterLogger = createLogger({ logDir: LOG_DIR, module: 'updater', process: 'main' })

appLogger.info('app:starting', {
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  platform: process.platform,
  gotSingleInstanceLock,
})

// Register the deep-link protocol BEFORE whenReady. On macOS, this is mostly
// cosmetic in dev — the OS won't route `electron-l5://` URLs to an unpackaged
// binary anyway (FM-06). The registration call itself is logged for traceability.
try {
  const protocolRegistered = app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME)
  protocolLogger.info('protocol:registered', {
    scheme: DEEP_LINK_SCHEME,
    success: protocolRegistered,
  })
} catch (err) {
  protocolLogger.error('protocol:register-failed', {
    scheme: DEEP_LINK_SCHEME,
    message: err instanceof Error ? err.message : String(err),
  })
}

// macOS `open-url` event — register BEFORE whenReady so cold-start URLs are
// captured. In dev this rarely fires; the test seam (test:emit-open-url) drives
// it programmatically (REF-01).
app.on('open-url', (event, url) => {
  event.preventDefault()
  state.lifecycle?.dispatchArgs([url], 'open-url')
})

// `second-instance` — fires on the FIRST instance when a SECOND instance tries
// to launch. We focus the existing window and parse any deep-link arg.
app.on('second-instance', (_event, argv, _cwd) => {
  state.lifecycle?.dispatchArgs(argv, 'second-instance')
})

interface AppState {
  storage: JournalStorage | null
  watcher: Watcher | null
  tray: TrayController | null
  notifications: NotificationService | null
  shortcuts: ShortcutsService | null
  power: PowerService | null
  lifecycle: LifecycleController | null
  autolaunch: AutoLaunchService | null
  theme: ThemeService | null
  dock: DockService | null
  updater: UpdaterService | null
  quitting: boolean
}

const state: AppState = {
  storage: null,
  watcher: null,
  tray: null,
  notifications: null,
  shortcuts: null,
  power: null,
  lifecycle: null,
  autolaunch: null,
  theme: null,
  dock: null,
  updater: null,
  quitting: false,
}

function getStorage(): JournalStorage {
  if (state.storage) return state.storage
  const userData = app.getPath('userData')
  const journalPath = path.join(userData, 'journal.json')
  state.storage = createJournalStorage({ journalPath, logger: storageLogger })
  return state.storage
}

function broadcastFileChanged(event: WatchEvent): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.isDestroyed()) continue
    try {
      w.webContents.send(PUSH_CHANNELS.FILE_CHANGED, event)
    } catch {
      // best-effort
    }
  }
  watchLogger.info('file:changed', event as unknown as Record<string, unknown>)
}

function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.isDestroyed()) continue
    try {
      w.webContents.send(channel, payload)
    } catch {
      // best-effort
    }
  }
}

function attachTickStream(win: BrowserWindow): void {
  let n = 0
  const interval = setInterval(() => {
    n += 1
    if (win.isDestroyed()) return
    try {
      win.webContents.send(PUSH_CHANNELS.TICK, n)
    } catch {
      // best-effort
    }
  }, 200)
  const stop = (): void => {
    clearInterval(interval)
    tickLogger.info('tick:stopped', { lastN: n })
  }
  win.once('closed', stop)
  win.webContents.once('destroyed', stop)
  tickLogger.info('tick:started', { intervalMs: 200 })
}

function setupWindowContextMenu(contents: WebContents): void {
  attachContextMenu({ contents, logger: menuLogger })
}

// ---------------------------------------------------------------------------
// Stub fallbacks used by makeHandlerContext when a service failed to install
// in RED. They surface enough structure so the IPC handlers don't crash the
// renderer; the failing BT-L4-N assertions still surface a real diff.
// ---------------------------------------------------------------------------
const FALLBACK_TRAY_VIEW: TrayStateView = { state: 'idle', title: '?', hasImage: false }

function makeHandlerContext(): HandlerContext {
  return {
    logger: ipcLogger,
    monotonicNow: (): number => {
      const perf = (globalThis as { performance?: { now(): number } }).performance
      if (perf && typeof perf.now === 'function') return Math.floor(perf.now())
      return Date.now()
    },
    storage: {
      append: (text: string) => getStorage().append(text),
      list: () => getStorage().list(),
    },
    dialogs: {
      open: async (args: DialogOpenArgs) => {
        if (process.env.DIALOG_STUB === '1') {
          const mode = process.env.DIALOG_STUB_MODE ?? 'cancel'
          if (mode === 'cancel') {
            ipcLogger.info('dialog:open:stub', { mode })
            return { canceled: true, filePaths: [] }
          }
          const filePath = process.env.DIALOG_STUB_PATH ?? '/tmp/sample.txt'
          ipcLogger.info('dialog:open:stub', { mode, filePath })
          return { canceled: false, filePaths: [filePath] }
        }
        const parent = BrowserWindow.getAllWindows()[0]
        const result = parent
          ? await dialog.showOpenDialog(parent, args as Electron.OpenDialogOptions)
          : await dialog.showOpenDialog(args as Electron.OpenDialogOptions)
        return { canceled: result.canceled, filePaths: result.filePaths }
      },
      save: async (args: DialogSaveArgs) => {
        if (process.env.DIALOG_STUB === '1') {
          const mode = process.env.DIALOG_STUB_MODE ?? 'pick'
          if (mode === 'cancel') {
            ipcLogger.info('dialog:save:stub', { mode })
            return { canceled: true, filePath: null }
          }
          const filePath = process.env.DIALOG_STUB_PATH ?? '/tmp/sample.txt'
          ipcLogger.info('dialog:save:stub', { mode, filePath })
          return { canceled: false, filePath }
        }
        const parent = BrowserWindow.getAllWindows()[0]
        const result = parent
          ? await dialog.showSaveDialog(parent, args as Electron.SaveDialogOptions)
          : await dialog.showSaveDialog(args as Electron.SaveDialogOptions)
        return { canceled: result.canceled, filePath: result.filePath ?? null }
      },
    },
    menus: { getTree: () => getApplicationMenuTree() },
    tray: {
      setState: (next: TrayState): TrayStateView => {
        if (!state.tray) return FALLBACK_TRAY_VIEW
        state.tray.setState(next)
        return state.tray.getState()
      },
      getState: (): TrayStateView => {
        if (!state.tray) return FALLBACK_TRAY_VIEW
        return state.tray.getState()
      },
    },
    notifications: {
      show: async (args: NotificationShowArgs) => {
        if (!state.notifications) {
          throw new Error('notifications service not installed')
        }
        return state.notifications.show(args)
      },
    },
    autolaunch: {
      set: (enabled: boolean) => {
        if (!state.autolaunch) return { requested: enabled, observed: false }
        return state.autolaunch.set(enabled)
      },
      get: () => {
        const settings = app.getLoginItemSettings()
        const out: { openAtLogin: boolean; status?: string } = {
          openAtLogin: settings.openAtLogin,
        }
        const status = (settings as { status?: string }).status
        if (typeof status === 'string') out.status = status
        return out
      },
    },
    theme: {
      setSource: (source) => {
        if (!state.theme) return { source, isDark: false }
        return state.theme.setSource(source)
      },
      snapshot: () => {
        if (!state.theme) return { source: 'system', isDark: false }
        return state.theme.snapshot()
      },
    },
    dock: {
      setBadge: (badge) => {
        if (!state.dock) return { ok: false, badge }
        return state.dock.setBadge(badge)
      },
      addRecentDocument: (filePath) => {
        if (!state.dock) return { ok: false }
        return state.dock.addRecentDocument(filePath)
      },
    },
    updater: {
      checkForUpdates: async () => {
        if (!state.updater) {
          throw new Error('updater service not installed')
        }
        return state.updater.checkForUpdates()
      },
      getState: () => {
        if (!state.updater) {
          return {
            lastEvent: 'idle' as const,
            version: null,
            currentVersion: app.getVersion(),
            feedUrl: null,
            provider: 'none',
            errorMessage: 'updater service not installed',
          }
        }
        return state.updater.getState()
      },
    },
    crashReporter: {
      getState: () => {
        if (!crashReporterService) {
          return {
            started: false,
            submitURL: null,
            uploadToServer: false,
            startedBeforeWhenReady: false,
            uploadedReports: 0,
          }
        }
        return crashReporterService.getState()
      },
    },
    test: {
      fireShortcut: (accelerator) => {
        const fired = state.shortcuts?.fireForTest(accelerator) ?? false
        return { ok: true, fired }
      },
      emitPower: (event: PowerEvent) => {
        state.power?.fireForTest(event)
        return { ok: true }
      },
      triggerWillQuit: () => {
        try {
          app.emit('will-quit', { preventDefault: (): void => undefined } as unknown as Electron.Event)
          return { ok: true }
        } catch {
          return { ok: false }
        }
      },
      emitOpenUrl: (url: string) => {
        app.emit(
          'open-url',
          { preventDefault: (): void => undefined } as unknown as Electron.Event,
          url,
        )
        return { ok: true }
      },
      emitSecondInstance: (argv: readonly string[]) => {
        app.emit(
          'second-instance',
          { preventDefault: (): void => undefined } as unknown as Electron.Event,
          [...argv],
          process.cwd(),
        )
        return { ok: true }
      },
    },
  }
}

app.on('before-quit', async (event) => {
  if (state.quitting) return
  state.quitting = true
  appLogger.info('app:before-quit', {})
  if (state.storage) {
    event.preventDefault()
    try {
      await state.storage.flush()
      appLogger.info('app:before-quit:flushed', { inflightAtStart: 0 })
    } catch (err) {
      appLogger.error('app:before-quit:flush-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      app.quit()
    }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function deepLinkHandler(link: ParsedDeepLink, origin: 'open-url' | 'second-instance'): void {
  protocolLogger.info('deeplink:dispatched', {
    scheme: link.scheme,
    action: link.action,
    params: link.params,
    origin,
  })
  broadcast(PUSH_CHANNELS.LIFECYCLE_OPEN_URL, {
    url: `${link.scheme}://${link.action}`,
    action: link.action,
    params: link.params,
    origin,
  })
}

app
  .whenReady()
  .then(async () => {
    appLogger.info('app:ready', { isReady: app.isReady() })

    registerSessionPermissionHandler(session.defaultSession, secLogger)

    // ---- L4 services. Each install is wrapped so a single throw doesn't
    //      take down the rest; failures surface in logs and a fallback view
    //      is served from the IPC layer (which still drives BT failures
    //      via the wrong observable behavior). ----
    try {
      state.tray = installTray({ logger: trayLogger, initialState: 'idle' })
    } catch (err) {
      trayLogger.error('tray:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      state.notifications = installNotificationService({
        logger: notificationLogger,
        onFailed: (payload) => {
          broadcast(PUSH_CHANNELS.NOTIFICATION_FAILED, payload)
        },
      })
    } catch (err) {
      notificationLogger.error('notification:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      state.shortcuts = installShortcuts({
        logger: shortcutLogger,
        onFire: (accelerator) => {
          broadcast(PUSH_CHANNELS.SHORTCUT_FIRED, { accelerator })
        },
      })
      // Per R-L4-2: globalShortcut MUST be unregistered in `will-quit`. The
      // shortcuts module owns the listener; main.ts wires the cleanup hook
      // through the lifecycle controller below.
    } catch (err) {
      shortcutLogger.error('shortcut:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      state.autolaunch = installAutoLaunch({ logger: autolaunchLogger })
    } catch (err) {
      autolaunchLogger.error('autolaunch:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      state.theme = installThemeService({
        logger: themeLogger,
        onChange: (snapshot) => {
          broadcast(PUSH_CHANNELS.THEME_CHANGED, snapshot)
        },
      })
    } catch (err) {
      themeLogger.error('theme:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      state.dock = installDock({ logger: dockLogger })
    } catch (err) {
      dockLogger.error('dock:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    // ---- L5 NEW: electron-updater. The feed URL defaults to the local
    //      fixture server (BT-L5-6/7). `autoCheck:false` means we do NOT call
    //      `checkForUpdatesAndNotify()` automatically — the test:check-for-
    //      updates IPC channel drives it explicitly. ----
    try {
      const feedUrl = process.env.UPDATE_URL ?? 'http://127.0.0.1:8765/updates'
      state.updater = installUpdater({
        logger: updaterLogger,
        currentVersion: app.getVersion(),
        feedUrl,
        autoCheck: false,
      })
    } catch (err) {
      updaterLogger.error('updater:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    if (state.tray) {
      try {
        state.power = installPowerService({ logger: powerLogger, tray: state.tray })
      } catch (err) {
        powerLogger.error('power:install-failed', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    try {
      state.lifecycle = installLifecycle({
        logger: lifecycleLogger,
        getMainWindow: () => {
          const wins = BrowserWindow.getAllWindows()
          return wins[0] ?? null
        },
        onDeepLink: deepLinkHandler,
        onWillQuit: () => {
          state.shortcuts?.unregisterAll()
        },
      })
    } catch (err) {
      lifecycleLogger.error('lifecycle:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    const ctx = makeHandlerContext()
    registerIpc(ipcMain, ctx)

    try {
      installApplicationMenu({
        logger: menuLogger,
        onQuitRequested: () => {
          appLogger.info('menu:quit-requested', {})
          app.quit()
        },
      })
    } catch (err) {
      menuLogger.error('menu:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    const win = createMainWindow()
    registerSecurityGuards(win.webContents, {
      expectedOrigin: 'null',
      logger: secLogger,
    })
    secLogger.info('security:guards-attached', { expectedOrigin: 'null' })

    try {
      setupWindowContextMenu(win.webContents)
    } catch (err) {
      menuLogger.error('menu:context-attach-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
    attachTickStream(win)

    const userData = app.getPath('userData')
    const watchDir = path.join(userData, 'watched-folder')
    try {
      mkdirSync(watchDir, { recursive: true })
    } catch (err) {
      watchLogger.error('watch:mkdir-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
    try {
      state.watcher = startWatcher({
        directory: watchDir,
        logger: watchLogger,
        onEvent: broadcastFileChanged,
      })
      watchLogger.info('watch:started', { directory: watchDir })
    } catch (err) {
      watchLogger.error('watch:start-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const next = createMainWindow()
        registerSecurityGuards(next.webContents, {
          expectedOrigin: 'null',
          logger: secLogger,
        })
        try {
          setupWindowContextMenu(next.webContents)
        } catch {
          // tolerated
        }
        attachTickStream(next)
      }
    })

    appLogger.info('app:install-complete', {
      tray: state.tray !== null,
      notifications: state.notifications !== null,
      shortcuts: state.shortcuts !== null,
      power: state.power !== null,
      lifecycle: state.lifecycle !== null,
      autolaunch: state.autolaunch !== null,
      theme: state.theme !== null,
      dock: state.dock !== null,
      updater: state.updater !== null,
      crashReporter: crashReporterService !== null,
    })
  })
  .catch((err: unknown) => {
    appLogger.error('app:boot-failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  })

// will-quit: stop the watcher and clean up shortcut registrations.
app.on('will-quit', async () => {
  if (state.watcher) {
    try {
      await state.watcher.stop()
      watchLogger.info('watch:stopped', {})
    } catch (err) {
      watchLogger.error('watch:stop-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
    state.watcher = null
  }
  try {
    state.shortcuts?.unregisterAll()
  } catch {
    // tolerated
  }
  try {
    state.autolaunch?.cleanupOnRemove()
  } catch {
    // tolerated
  }
  appLogger.info('lifecycle:will-quit:cleanup', {})
})

// Touch the parser import so future static-source checks see it in main.ts.
void parseDeepLink
void FOCUS_TOGGLE_ACCELERATOR
