/**
 * L3 main-process entry.
 *
 * Responsibilities:
 *  1. Resolve the log directory (LOG_DIR env var wins; otherwise app.getPath('logs')).
 *  2. Stand up the structured JSON-lines logger.
 *  3. Wire storage + dialogs + menus adapters and register IPC handlers via the
 *     centralized registry in src/ipc.ts.
 *  4. Create a BrowserWindow with the secure defaults from src/window.ts.
 *  5. Register navigation + window-open + permission guards via src/security.ts.
 *  6. Install the application menu and per-window context menu via src/menu.ts.
 *  7. Run a 200ms tick stream and push it to the renderer via webContents.send.
 *  8. Start a file watcher rooted at `${userData}/watched-folder/` and push
 *     `file:changed` events to the renderer.
 *  9. On `before-quit`, await any in-flight journal writes before allowing the
 *     quit to complete (BT-L3-8 / R-L3-4).
 * 10. On macOS, do NOT quit when all windows close.
 *
 * NOTE — RED commit: many of the wires are present but the adapters delegate
 * to stubs in storage/watch/menu that throw `not implemented`. This is
 * intentional: it lets the app BOOT (so tests can attempt IPC calls) while
 * the behavioral assertions fail.
 */
import { app, BrowserWindow, dialog, ipcMain, session, type WebContents } from 'electron'
import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { createLogger } from './log'
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
import type { DialogOpenArgs, DialogSaveArgs } from './ipc-validation'

function resolveLogDir(): string {
  const fromEnv = process.env.LOG_DIR
  if (fromEnv && fromEnv.length > 0) return fromEnv
  try {
    return app.getPath('logs')
  } catch {
    return path.join(app.getPath('userData'), 'logs')
  }
}

// Honor a test-supplied USER_DATA_DIR so e2e tests do not share state with the
// developer's real Electron app data. Must be applied BEFORE whenReady() so
// every subsequent `app.getPath('userData')` resolves to the test dir.
const userDataOverride = process.env.USER_DATA_DIR
if (userDataOverride && userDataOverride.length > 0) {
  try {
    mkdirSync(userDataOverride, { recursive: true })
    app.setPath('userData', userDataOverride)
  } catch {
    // ignored — if this fails, e2e isolation breaks but the app still runs
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

appLogger.info('app:starting', {
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  platform: process.platform,
})

const state: {
  storage: JournalStorage | null
  watcher: Watcher | null
  quitting: boolean
} = { storage: null, watcher: null, quitting: false }

/** Lazily-constructed journal storage; reified once userData is available. */
function getStorage(): JournalStorage {
  if (state.storage) return state.storage
  const userData = app.getPath('userData')
  const journalPath = path.join(userData, 'journal.json')
  state.storage = createJournalStorage({ journalPath, logger: storageLogger })
  return state.storage
}

app.on('before-quit', async (event) => {
  if (state.quitting) return
  state.quitting = true
  appLogger.info('app:before-quit', {})
  // R-L3-4: any pending journal write must flush before the quit completes.
  if (state.storage) {
    event.preventDefault()
    try {
      await state.storage.flush()
      appLogger.info('app:before-quit:flushed', {
        inflightAtStart: 0,
      })
    } catch (err) {
      appLogger.error('app:before-quit:flush-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      // After flushing, allow the quit to proceed unimpeded.
      app.quit()
    }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

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
        // Test seam: when DIALOG_STUB === '1', return a deterministic fixture
        // result tailored to the test scenario. We branch on DIALOG_STUB_MODE
        // so a single launch can express "cancel" or "pick a path".
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
        // Real dialog. Need a parent window — pick the first if any.
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
    menus: {
      getTree: () => getApplicationMenuTree(),
    },
  }
}

function setupWindowContextMenu(contents: WebContents): void {
  attachContextMenu({ contents, logger: menuLogger })
}

app
  .whenReady()
  .then(async () => {
    appLogger.info('app:ready', { isReady: app.isReady() })

    registerSessionPermissionHandler(session.defaultSession, secLogger)

    const ctx = makeHandlerContext()
    registerIpc(ipcMain, ctx)

    // Application menu (BT-L3-6, BT-L3-8). Wrapped so a stub throw cannot
    // prevent the app from booting — tests assert behavior; a failed install
    // surfaces via the menu module's own log entry plus subsequent IPC failures.
    try {
      installApplicationMenu({
        logger: menuLogger,
        onQuitRequested: () => {
          appLogger.info('menu:quit-requested', {})
          // app.quit() triggers before-quit, which flushes pending writes.
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

    // File watcher rooted at userData/watched-folder.
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
          // RED-commit stub may throw; tolerated.
        }
        attachTickStream(next)
      }
    })
  })
  .catch((err: unknown) => {
    appLogger.error('app:boot-failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  })

// Belt-and-suspenders cleanup: when the app is about to fully quit, stop the
// watcher and let Electron finish shutdown.
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
})

