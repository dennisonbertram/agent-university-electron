/**
 * L2 main-process entry.
 *
 * Responsibilities:
 *  1. Resolve the log directory (LOG_DIR env var wins; otherwise app.getPath('logs')).
 *  2. Stand up the structured JSON-lines logger.
 *  3. Register IPC handlers via the centralized registry in src/ipc.ts.
 *  4. Create a BrowserWindow with the secure defaults from src/window.ts.
 *  5. Register navigation + window-open + permission guards via src/security.ts.
 *  6. Run a 200ms tick stream and push it to the renderer via webContents.send.
 *  7. On macOS, do NOT quit when all windows close (carried over from L1).
 *
 * Boot ordering invariant: every window goes through createMainWindow() so the
 * secure defaults apply uniformly (R-L2-3).
 */
import { app, BrowserWindow, ipcMain, session } from 'electron'
import path from 'node:path'
import { createLogger } from './log'
import { registerIpc, PUSH_CHANNELS } from './ipc'
import { createMainWindow } from './window'
import { registerSecurityGuards, registerSessionPermissionHandler } from './security'

function resolveLogDir(): string {
  const fromEnv = process.env.LOG_DIR
  if (fromEnv && fromEnv.length > 0) return fromEnv
  try {
    return app.getPath('logs')
  } catch {
    return path.join(app.getPath('userData'), 'logs')
  }
}

const LOG_DIR = resolveLogDir()
const appLogger = createLogger({ logDir: LOG_DIR, module: 'app', process: 'main' })
const ipcLogger = createLogger({ logDir: LOG_DIR, module: 'ipc', process: 'main' })
const secLogger = createLogger({ logDir: LOG_DIR, module: 'security', process: 'main' })
const tickLogger = createLogger({ logDir: LOG_DIR, module: 'tick', process: 'main' })

appLogger.info('app:starting', {
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  platform: process.platform,
})

;(globalThis as { __l2Quitting?: boolean }).__l2Quitting = false
app.on('before-quit', () => {
  ;(globalThis as { __l2Quitting?: boolean }).__l2Quitting = true
  appLogger.info('app:before-quit', {})
})

// Carry the L1 macOS convention forward.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

/**
 * Attaches the 200ms tick stream to a window. Cleans up on window close.
 * Each tick increments a window-scoped counter so independent windows have
 * independent sequences.
 */
function attachTickStream(win: BrowserWindow): void {
  let n = 0
  const interval = setInterval(() => {
    n += 1
    if (win.isDestroyed()) return
    try {
      win.webContents.send(PUSH_CHANNELS.TICK, n)
    } catch {
      // best-effort — window might be tearing down
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

app
  .whenReady()
  .then(() => {
    appLogger.info('app:ready', { isReady: app.isReady() })

    // Deny every permission request before any window can issue one.
    registerSessionPermissionHandler(session.defaultSession, secLogger)

    // Register all IPC handlers BEFORE the renderer can call them.
    registerIpc(ipcMain, ipcLogger)

    const win = createMainWindow()

    // Attach security guards immediately. The renderer loads via loadFile() —
    // a file:// URL — and our isInternalUrl helper treats every file:// URL
    // as internal when expectedOrigin === 'null'. We don't need to wait for
    // did-finish-load.
    registerSecurityGuards(win.webContents, {
      expectedOrigin: 'null',
      logger: secLogger,
    })
    secLogger.info('security:guards-attached', { expectedOrigin: 'null' })

    attachTickStream(win)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const next = createMainWindow()
        registerSecurityGuards(next.webContents, {
          expectedOrigin: 'null',
          logger: secLogger,
        })
        attachTickStream(next)
      }
    })
  })
  .catch((err: unknown) => {
    appLogger.error('app:boot-failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  })
