/**
 * Single source of truth for BrowserWindow construction in L2.
 *
 * Centralizing the webPreferences makes R-L2-3 enforceable: a test reads
 * this file and asserts the secure defaults are present and not weakened.
 * Adding a new window MUST go through `createMainWindow` (or a sibling
 * function that reuses the same defaults).
 *
 * Defaults per 01_research/05-security-model.md:
 *   - contextIsolation: true
 *   - sandbox:          true
 *   - nodeIntegration:  false
 *   - webSecurity:      true
 *   - preload:          dist/preload.js
 *
 * Loads `dist/renderer/index.html` via `loadFile` (file:// origin).
 */
import { BrowserWindow } from 'electron'
import path from 'node:path'

/** The canonical webPreferences used by every L2 BrowserWindow. */
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
  const width = opts.width ?? 900
  const height = opts.height ?? 600

  // __dirname at runtime is .../dist when compiled.
  const preloadPath = path.join(__dirname, 'preload.js')
  const indexHtml = path.join(__dirname, 'renderer', 'index.html')

  const win = new BrowserWindow({
    width,
    height,
    show: true,
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: preloadPath,
    },
  })

  void win.loadFile(indexHtml)
  return win
}
