/**
 * Popover-style BrowserWindow for Pulse.
 *
 * Differences vs L5:
 *   - Frameless (`frame: false`) so it looks like a tray popover.
 *   - `show: true` in dev (Playwright needs it visible for IPC). For real
 *     menu-bar UX we'd toggle via tray click; that's a future polish task
 *     documented in poc-report.md.
 *   - Secure webPreferences preserved (contextIsolation, sandbox,
 *     nodeIntegration:false, webSecurity:true).
 */
import { BrowserWindow } from 'electron'
import path from 'node:path'

export const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
} as const

export interface CreateMainWindowOptions {
  width?: number
  height?: number
}

export function createMainWindow(opts: CreateMainWindowOptions = {}): BrowserWindow {
  const width = opts.width ?? 420
  const height = opts.height ?? 520

  const preloadPath = path.join(__dirname, 'preload.js')
  const indexHtml = path.join(__dirname, 'renderer', 'index.html')

  const win = new BrowserWindow({
    width,
    height,
    show: true,
    // Popover-feel: frameless + no resizing + always-on-top in real use.
    // For Playwright we keep `alwaysOnTop` false to avoid focus issues.
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: preloadPath,
    },
  })

  void win.loadFile(indexHtml)
  return win
}
