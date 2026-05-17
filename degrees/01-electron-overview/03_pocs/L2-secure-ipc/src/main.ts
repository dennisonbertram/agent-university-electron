/**
 * L2 main-process entry.
 *
 * Responsibilities:
 *  1. Resolve the log directory (LOG_DIR env var wins; otherwise app.getPath('logs')).
 *  2. Stand up the structured JSON-lines logger.
 *  3. Register IPC handlers via the centralized registry in src/ipc.ts.
 *  4. Create a BrowserWindow with the secure defaults from src/window.ts.
 *  5. Register navigation + window-open guards in src/security.ts.
 *  6. Run a 200ms tick stream and push it to the renderer via webContents.send.
 *
 * SKELETON (RED commit): boots far enough for `firstWindow()` to resolve,
 * but does NOT register IPC handlers or security guards — so the e2e tests
 * fail on real assertions (handler missing, navigation not blocked, etc.).
 */
import { app, ipcMain, BrowserWindow } from 'electron'
import path from 'node:path'
import { createLogger } from './log'
import { createMainWindow } from './window'

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

appLogger.info('app:starting', {
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  platform: process.platform,
})

// Suppress quit on darwin (matches L1 R-L1-1).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app
  .whenReady()
  .then(() => {
    appLogger.info('app:ready', { isReady: app.isReady() })

    // RED skeleton: deliberately NOT calling registerIpc / registerSecurityGuards.
    // The window is created so e2e tests can attach via `firstWindow()`, but
    // every behavioral assertion (handler response, log entry, blocked URL)
    // fails because nothing actually wires the surface up.
    void ipcMain // referenced to keep tsc happy under noUnusedLocals
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })
  .catch((err: unknown) => {
    appLogger.error('app:boot-failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  })
