/**
 * L1 main-process entry.
 *
 * Responsibilities:
 *  1. Resolve the log directory (LOG_DIR env var wins; otherwise app.getPath('logs')).
 *  2. Stand up the structured JSON-lines logger.
 *  3. Emit lifecycle log entries: app:starting → app:ready → window:created → renderer:ready.
 *  4. Register IPC handlers (renderer:ready, app:ping, log:path).
 *  5. Create exactly one BrowserWindow.
 *  6. On macOS, do NOT quit when all windows close (window-all-closed guard).
 *
 * Security baseline (per shared/conventions.md): the renderer talks to main ONLY
 * through the preload's contextBridge surface. No nodeIntegration, sandbox on.
 */
import { app, ipcMain, BrowserWindow } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { createLogger, logFilePath } from './log'
import { IPC_CHANNELS } from './ipc'
import { createMainWindow } from './window'

function resolveLogDir(): string {
  const fromEnv = process.env.LOG_DIR
  if (fromEnv && fromEnv.length > 0) return fromEnv
  // app.getPath('logs') requires app to be ready on some platforms in earlier
  // versions; for Electron 26+ on darwin it's safe before ready. We still
  // wrap in try/catch as a safety net.
  try {
    return app.getPath('logs')
  } catch {
    return path.join(app.getPath('userData'), 'logs')
  }
}

const LOG_DIR = resolveLogDir()
const logger = createLogger({ logDir: LOG_DIR, module: 'app', process: 'main' })
const windowLogger = createLogger({ logDir: LOG_DIR, module: 'window', process: 'main' })
const ipcLogger = createLogger({ logDir: LOG_DIR, module: 'ipc', process: 'main' })

// Emit app:starting as the very first log line, BEFORE app.whenReady() — this
// is the ordering invariant exercised by BT-L1-4 and the regression test for
// "window created after whenReady".
logger.info('app:starting', {
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  platform: process.platform,
  arch: process.arch,
})

// Expose a quitting flag so e2e tests can verify the app is NOT mid-quit
// after a window close on darwin (BT-L1-3 cross-check).
;(globalThis as { __l1Quitting?: boolean }).__l1Quitting = false
app.on('before-quit', () => {
  ;(globalThis as { __l1Quitting?: boolean }).__l1Quitting = true
  logger.info('app:before-quit', { reason: 'user-initiated' })
})

/**
 * Registers L1 IPC channels.
 * - renderer:ready  (on)      — fire-and-forget; main logs userAgent on receipt
 * - app:ping        (handle)  — returns { pong: true, ts: monotonicMs }
 * - log:path        (handle)  — returns absolute path to the log file
 */
function registerIpc(): void {
  ipcMain.on(IPC_CHANNELS.RENDERER_READY, (_event, payload: unknown) => {
    let userAgent = ''
    if (
      payload !== null &&
      typeof payload === 'object' &&
      'userAgent' in (payload as Record<string, unknown>) &&
      typeof (payload as { userAgent?: unknown }).userAgent === 'string'
    ) {
      userAgent = (payload as { userAgent: string }).userAgent
    }
    ipcLogger.info('renderer:ready', { userAgent })
  })

  ipcMain.handle(IPC_CHANNELS.APP_PING, (_event: IpcMainInvokeEvent) => {
    return { pong: true, ts: Date.now() }
  })

  ipcMain.handle(IPC_CHANNELS.LOG_PATH, () => {
    return logFilePath(LOG_DIR)
  })
}

// macOS convention (BT-L1-3): closing the last window does NOT quit the app.
// On Windows/Linux we still follow the platform convention.
app.on('window-all-closed', () => {
  windowLogger.info('window:closed', { allWindowsClosed: true })
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app
  .whenReady()
  .then(() => {
    logger.info('app:ready', {
      electronVersion: process.versions.electron,
      isReady: app.isReady(),
    })

    registerIpc()

    const win = createMainWindow()
    windowLogger.info('window:created', {
      width: win.getBounds().width,
      height: win.getBounds().height,
      url: 'file://renderer/index.html',
    })

    // macOS dock-click "activate" — recreate a window if none exist.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const next = createMainWindow()
        windowLogger.info('window:created', {
          width: next.getBounds().width,
          height: next.getBounds().height,
          url: 'file://renderer/index.html',
          reason: 'activate',
        })
      }
    })
  })
  .catch((err: unknown) => {
    logger.error('app:boot-failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  })
